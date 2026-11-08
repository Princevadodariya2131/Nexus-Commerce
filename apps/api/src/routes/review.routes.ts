import { Router } from 'express';
import { authenticate, optionalAuth } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { serialize } from '../utils/serialize';
import { param } from '../utils/param';
import { validate } from '../middleware/validate';
import { createReviewSchema } from '../validators/review.validator';

const router = Router();

router.get(
  '/product/:productId',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const reviews = await prisma.review.findMany({
      where: {
        productId: parseInt(param(req, 'productId'), 10),
        isApproved: true,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, avatar: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    ApiResponse.success(res, serialize(reviews));
  })
);

router.post(
  '/',
  authenticate,
  validate(createReviewSchema),
  asyncHandler(async (req, res) => {
    const userId = parseInt(req.user!.userId, 10);
    const productId = parseInt(req.body.productId, 10);

    const existing = await prisma.review.findUnique({
      where: { userId_productId: { userId, productId } },
    });
    if (existing) throw new AppError('You already reviewed this product', 409);

    const review = await prisma.review.create({
      data: {
        userId,
        productId,
        rating: req.body.rating,
        title: req.body.title,
        comment: req.body.comment,
      },
    });

    const stats = await prisma.review.aggregate({
      where: { productId, isApproved: true },
      _avg: { rating: true },
      _count: true,
    });

    if (stats._avg.rating !== null) {
      await prisma.product.update({
        where: { id: productId },
        data: {
          rating: Math.round(Number(stats._avg.rating) * 10) / 10,
          reviewCount: stats._count,
        },
      });
    }

    ApiResponse.created(res, serialize(review));
  })
);

export default router;
