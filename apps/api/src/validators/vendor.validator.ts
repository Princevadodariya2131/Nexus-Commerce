import { z } from 'zod';

const text = (max: number) => z.string().trim().max(max);

export const vendorOnboardSchema = z
  .object({
    businessName: z.string().trim().min(2).max(100),
    email: z.string().trim().toLowerCase().email().max(255).optional(),
    description: text(2000).optional(),
    address: z
      .object({
        street: text(255).optional(),
        city: text(100).optional(),
        state: text(100).optional(),
        country: text(100).optional(),
        zipCode: text(20).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();
