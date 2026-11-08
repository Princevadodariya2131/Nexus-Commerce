import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { serialize } from '../utils/serialize';
import { ROLES } from '@nexus/shared';
import type { PaginationMeta } from '@nexus/shared';
import type { AdminProductCreateInput, AdminProductUpdateInput } from '../validators/product.validator';

export interface ProductActor {
  role: string;
  /** Vendor id resolved from the database by requireVendorContext (never from the JWT). */
  vendorId?: number;
}

/** Defense in depth: even if a route forgets requireVendorContext, a vendor without a vendor id is denied. */
const assertCanWriteProducts = (actor: ProductActor): void => {
  if (actor.role === ROLES.ADMIN || actor.role === ROLES.SUPER_ADMIN) return;
  if (actor.role === ROLES.VENDOR && actor.vendorId) return;
  throw new AppError('Insufficient permissions', 403);
};

const parseProductId = (id: string): number => {
  const parsed = parseInt(id, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new AppError('Product not found', 404);
  return parsed;
};

/** Explicit field mapping: only whitelisted columns can ever reach Prisma. */
const productFields = (input: Partial<AdminProductCreateInput>) => ({
  name: input.name,
  slug: input.slug,
  description: input.description,
  shortDescription: input.shortDescription,
  sku: input.sku,
  price: input.price,
  compareAtPrice: input.compareAtPrice,
  costPrice: input.costPrice,
  images: input.images as Prisma.InputJsonValue | undefined,
  categoryId: input.categoryId,
  subcategoryId: input.subcategoryId,
  brand: input.brand,
  tags: input.tags as Prisma.InputJsonValue | undefined,
  variants: input.variants as Prisma.InputJsonValue | undefined,
  stock: input.stock,
  lowStockThreshold: input.lowStockThreshold,
  weight: input.weight,
  isActive: input.isActive,
  isFeatured: input.isFeatured,
  seoTitle: input.seoTitle,
  seoDescription: input.seoDescription,
  seoKeywords: input.seoKeywords as Prisma.InputJsonValue | undefined,
});

interface ProductFilters {
  page?: number;
  limit?: number;
  category?: string;
  vendor?: string;
  minPrice?: number;
  maxPrice?: number;
  search?: string;
  sort?: string;
  featured?: boolean;
}

const productInclude = {
  category: { select: { id: true, name: true, slug: true } },
  vendor: { select: { id: true, businessName: true, slug: true, logo: true, rating: true } },
};

type ProductRecord = Awaited<ReturnType<typeof prisma.product.findFirst>> & object;

function mapProduct<T extends ProductRecord>(product: T) {
  const serialized = serialize(product) as T & { id: number };
  return {
    ...serialized,
    _id: String(serialized.id),
  };
}

function mapProducts<T extends ProductRecord>(products: T[]) {
  return products.map(mapProduct);
}

export const productService = {
  async getProducts(filters: ProductFilters) {
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = { isActive: true };

    if (filters.category) {
      const categoryId = parseInt(filters.category, 10);
      if (!Number.isNaN(categoryId) && categoryId > 0) {
        where.categoryId = categoryId;
      } else {
        where.category = { slug: filters.category, isActive: true };
      }
    }
    if (filters.vendor) where.vendorId = parseInt(filters.vendor, 10) || undefined;
    if (filters.featured) where.isFeatured = true;
    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      where.price = {};
      if (filters.minPrice !== undefined) where.price.gte = filters.minPrice;
      if (filters.maxPrice !== undefined) where.price.lte = filters.maxPrice;
    }
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search } },
        { description: { contains: filters.search } },
      ];
    }

    const orderBy: Prisma.ProductOrderByWithRelationInput =
      filters.sort === 'price-asc'
        ? { price: 'asc' }
        : filters.sort === 'price-desc'
          ? { price: 'desc' }
          : filters.sort === 'popular'
            ? { soldCount: 'desc' }
            : filters.sort === 'rating'
              ? { rating: 'desc' }
              : { createdAt: 'desc' };

    const [products, total] = await Promise.all([
      prisma.product.findMany({ where, include: productInclude, orderBy, skip, take: limit }),
      prisma.product.count({ where }),
    ]);

    const meta: PaginationMeta = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    };

    return { products: mapProducts(products), meta };
  },

  async getProductBySlug(slug: string) {
    const product = await prisma.product.findFirst({
      where: { slug, isActive: true },
      include: productInclude,
    });
    if (!product) throw new AppError('Product not found', 404);
    return mapProduct(product);
  },

  async getFeatured() {
    const products = await prisma.product.findMany({
      where: { isFeatured: true, isActive: true },
      include: productInclude,
      take: 12,
    });
    return mapProducts(products);
  },

  async getRecommendations(_userId?: string, productId?: string) {
    const where: Prisma.ProductWhereInput = { isActive: true };
    if (productId) {
      const product = await prisma.product.findUnique({
        where: { id: parseInt(productId, 10) },
      });
      if (product) {
        where.categoryId = product.categoryId;
        where.id = { not: product.id };
      }
    }
    const products = await prisma.product.findMany({
      where,
      include: productInclude,
      orderBy: [{ rating: 'desc' }, { soldCount: 'desc' }],
      take: 8,
    });
    return mapProducts(products);
  },

  async createProduct(input: AdminProductCreateInput, actor: ProductActor) {
    assertCanWriteProducts(actor);
    // Vendors always own what they create; only administrators may name a vendor.
    const vendorId = actor.role === ROLES.VENDOR ? actor.vendorId : input.vendorId ?? undefined;
    const product = await prisma.product.create({
      data: { ...productFields(input), vendorId } as Prisma.ProductUncheckedCreateInput,
    });
    return serialize(product);
  },

  async updateProduct(id: string, input: AdminProductUpdateInput, actor: ProductActor) {
    assertCanWriteProducts(actor);
    const productId = parseProductId(id);
    if (actor.role === ROLES.VENDOR) {
      const existing = await prisma.product.findFirst({
        where: { id: productId, vendorId: actor.vendorId },
      });
      if (!existing) throw new AppError('Product not found', 404);
    }
    const product = await prisma.product.update({
      where: { id: productId },
      data: {
        ...productFields(input),
        // Only administrators can reassign a product (the vendor schema has no vendorId).
        ...(actor.role !== ROLES.VENDOR && input.vendorId !== undefined
          ? { vendorId: input.vendorId }
          : {}),
      } as Prisma.ProductUncheckedUpdateInput,
    });
    return serialize(product);
  },

  async deleteProduct(id: string, actor: ProductActor) {
    assertCanWriteProducts(actor);
    const productId = parseProductId(id);
    if (actor.role === ROLES.VENDOR) {
      const existing = await prisma.product.findFirst({
        where: { id: productId, vendorId: actor.vendorId },
      });
      if (!existing) throw new AppError('Product not found', 404);
    }
    await prisma.product.update({
      where: { id: productId },
      data: { isActive: false },
    });
  },

  async getCategories() {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: { select: { products: { where: { isActive: true } } } },
      },
    });
    return serialize(
      categories.map(({ _count, ...cat }) => ({
        ...cat,
        productCount: _count.products,
      }))
    );
  },
};
