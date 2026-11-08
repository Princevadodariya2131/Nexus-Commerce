import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { emailService } from './email.service';
import { serialize } from '../utils/serialize';
import { ROLES } from '@nexus/shared';
import type { Coupon } from '@prisma/client';
import { calculateDiscount, isPerUserLimitReached, round2 } from '../utils/coupon';
import { parseIdParam } from '../utils/ids';
import type { PaginationMeta } from '@nexus/shared';
import {
  VENDOR_SETTABLE_STATUSES,
  decideVendorOrderAccess,
  isTransitionAllowed,
  shouldRestockOnTransition,
  type OrderStatusValue,
} from '../policies/orderPolicy';

export interface OrderActor {
  role: string;
  /** Vendor id resolved from the database by requireVendorContext (never from the JWT). */
  vendorId?: number;
}

export const orderService = {
  async createFromCart(
    userId: string,
    shippingAddress: Record<string, string>,
    paymentMethod: string,
    couponCode?: string
  ) {
    const uid = parseInt(userId, 10);
    const cart = await prisma.cart.findUnique({
      where: { userId: uid },
      include: {
        items: { include: { product: true } },
        coupon: true,
      },
    });

    if (!cart || !cart.items.length) {
      throw new AppError('Cart is empty', 400);
    }
    // A zero/negative quantity would reduce the order total; never trust stored cart rows blindly.
    if (cart.items.some((item) => !Number.isInteger(item.quantity) || item.quantity < 1)) {
      throw new AppError('Cart contains an invalid quantity', 400);
    }

    let coupon: Coupon | null = null;
    if (couponCode) {
      coupon = await prisma.coupon.findFirst({
        where: {
          code: couponCode.toUpperCase(),
          isActive: true,
          validFrom: { lte: new Date() },
          validUntil: { gte: new Date() },
        },
      });
      if (!coupon) throw new AppError('Invalid coupon', 400);
      if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
        throw new AppError('Coupon usage limit reached', 400);
      }
      const timesUsed = await prisma.order.count({
        where: { userId: uid, couponId: coupon.id, status: { notIn: ['cancelled', 'refunded'] } },
      });
      if (isPerUserLimitReached(timesUsed, coupon.perUserLimit)) {
        throw new AppError('You have already used this coupon the maximum number of times', 400);
      }
    }
    const couponId = coupon ? coupon.id : null;

    let subtotal = 0;
    const orderItems: {
      productId: number;
      vendorId: number | null;
      name: string;
      sku: string;
      image: string | null;
      price: number;
      quantity: number;
      variant: string | null;
    }[] = [];

    for (const item of cart.items) {
      const product = item.product;
      if (!product.isActive) throw new AppError(`Product unavailable: ${product.name}`, 400);
      if (product.stock < item.quantity) {
        throw new AppError(`Insufficient stock for ${product.name}`, 409);
      }

      // Always charge the CURRENT catalogue price; the price stored on the cart row can be stale.
      const price = Number(product.price);
      subtotal += price * item.quantity;

      const images = product.images as { url: string; isPrimary?: boolean }[] | null;
      const primary = images?.find((i) => i.isPrimary) || images?.[0];

      orderItems.push({
        productId: product.id,
        vendorId: product.vendorId,
        name: product.name,
        sku: product.sku,
        image: primary?.url ?? null,
        price,
        quantity: item.quantity,
        variant: item.variant,
      });
    }
    subtotal = round2(subtotal);

    if (coupon?.minOrderAmount && subtotal < Number(coupon.minOrderAmount)) {
      throw new AppError(`Minimum order amount: $${coupon.minOrderAmount}`, 400);
    }

    // Clamped to the subtotal: a coupon can never push the total below shipping + tax.
    const discount = coupon ? calculateDiscount(subtotal, coupon) : 0;
    const tax = round2(subtotal * 0.08);
    const shipping = subtotal > 100 ? 0 : 9.99;
    const total = round2(subtotal - discount + tax + shipping);

    const orderNumber = `NX-${Date.now().toString(36).toUpperCase()}-${uuidv4().slice(0, 4).toUpperCase()}`;

    const order = await prisma.$transaction(async (tx) => {
      // Reserve stock atomically. The condition lives in the UPDATE itself, so two concurrent checkouts
      // of the last unit cannot both succeed (the check above is only a friendly early message).
      // Rows are locked in id order so concurrent multi-item orders cannot deadlock each other.
      const lines = [...orderItems].sort((a, b) => a.productId - b.productId);
      for (const line of lines) {
        const reserved = await tx.product.updateMany({
          where: { id: line.productId, isActive: true, stock: { gte: line.quantity } },
          data: { stock: { decrement: line.quantity }, soldCount: { increment: line.quantity } },
        });
        if (reserved.count !== 1) throw new AppError(`Insufficient stock for ${line.name}`, 409);
      }

      if (coupon) {
        const claimed = await tx.coupon.updateMany({
          where: {
            id: coupon.id,
            isActive: true,
            ...(coupon.usageLimit ? { usedCount: { lt: coupon.usageLimit } } : {}),
          },
          data: { usedCount: { increment: 1 } },
        });
        if (claimed.count !== 1) throw new AppError('Coupon usage limit reached', 400);
      }

      const created = await tx.order.create({
        data: {
          orderNumber,
          userId: uid,
          subtotal,
          discount,
          tax,
          shipping,
          total,
          couponId,
          shipStreet: shippingAddress.street,
          shipCity: shippingAddress.city,
          shipState: shippingAddress.state,
          shipCountry: shippingAddress.country,
          shipZipCode: shippingAddress.zipCode,
          shipPhone: shippingAddress.phone,
          paymentMethod: paymentMethod as 'stripe' | 'razorpay' | 'cod',
          status: 'pending',
          paymentStatus: 'pending',
          items: { create: orderItems },
          statusHistory: { create: { status: 'pending', note: 'Order placed' } },
        },
        include: { items: true, statusHistory: true },
      });

      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      await tx.cart.update({ where: { id: cart.id }, data: { couponId: null } });

      return created;
    });

    const user = await prisma.user.findUnique({ where: { id: uid } });
    if (user) {
      await emailService.sendOrderConfirmation(user.email, order.orderNumber, Number(order.total));
    }

    return serialize(order);
  },

  async getUserOrders(userId: string, page = 1, limit = 10) {
    const uid = parseInt(userId, 10);
    const skip = (page - 1) * limit;
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: { userId: uid },
        include: { items: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.order.count({ where: { userId: uid } }),
    ]);

    const meta: PaginationMeta = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    };

    return { orders: serialize(orders), meta };
  },

  async getOrderById(orderId: string, userId: string) {
    const order = await prisma.order.findFirst({
      where: { id: parseIdParam(orderId, 'Order'), userId: parseInt(userId, 10) },
      include: { items: true, statusHistory: true },
    });
    if (!order) throw new AppError('Order not found', 404);
    return serialize(order);
  },

  async trackOrder(orderNumber: string) {
    const order = await prisma.order.findUnique({
      where: { orderNumber },
      select: {
        orderNumber: true,
        status: true,
        trackingNumber: true,
        trackingUrl: true,
        total: true,
        createdAt: true,
        statusHistory: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!order) throw new AppError('Order not found', 404);
    return serialize(order);
  },

  async updateOrderStatus(
    orderId: string,
    status: OrderStatusValue,
    actor: OrderActor,
    note?: string
  ) {
    const id = parseIdParam(orderId, 'Order');

    if (actor.role === ROLES.VENDOR) {
      // Vendors may only change orders that consist entirely of their own items.
      if (!actor.vendorId) {
        throw new AppError('A vendor profile is required for this action', 403);
      }
      if (!VENDOR_SETTABLE_STATUSES.includes(status)) {
        throw new AppError('Vendors cannot set this order status', 403);
      }
      const items = await prisma.orderItem.findMany({
        where: { orderId: id },
        select: { vendorId: true },
      });
      const decision = decideVendorOrderAccess(actor.vendorId, items);
      if (decision === 'not_found') throw new AppError('Order not found', 404);
      if (decision === 'mixed_order') {
        throw new AppError(
          'This order contains items from other vendors. Ask an administrator to update it.',
          403
        );
      }
    } else if (actor.role !== ROLES.ADMIN && actor.role !== ROLES.SUPER_ADMIN) {
      // Default deny for every other role.
      throw new AppError('Insufficient permissions', 403);
    }

    const isAdmin = actor.role === ROLES.ADMIN || actor.role === ROLES.SUPER_ADMIN;
    const order = await prisma.$transaction(async (tx) => {
      const current = await tx.order.findUnique({
        where: { id },
        select: { status: true, couponId: true, items: { select: { productId: true, quantity: true } } },
      });
      if (!current) throw new AppError('Order not found', 404);
      if (!isTransitionAllowed(current.status, status, isAdmin)) {
        throw new AppError(`A ${current.status} order cannot be changed to ${status}`, 409);
      }

      if (shouldRestockOnTransition(current.status, status)) {
        for (const line of [...current.items].sort((a, b) => a.productId - b.productId)) {
          await tx.product.update({
            where: { id: line.productId },
            data: { stock: { increment: line.quantity }, soldCount: { decrement: line.quantity } },
          });
        }
        if (current.couponId) {
          await tx.coupon.updateMany({
            where: { id: current.couponId, usedCount: { gt: 0 } },
            data: { usedCount: { decrement: 1 } },
          });
        }
      }

      return tx.order.update({
        where: { id },
        data: {
          status,
          statusHistory: { create: { status, note } },
        },
        include: { items: true, statusHistory: true },
      });
    });
    return serialize(order);
  },

  async getAllOrders(filters: { status?: string; page?: number; limit?: number }) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;
    const where = filters.status ? { status: filters.status as 'pending' } : {};

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: { user: { select: { id: true, firstName: true, lastName: true, email: true } }, items: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);
    return {
      orders: serialize(orders),
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  },
};
