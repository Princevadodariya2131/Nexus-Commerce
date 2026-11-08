import { Router } from 'express';
import { productController } from '../controllers/product.controller';
import { authenticate, authorize, optionalAuth } from '../middleware/auth';
import { requireVendorContext } from '../middleware/vendor';
import { validateProductWrite } from '../middleware/productValidation';
import { ROLES } from '@nexus/shared';

const router = Router();

router.get('/', productController.getProducts);
router.get('/featured', productController.getFeatured);
router.get('/categories', productController.getCategories);
router.get('/recommendations', optionalAuth, productController.getRecommendations);
router.get('/:slug', productController.getProduct);

router.post(
  '/',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.VENDOR),
  requireVendorContext,
  validateProductWrite('create'),
  productController.createProduct
);
router.patch(
  '/:id',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.VENDOR),
  requireVendorContext,
  validateProductWrite('update'),
  productController.updateProduct
);
router.delete(
  '/:id',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.VENDOR),
  requireVendorContext,
  productController.deleteProduct
);

export default router;
