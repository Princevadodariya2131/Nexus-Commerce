import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { checkReadiness } from '../lib/health';
import authRoutes from './auth.routes';
import productRoutes from './product.routes';
import cartRoutes from './cart.routes';
import orderRoutes from './order.routes';
import adminRoutes from './admin.routes';
import vendorRoutes from './vendor.routes';
import wishlistRoutes from './wishlist.routes';
import reviewRoutes from './review.routes';
import aiRoutes from './ai.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/products', productRoutes);
router.use('/cart', cartRoutes);
router.use('/orders', orderRoutes);
router.use('/admin', adminRoutes);
router.use('/vendor', vendorRoutes);
router.use('/wishlist', wishlistRoutes);
router.use('/reviews', reviewRoutes);
router.use('/ai', aiRoutes);

// Liveness: the process is up (no dependencies are checked).
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Readiness: the instance can serve traffic (database reachable). Use this for load balancer checks.
router.get('/health/ready', async (_req, res) => {
  const result = await checkReadiness(prisma);
  res.status(result.ok ? 200 : 503).json({
    status: result.ok ? 'ready' : 'unavailable',
    checks: result.checks,
    timestamp: new Date().toISOString(),
  });
});

export default router;
