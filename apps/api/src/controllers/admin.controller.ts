import type { Request, Response } from 'express';
import { analyticsService } from '../services/analytics.service';
import { prisma } from '../lib/prisma';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { serialize } from '../utils/serialize';
import { param } from '../utils/param';
import { AppError } from '../utils/AppError';
import { parseIdParam } from '../utils/ids';
import { ROLES } from '@nexus/shared';

export const adminController = {
  getDashboard: asyncHandler(async (_req, res) => {
    const stats = await analyticsService.getDashboardStats();
    ApiResponse.success(res, stats);
  }),

  getRevenueChart: asyncHandler(async (req, res) => {
    const chart = await analyticsService.getRevenueChart(Number(req.query.days) || 30);
    ApiResponse.success(res, chart);
  }),

  getUsers: asyncHandler(async (req, res) => {
    const page = Math.max(Math.floor(Number(req.query.page)) || 1, 1);
    const limit = Math.min(Math.max(Math.floor(Number(req.query.limit)) || 20, 1), 100);
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = {};
    if (req.query.role !== undefined && req.query.role !== '') {
      const role = req.query.role;
      if (typeof role !== 'string' || !Object.values(ROLES).includes(role as never)) {
        throw new AppError('Invalid role filter', 400);
      }
      where.role = role;
    }
    if (req.query.search) {
      const search = String(req.query.search);
      Object.assign(where, {
        OR: [
          { email: { contains: search } },
          { firstName: { contains: search } },
          { lastName: { contains: search } },
        ],
      });
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    ApiResponse.success(res, serialize(users), 'Users fetched', 200, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    });
  }),

  updateUserStatus: asyncHandler(async (req, res) => {
    const targetId = parseIdParam(param(req, 'id'));
    if (!Number.isInteger(targetId) || targetId <= 0) throw new AppError('User not found', 404);
    if (String(targetId) === req.user!.userId) {
      throw new AppError('You cannot change your own account status', 400);
    }
    const target = await prisma.user.findUnique({ where: { id: targetId }, select: { role: true } });
    if (!target) throw new AppError('User not found', 404);
    // Only a super admin may deactivate/reactivate another administrator.
    if (
      (target.role === ROLES.ADMIN || target.role === ROLES.SUPER_ADMIN) &&
      req.user!.role !== ROLES.SUPER_ADMIN
    ) {
      throw new AppError('Only a super admin can change an administrator account', 403);
    }

    const user = await prisma.user.update({
      where: { id: targetId },
      // Deactivating an account also ends its refresh-token session.
      data: { isActive: req.body.isActive, ...(req.body.isActive === false ? { refreshToken: null } : {}) },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
      },
    });
    ApiResponse.success(res, serialize(user), 'User updated');
  }),

  getVendors: asyncHandler(async (_req, res) => {
    const vendors = await prisma.vendor.findMany({
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    ApiResponse.success(res, serialize(vendors));
  }),

  updateVendorStatus: asyncHandler(async (req, res) => {
    const vendor = await prisma.vendor.update({
      where: { id: parseIdParam(param(req, 'id')) },
      data: {
        status: req.body.status,
        isVerified: req.body.isVerified ?? undefined,
      },
    });
    ApiResponse.success(res, serialize(vendor), 'Vendor updated');
  }),

  getReviews: asyncHandler(async (req, res) => {
    const reviews = await prisma.review.findMany({
      where: req.query.approved === 'false' ? {} : { isApproved: true },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        product: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    ApiResponse.success(res, serialize(reviews));
  }),

  moderateReview: asyncHandler(async (req, res) => {
    const review = await prisma.review.update({
      where: { id: parseIdParam(param(req, 'id')) },
      data: { isApproved: req.body.isApproved },
    });
    ApiResponse.success(res, serialize(review), 'Review moderated');
  }),

  getCoupons: asyncHandler(async (_req, res) => {
    const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
    ApiResponse.success(res, serialize(coupons));
  }),

  createCoupon: asyncHandler(async (req, res) => {
    const coupon = await prisma.coupon.create({ data: req.body });
    ApiResponse.created(res, serialize(coupon));
  }),

  getBanners: asyncHandler(async (_req, res) => {
    const banners = await prisma.banner.findMany({ orderBy: { sortOrder: 'asc' } });
    ApiResponse.success(res, serialize(banners));
  }),

  createBanner: asyncHandler(async (req, res) => {
    const banner = await prisma.banner.create({ data: req.body });
    ApiResponse.created(res, serialize(banner));
  }),
};
