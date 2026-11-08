import { z } from 'zod';
import { httpUrl } from './common';

export const updateUserStatusSchema = z.object({ isActive: z.boolean() }).strict();

export const updateVendorStatusSchema = z
  .object({
    status: z.enum(['pending', 'approved', 'rejected', 'suspended']),
    isVerified: z.boolean().optional(),
  })
  .strict();

export const moderateReviewSchema = z.object({ isApproved: z.boolean() }).strict();

const money = (max: number) => z.coerce.number().min(0).max(max);

export const createCouponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(3)
      .max(50)
      .regex(/^[A-Za-z0-9_-]+$/, 'code may only contain letters, digits, "-" and "_"')
      .transform((value) => value.toUpperCase()),
    description: z.string().trim().max(500).optional(),
    type: z.enum(['percentage', 'fixed']),
    value: z.coerce.number().positive().max(1_000_000),
    minOrderAmount: money(1_000_000_000).optional(),
    maxDiscount: money(1_000_000_000).optional(),
    usageLimit: z.coerce.number().int().positive().max(1_000_000_000).optional(),
    perUserLimit: z.coerce.number().int().positive().max(1000).optional(),
    validFrom: z.coerce.date(),
    validUntil: z.coerce.date(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .superRefine((coupon, ctx) => {
    if (coupon.type === 'percentage' && coupon.value > 100) {
      ctx.addIssue({ code: 'custom', path: ['value'], message: 'A percentage coupon cannot exceed 100' });
    }
    if (coupon.validUntil.getTime() <= coupon.validFrom.getTime()) {
      ctx.addIssue({ code: 'custom', path: ['validUntil'], message: 'validUntil must be after validFrom' });
    }
  });

const bannerLink = z
  .string()
  .trim()
  .max(500)
  .refine((value) => /^https?:\/\//i.test(value) || /^\/(?!\/)/.test(value), {
    message: 'link must be an http(s) URL or a site-relative path',
  });

export const createBannerSchema = z
  .object({
    title: z.string().trim().min(1).max(255),
    subtitle: z.string().trim().max(500).optional(),
    image: httpUrl,
    mobileImage: httpUrl.optional(),
    link: bannerLink.optional(),
    position: z.string().trim().regex(/^[a-z][a-z-]{0,19}$/).optional(),
    sortOrder: z.coerce.number().int().min(0).max(10000).optional(),
    isActive: z.boolean().optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
  })
  .strict();
