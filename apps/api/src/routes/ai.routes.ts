import { Router } from 'express';
import { optionalAuth } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';
import { prisma } from '../lib/prisma';
import { serialize } from '../utils/serialize';

const router = Router();

router.post(
  '/chat',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const message = typeof req.body?.message === 'string' ? req.body.message.slice(0, 500) : '';
    const response = generateChatResponse(message);
    ApiResponse.success(res, { reply: response, suggestions: [] });
  })
);

router.get(
  '/search-suggestions',
  asyncHandler(async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.slice(0, 100) : '';
    if (q.length < 2) {
      ApiResponse.success(res, []);
      return;
    }
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        OR: [{ name: { contains: q } }, { description: { contains: q } }],
      },
      select: { id: true, name: true, slug: true, price: true, images: true },
      take: 8,
    });
    ApiResponse.success(res, serialize(products));
  })
);

router.get(
  '/recommendations',
  optionalAuth,
  asyncHandler(async (_req, res) => {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      orderBy: [{ rating: 'desc' }, { soldCount: 'desc' }],
      take: 12,
      include: { category: { select: { name: true } } },
    });
    ApiResponse.success(res, serialize(products));
  })
);

function generateChatResponse(message: string): string {
  const lower = (message || '').toLowerCase();
  if (lower.includes('shipping')) {
    return 'We offer free shipping on orders over $100. Standard delivery takes 3-5 business days.';
  }
  if (lower.includes('return')) {
    return 'You can return items within 30 days. Visit your order history to initiate a return.';
  }
  if (lower.includes('track')) {
    return 'Track your order using the order number on our Track Order page.';
  }
  return "I'm your Nexus Commerce assistant. I can help with products, orders, shipping, and returns. What would you like to know?";
}

export default router;
