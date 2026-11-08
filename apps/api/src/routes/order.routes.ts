import { Router } from 'express';
import { orderController } from '../controllers/order.controller';
import { authenticate, authorize } from '../middleware/auth';
import { requireVendorContext } from '../middleware/vendor';
import { validate } from '../middleware/validate';
import { createOrderSchema, updateOrderStatusSchema } from '../validators/order.validator';
import { ROLES } from '@nexus/shared';

const router = Router();

router.get('/track/:orderNumber', orderController.trackOrder);

router.get(
  '/admin/all',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  orderController.getAllOrders
);

router.use(authenticate);

router.post('/', validate(createOrderSchema), orderController.createOrder);
router.get('/my', orderController.getMyOrders);
router.get('/:id', orderController.getOrder);
router.patch(
  '/:id/status',
  authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.VENDOR),
  requireVendorContext,
  validate(updateOrderStatusSchema),
  orderController.updateStatus
);

export default router;
