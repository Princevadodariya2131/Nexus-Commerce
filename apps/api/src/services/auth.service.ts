import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { emailService } from './email.service';
import { hashPassword, comparePassword } from '../utils/password';
import { formatUser, serialize } from '../utils/serialize';
import type { JwtPayload } from '@nexus/shared';
import { ROLES } from '@nexus/shared';
import type { UserRole } from '@prisma/client';

const generateTokens = (payload: JwtPayload) => {
  const accessToken = jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'],
  });
  // A unique id per token: without it, two refreshes within the same second produce byte-identical tokens,
  // so rotation could not invalidate the previous one.
  const refreshToken = jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn as jwt.SignOptions['expiresIn'],
    jwtid: crypto.randomUUID(),
  });
  return { accessToken, refreshToken };
};

const toJwtPayload = (user: { id: number; email: string; role: UserRole; vendorId: number | null }): JwtPayload => ({
  userId: String(user.id),
  email: user.email,
  role: user.role as JwtPayload['role'],
  vendorId: user.vendorId ? String(user.vendorId) : undefined,
});

export const authService = {
  async register(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role?: string;
  }) {
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new AppError('Email already registered', 409);

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const hashed = await hashPassword(data.password);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashed,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role === ROLES.VENDOR ? 'vendor' : 'customer',
        emailVerificationToken: verificationToken,
        emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    await emailService.sendVerificationEmail(user.email, verificationToken);

    const payload = toJwtPayload(user);
    const tokens = generateTokens(payload);
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: tokens.refreshToken },
    });

    return { user: formatUser(serialize(user)), ...tokens };
  },

  async login(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await comparePassword(password, user.password))) {
      throw new AppError('Invalid email or password', 401);
    }
    if (!user.isActive) throw new AppError('Account deactivated', 403);

    const payload = toJwtPayload(user);
    const tokens = generateTokens(payload);

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: tokens.refreshToken, lastLogin: new Date() },
    });

    return { user: formatUser(serialize(user)), ...tokens };
  },

  async refreshToken(token: unknown) {
    if (typeof token !== 'string' || token.length === 0) {
      throw new AppError('Refresh token required', 401);
    }
    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(token, config.jwt.refreshSecret) as JwtPayload;
    } catch {
      throw new AppError('Invalid refresh token', 401);
    }
    const userId = parseInt(decoded.userId, 10);
    if (!Number.isInteger(userId) || userId <= 0) throw new AppError('Invalid refresh token', 401);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    // The stored token must match (rotation), and a deactivated account can not mint new tokens.
    if (!user || !user.isActive || user.refreshToken !== token) {
      throw new AppError('Invalid refresh token', 401);
    }

    const payload = toJwtPayload(user);
    const tokens = generateTokens(payload);
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: tokens.refreshToken },
    });

    return tokens;
  },

  async logout(userId: string) {
    await prisma.user.update({
      where: { id: parseInt(userId, 10) },
      data: { refreshToken: null },
    });
  },

  async verifyEmail(token: string) {
    const user = await prisma.user.findFirst({
      where: {
        emailVerificationToken: token,
        emailVerificationExpires: { gt: new Date() },
      },
    });
    if (!user) throw new AppError('Invalid or expired verification token', 400);

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
      },
    });

    return formatUser(serialize(updated));
  },

  async forgotPassword(email: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return;

    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: hashedToken,
        passwordResetExpires: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    await emailService.sendPasswordResetEmail(email, resetToken);
  },

  async resetPassword(token: string, newPassword: string) {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: hashedToken,
        passwordResetExpires: { gt: new Date() },
      },
    });
    if (!user) throw new AppError('Invalid or expired reset token', 400);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: await hashPassword(newPassword),
        passwordResetToken: null,
        passwordResetExpires: null,
        // A password reset must end every existing session.
        refreshToken: null,
      },
    });
  },

  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId, 10) },
      include: { ownedVendor: true },
    });
    if (!user) throw new AppError('User not found', 404);
    return formatUser(serialize(user));
  },

  async updateProfile(
    userId: string,
    data: Partial<{
      firstName: string;
      lastName: string;
      phone: string;
      avatar: string;
    }>
  ) {
    // Explicit field picking (defense in depth behind the strict validator): only these
    // four columns can ever be written from a profile update.
    const user = await prisma.user.update({
      where: { id: parseInt(userId, 10) },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        avatar: data.avatar,
      },
    });
    return formatUser(serialize(user));
  },

  /**
   * Short-lived token for the Socket.io handshake. The access cookie is httpOnly
   * and is not sent to a different API origin, so the browser asks for this token
   * (authenticated by the cookie) and passes it as `auth.token`. It carries a
   * `purpose` claim, so `authenticate` refuses it as an API access token.
   */
  createSocketToken(userId: string, role: string) {
    const expiresInSeconds = 60;
    const token = jwt.sign({ userId, role, purpose: 'socket' }, config.jwt.secret, {
      expiresIn: expiresInSeconds,
    });
    return { token, expiresIn: expiresInSeconds };
  },
};
