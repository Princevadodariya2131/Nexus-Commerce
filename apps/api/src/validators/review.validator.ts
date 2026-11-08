import { z } from 'zod';

export const createReviewSchema = z.object({
  productId: z.coerce.number().int().positive(),
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().max(255).optional(),
  comment: z.string().trim().min(1).max(5000),
});
