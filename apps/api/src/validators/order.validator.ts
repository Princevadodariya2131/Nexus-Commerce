import { z } from 'zod';
import { ORDER_STATUSES } from '../policies/orderPolicy';

export const updateOrderStatusSchema = z
  .object({
    status: z.enum(ORDER_STATUSES),
    note: z.string().trim().max(500).optional(),
  })
  .strict();

export const createOrderSchema = z.object({
  shippingAddress: z.object({
    street: z.string().trim().min(1).max(255),
    city: z.string().trim().min(1).max(100),
    state: z.string().trim().min(1).max(100),
    country: z.string().trim().min(1).max(100),
    zipCode: z.string().trim().min(1).max(20),
    phone: z.string().trim().max(30).optional(),
  }),
  paymentMethod: z.enum(['stripe', 'razorpay', 'cod']).optional(),
  couponCode: z.string().trim().max(50).optional(),
});
