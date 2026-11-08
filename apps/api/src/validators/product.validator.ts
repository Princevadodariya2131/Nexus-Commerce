import { z } from 'zod';
import { httpUrl } from './common';

/**
 * Whitelists for product writes. Anything not listed here is rejected (.strict()),
 * so server-controlled columns (id, vendorId for vendors, rating, reviewCount,
 * soldCount, timestamps) can never be set from a request body.
 */
const price = z.coerce.number().finite().positive().max(9_999_999.99);
const money = z.coerce.number().finite().min(0).max(9_999_999.99);
const positiveInt = z.coerce.number().int().positive();
const count = z.coerce.number().int().min(0).max(1_000_000);

const imageSchema = z
  .object({
    url: httpUrl,
    alt: z.string().max(255).optional(),
    isPrimary: z.boolean().optional(),
  })
  .strict();

const variantSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    options: z.array(z.string().trim().min(1).max(100)).max(50),
  })
  .strict();

const keywordList = z.array(z.string().trim().min(1).max(50)).max(30);

// JSON columns use .optional() (not .nullish()): Prisma needs JsonNull to clear
// them, so "send [] to clear" is the supported behaviour.
const vendorShape = {
  name: z.string().trim().min(1).max(255),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug may only contain lowercase letters, digits and hyphens'),
  description: z.string().trim().min(1).max(20000),
  shortDescription: z.string().trim().max(500).nullish(),
  sku: z.string().trim().min(1).max(100),
  price,
  compareAtPrice: price.nullish(),
  costPrice: money.nullish(),
  images: z.array(imageSchema).max(20).optional(),
  categoryId: positiveInt,
  subcategoryId: positiveInt.nullish(),
  brand: z.string().trim().max(100).nullish(),
  tags: keywordList.optional(),
  variants: z.array(variantSchema).max(20).optional(),
  stock: count,
  lowStockThreshold: count,
  weight: z.coerce.number().finite().min(0).max(99_999_999).nullish(),
  isActive: z.boolean(),
  seoTitle: z.string().trim().max(255).nullish(),
  seoDescription: z.string().trim().max(5000).nullish(),
  seoKeywords: keywordList.optional(),
};

// Extra fields only administrators may set.
const adminShape = {
  ...vendorShape,
  isFeatured: z.boolean(),
  vendorId: positiveInt.nullable(),
};

const REQUIRED_ON_CREATE = {
  name: true,
  slug: true,
  description: true,
  sku: true,
  price: true,
  categoryId: true,
} as const;

const atLeastOneField = (value: object) => Object.keys(value).length > 0;

export const vendorProductCreateSchema = z
  .object(vendorShape)
  .partial()
  .required(REQUIRED_ON_CREATE)
  .strict();

export const adminProductCreateSchema = z
  .object(adminShape)
  .partial()
  .required(REQUIRED_ON_CREATE)
  .strict();

export const vendorProductUpdateSchema = z
  .object(vendorShape)
  .partial()
  .strict()
  .refine(atLeastOneField, { message: 'At least one field is required' });

export const adminProductUpdateSchema = z
  .object(adminShape)
  .partial()
  .strict()
  .refine(atLeastOneField, { message: 'At least one field is required' });

export type AdminProductCreateInput = z.infer<typeof adminProductCreateSchema>;
export type AdminProductUpdateInput = z.infer<typeof adminProductUpdateSchema>;

/**
 * Public catalogue query string. Deliberately lenient: anything malformed (page=-1, minPrice=abc,
 * search[a]=b, repeated keys) falls back to a safe default instead of reaching the database layer.
 */
export const productListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).catch(1),
  limit: z.coerce.number().int().min(1).max(100).catch(20),
  category: z.string().trim().min(1).max(100).optional().catch(undefined),
  vendor: z.string().trim().max(20).optional().catch(undefined),
  minPrice: z.coerce.number().min(0).max(1_000_000_000).optional().catch(undefined),
  maxPrice: z.coerce.number().min(0).max(1_000_000_000).optional().catch(undefined),
  search: z.string().trim().max(100).optional().catch(undefined),
  sort: z.enum(['price-asc', 'price-desc', 'popular', 'rating', 'newest']).optional().catch(undefined),
  featured: z.enum(['true', 'false']).optional().catch(undefined),
});
