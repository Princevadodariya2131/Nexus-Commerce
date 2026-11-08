import { productListQuerySchema } from '../validators/product.validator';
import type { Request, Response } from 'express';
import { productService } from '../services/product.service';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { param } from '../utils/param';

// Vendor identity comes from requireVendorContext (database), never from the JWT claim.
const actorOf = (req: Request) => ({ role: req.user!.role, vendorId: req.vendor?.id });

export const productController = {
  getProducts: asyncHandler(async (req, res) => {
    const q = productListQuerySchema.parse(req.query);
    const result = await productService.getProducts({
      page: q.page,
      limit: q.limit,
      category: q.category,
      vendor: q.vendor,
      minPrice: q.minPrice,
      maxPrice: q.maxPrice,
      search: q.search,
      sort: q.sort,
      featured: q.featured === 'true',
    });
    ApiResponse.success(res, result.products, 'Products fetched', 200, result.meta);
  }),

  getProduct: asyncHandler(async (req, res) => {
    const product = await productService.getProductBySlug(param(req, 'slug'));
    ApiResponse.success(res, product);
  }),

  getFeatured: asyncHandler(async (_req, res) => {
    const products = await productService.getFeatured();
    ApiResponse.success(res, products);
  }),

  getRecommendations: asyncHandler(async (req, res) => {
    const products = await productService.getRecommendations(
      req.user?.userId,
      req.query.productId as string
    );
    ApiResponse.success(res, products);
  }),

  getCategories: asyncHandler(async (_req, res) => {
    const categories = await productService.getCategories();
    ApiResponse.success(res, categories);
  }),

  createProduct: asyncHandler(async (req, res) => {
    const product = await productService.createProduct(req.body, actorOf(req));
    ApiResponse.created(res, product);
  }),

  updateProduct: asyncHandler(async (req, res) => {
    const product = await productService.updateProduct(param(req, 'id'), req.body, actorOf(req));
    ApiResponse.success(res, product, 'Product updated');
  }),

  deleteProduct: asyncHandler(async (req, res) => {
    await productService.deleteProduct(param(req, 'id'), actorOf(req));
    ApiResponse.success(res, null, 'Product deleted');
  }),
};
