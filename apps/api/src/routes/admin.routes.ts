import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import { authenticate, authorize } from '../middleware/auth';
import { ROLES } from '@nexus/shared';
import { auditLog } from '../middleware/auditLog';
import { validate } from '../middleware/validate';
import {
  createBannerSchema,
  createCouponSchema,
  moderateReviewSchema,
  updateUserStatusSchema,
  updateVendorStatusSchema,
} from '../validators/admin.validator';

const router = Router();

router.use(authenticate, authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN));

router.get('/dashboard', adminController.getDashboard);
router.get('/analytics/revenue', adminController.getRevenueChart);
router.get('/users', adminController.getUsers);
router.patch('/users/:id', validate(updateUserStatusSchema), auditLog('update', 'user'), adminController.updateUserStatus);
router.get('/vendors', adminController.getVendors);
router.patch('/vendors/:id', validate(updateVendorStatusSchema), auditLog('update', 'vendor'), adminController.updateVendorStatus);
router.get('/reviews', adminController.getReviews);
router.patch('/reviews/:id', validate(moderateReviewSchema), auditLog('moderate', 'review'), adminController.moderateReview);
router.get('/coupons', adminController.getCoupons);
router.post('/coupons', validate(createCouponSchema), auditLog('create', 'coupon'), adminController.createCoupon);
router.get('/banners', adminController.getBanners);
router.post('/banners', validate(createBannerSchema), auditLog('create', 'banner'), adminController.createBanner);

export default router;
