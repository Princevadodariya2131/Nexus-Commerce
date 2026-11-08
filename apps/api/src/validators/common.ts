import { z } from 'zod';

/** A URL that is safe to render as an image/link target: http(s) only (no javascript:, data:, file: ...). */
export const httpUrl = z
  .string()
  .max(500)
  .url()
  .refine((value) => /^https?:\/\//i.test(value), { message: 'URL must start with http:// or https://' });
