import { z } from 'zod';

// A negative or fractional quantity would produce a negative order total, so
// quantities are always positive integers within a sane upper bound.
export const addCartItemSchema = z.object({
  productId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().min(1).max(100).default(1),
  variant: z.string().trim().max(100).optional(),
});

// 0 removes the item (existing behaviour of cartService.updateItem).
export const updateCartItemSchema = z.object({
  quantity: z.coerce.number().int().min(0).max(100),
});
