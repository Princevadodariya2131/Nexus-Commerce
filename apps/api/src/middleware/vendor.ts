import type { Request, Response, NextFunction } from 'express';
import { ROLES } from '@nexus/shared';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';

/**
 * For users with the vendor role, resolves the vendor profile from the DATABASE
 * (never from the JWT claim, which can be missing or stale right after onboarding)
 * and requires it to exist and be approved. The resolved vendor is exposed as
 * `req.vendor` and is the only source of vendor identity for write operations.
 *
 * Administrators pass through untouched. Must run after `authenticate`.
 */
export const requireVendorContext = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user;
    if (!user) throw new AppError('Authentication required', 401);
    if (user.role !== ROLES.VENDOR) {
      next();
      return;
    }

    const vendor = await prisma.vendor.findUnique({
      where: { userId: parseInt(user.userId, 10) },
      select: { id: true, status: true },
    });
    if (!vendor) throw new AppError('A vendor profile is required for this action', 403);
    if (vendor.status !== 'approved') {
      throw new AppError('Your vendor account is not approved', 403);
    }

    req.vendor = { id: vendor.id, status: vendor.status };
    next();
  } catch (error) {
    next(error);
  }
};
