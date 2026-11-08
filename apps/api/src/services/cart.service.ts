import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { serialize } from '../utils/serialize';

const cartInclude = {
  items: {
    include: {
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          price: true,
          images: true,
          stock: true,
          isActive: true,
        },
      },
    },
  },
  coupon: true,
};

async function getOrCreateCart(userId: number) {
  let cart = await prisma.cart.findUnique({
    where: { userId },
    include: cartInclude,
  });
  if (!cart) {
    cart = await prisma.cart.create({
      data: { userId },
      include: cartInclude,
    });
  }
  return cart;
}

function mapCartForApi(cart: Awaited<ReturnType<typeof getOrCreateCart>>) {
  const serialized = serialize(cart);
  return {
    ...serialized,
    _id: String(cart.id),
    items: cart.items.map((item) => ({
      ...serialize(item),
      product: {
        ...serialize(item.product),
        _id: String(item.product.id),
      },
    })),
  };
}

export const cartService = {
  async getCart(userId: string) {
    const cart = await getOrCreateCart(parseInt(userId, 10));
    return mapCartForApi(cart);
  },

  async addItem(userId: string, productId: string, quantity = 1, variant?: string) {
    const uid = parseInt(userId, 10);
    const pid = parseInt(productId, 10);
    const product = await prisma.product.findUnique({ where: { id: pid } });
    if (!product || !product.isActive) throw new AppError('Product not found', 404);
    if (product.stock < quantity) throw new AppError('Insufficient stock', 400);

    const cart = await getOrCreateCart(uid);
    const existing = await prisma.cartItem.findFirst({
      where: { cartId: cart.id, productId: pid, variant: variant ?? null },
    });

    if (existing) {
      await prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + quantity },
      });
    } else {
      await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId: pid,
          quantity,
          variant: variant ?? null,
          price: product.price,
        },
      });
    }

    return this.getCart(userId);
  },

  async updateItem(userId: string, productId: string, quantity: number) {
    const cart = await getOrCreateCart(parseInt(userId, 10));
    const pid = parseInt(productId, 10);

    const item = await prisma.cartItem.findFirst({
      where: { cartId: cart.id, productId: pid },
    });
    if (!item) throw new AppError('Item not in cart', 404);

    if (quantity <= 0) {
      await prisma.cartItem.delete({ where: { id: item.id } });
    } else {
      await prisma.cartItem.update({
        where: { id: item.id },
        data: { quantity },
      });
    }

    return this.getCart(userId);
  },

  async removeItem(userId: string, productId: string) {
    const cart = await getOrCreateCart(parseInt(userId, 10));
    await prisma.cartItem.deleteMany({
      where: { cartId: cart.id, productId: parseInt(productId, 10) },
    });
    return this.getCart(userId);
  },

  async clearCart(userId: string) {
    const cart = await getOrCreateCart(parseInt(userId, 10));
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    await prisma.cart.update({
      where: { id: cart.id },
      data: { couponId: null },
    });
  },
};
