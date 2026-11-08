import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { prisma } from '../lib/prisma';
import { ApiResponse } from '../utils/ApiResponse';
import { AppError } from '../utils/AppError';
import type { JwtPayload } from '@nexus/shared';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload & { id: string };
      /** Set by requireVendorContext from the database; never from the JWT. */
      vendor?: { id: number; status: string };
    }
  }
}

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token =
      req.cookies?.accessToken ||
      (req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.split(' ')[1]
        : null);

    if (!token) {
      ApiResponse.unauthorized(res, 'Authentication required');
      return;
    }

    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload & { purpose?: string };
    // Dedicated tokens (e.g. the short-lived Socket.io token) must never act as API access tokens.
    if (decoded.purpose !== undefined) {
      ApiResponse.unauthorized(res, 'Invalid or expired token');
      return;
    }
    const user = await prisma.user.findUnique({
      where: { id: parseInt(decoded.userId, 10) },
      select: { isActive: true, role: true },
    });

    if (!user || !user.isActive) {
      ApiResponse.unauthorized(res, 'Account inactive or not found');
      return;
    }

    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      // Role comes from the database, so a demotion takes effect immediately
      // instead of after the access token expires.
      role: user.role as JwtPayload['role'],
      vendorId: decoded.vendorId,
      id: decoded.userId,
    };

    next();
  } catch {
    ApiResponse.unauthorized(res, 'Invalid or expired token');
  }
};

export const optionalAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token =
      req.cookies?.accessToken ||
      (req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.split(' ')[1]
        : null);

    if (token) {
      const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload & { purpose?: string };
      if (decoded.purpose !== undefined) {
        next();
        return;
      }
      req.user = {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
        vendorId: decoded.vendorId,
        id: decoded.userId,
      };
    }
    next();
  } catch {
    next();
  }
};

export const authorize = (...roles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError('Authentication required', 401));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new AppError('Insufficient permissions', 403));
      return;
    }
    next();
  };
};
