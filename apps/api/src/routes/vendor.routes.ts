import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { ROLES } from '@nexus/shared';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { serialize } from '../utils/serialize';
import { requireVendorContext } from '../middleware/vendor';
import { validate } from '../middleware/validate';
import { vendorOnboardSchema } from '../validators/vendor.validator';

const router = Router();

router.use(authenticate, authorize(ROLES.VENDOR));

router.post(
  '/onboard',
  validate(vendorOnboardSchema),
  asyncHandler(async (req, res) => {
    const userId = parseInt(req.user!.userId, 10);
    const existing = await prisma.vendor.findUnique({ where: { userId } });
    if (existing) throw new AppError('Vendor profile already exists', 409);

    let slug = req.body.businessName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    // An all-symbol name yields an empty slug, and two businesses can share a name.
    if (!slug || (await prisma.vendor.findUnique({ where: { slug } }))) {
      slug = `${slug || 'vendor'}-${userId}`;
    }

    const vendor = await prisma.vendor.create({
      data: {
        userId,
        businessName: req.body.businessName,
        slug,
        email: req.body.email || req.user!.email,
        description: req.body.description,
        street: req.body.address?.street,
        city: req.body.address?.city,
        state: req.body.address?.state,
        country: req.body.address?.country,
        zipCode: req.body.address?.zipCode,
      },
    });

    await prisma.user.update({
      where: { id: userId },
      data: { vendorId: vendor.id, role: 'vendor' },
    });

    ApiResponse.created(res, serialize(vendor), 'Vendor application submitted');
  })
);

router.get(
  '/dashboard',
  asyncHandler(async (req, res) => {
    const vendor = await prisma.vendor.findUnique({
      where: { userId: parseInt(req.user!.userId, 10) },
    });
    if (!vendor) throw new AppError('Vendor profile not found', 404);

    // Only an approved vendor sees sales data; a pending/suspended vendor just sees its own status.
    const approved = vendor.status === 'approved';
    const [products, orders, paidItems] = approved
      ? await Promise.all([
          prisma.product.count({ where: { vendorId: vendor.id } }),
          prisma.orderItem.count({ where: { vendorId: vendor.id } }),
          prisma.orderItem.findMany({
            where: { vendorId: vendor.id, order: { paymentStatus: 'paid' } },
            select: { price: true, quantity: true },
          }),
        ])
      : [0, 0, []];
    const revenue = paidItems.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);

    ApiResponse.success(res, {
      vendor: serialize(vendor),
      stats: {
        products,
        orders,
        revenue: Math.round(revenue * 100) / 100,
        pendingPayout: approved ? Number(vendor.pendingPayout) : 0,
        rating: approved ? Number(vendor.rating) : 0,
      },
    });
  })
);

router.get(
  '/products',
  requireVendorContext,
  asyncHandler(async (req, res) => {
    const vendor = await prisma.vendor.findUnique({
      where: { userId: parseInt(req.user!.userId, 10) },
    });
    if (!vendor) throw new AppError('Vendor not found', 404);
    const products = await prisma.product.findMany({
      where: { vendorId: vendor.id },
      orderBy: { createdAt: 'desc' },
    });
    ApiResponse.success(res, serialize(products));
  })
);

router.get(
  '/orders',
  requireVendorContext,
  asyncHandler(async (req, res) => {
    const vendor = await prisma.vendor.findUnique({
      where: { userId: parseInt(req.user!.userId, 10) },
    });
    if (!vendor) throw new AppError('Vendor not found', 404);

    const orderIds = await prisma.orderItem.findMany({
      where: { vendorId: vendor.id },
      select: { orderId: true },
      distinct: ['orderId'],
    });

    const orders = await prisma.order.findMany({
      where: { id: { in: orderIds.map((o) => o.orderId) } },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        items: { where: { vendorId: vendor.id } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    ApiResponse.success(res, serialize(orders));
  })
);

export default router;
