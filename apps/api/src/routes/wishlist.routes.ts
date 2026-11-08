import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';
import { prisma } from '../lib/prisma';
import { serialize } from '../utils/serialize';
import { param } from '../utils/param';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const userId = parseInt(req.user!.userId, 10);
    const items = await prisma.wishlistItem.findMany({
      where: { userId },
      include: {
        product: {
          select: { id: true, name: true, slug: true, price: true, images: true, rating: true },
        },
      },
    });
    ApiResponse.success(res, serialize({ products: items.map((i) => i.product) }));
  })
);

router.post(
  '/:productId',
  asyncHandler(async (req, res) => {
    const userId = parseInt(req.user!.userId, 10);
    const productId = parseInt(param(req, 'productId'), 10);
    await prisma.wishlistItem.upsert({
      where: { userId_productId: { userId, productId } },
      create: { userId, productId },
      update: {},
    });
    const items = await prisma.wishlistItem.findMany({
      where: { userId },
      include: { product: true },
    });
    ApiResponse.success(res, serialize(items), 'Added to wishlist');
  })
);

router.delete(
  '/:productId',
  asyncHandler(async (req, res) => {
    const userId = parseInt(req.user!.userId, 10);
    const productId = parseInt(param(req, 'productId'), 10);
    await prisma.wishlistItem.deleteMany({ where: { userId, productId } });
    const items = await prisma.wishlistItem.findMany({
      where: { userId },
      include: { product: true },
    });
    ApiResponse.success(res, serialize(items), 'Removed from wishlist');
  })
);

export default router;
