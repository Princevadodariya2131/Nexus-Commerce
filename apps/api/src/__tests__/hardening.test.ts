import { db } from './helpers/testkit';
import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { Prisma } from '@prisma/client';
import { config } from '../config';
import { calculateDiscount, isPerUserLimitReached } from '../utils/coupon';
import { parseIdParam } from '../utils/ids';
import { productListQuerySchema } from '../validators/product.validator';
import { createBannerSchema, createCouponSchema } from '../validators/admin.validator';
import { vendorOnboardSchema } from '../validators/vendor.validator';
import { isTransitionAllowed, shouldRestockOnTransition } from '../policies/orderPolicy';
import { orderService } from '../services/order.service';
import { authService } from '../services/auth.service';
import { errorHandler } from '../middleware/errorHandler';

const status = (error: any) => error.statusCode;

describe('coupon money rules', () => {
  it('a fixed coupon larger than the subtotal discounts only the subtotal (total can not go negative)', () => {
    assert.equal(calculateDiscount(25.5, { type: 'fixed', value: 500 }), 25.5);
  });
  it('percentage coupons are capped at 100% and by maxDiscount', () => {
    assert.equal(calculateDiscount(200, { type: 'percentage', value: 250 }), 200);
    assert.equal(calculateDiscount(200, { type: 'percentage', value: 50, maxDiscount: 30 }), 30);
    assert.equal(calculateDiscount(100, { type: 'percentage', value: 15 }), 15);
  });
  it('zero, negative, non-numeric values and empty carts give no discount', () => {
    assert.equal(calculateDiscount(100, { type: 'fixed', value: 0 }), 0);
    assert.equal(calculateDiscount(100, { type: 'fixed', value: -5 }), 0);
    assert.equal(calculateDiscount(100, { type: 'fixed', value: 'abc' }), 0);
    assert.equal(calculateDiscount(0, { type: 'fixed', value: 10 }), 0);
  });
  it('per-user limit', () => {
    assert.equal(isPerUserLimitReached(0, 1), false);
    assert.equal(isPerUserLimitReached(1, 1), true);
    assert.equal(isPerUserLimitReached(5, null), false);
  });
});

describe('parseIdParam', () => {
  it('accepts positive integers', () => assert.equal(parseIdParam('42'), 42));
  it('rejects everything else with a clean 404', () => {
    for (const bad of ['abc', '-1', '0', '1.5', '', '007', '99999999999', undefined, ['1'], {}, '1; DROP']) {
      assert.throws(() => parseIdParam(bad as never), (e: any) => status(e) === 404, `should reject ${JSON.stringify(bad)}`);
    }
  });
});

describe('public product list query', () => {
  it('hostile or malformed values fall back to safe defaults instead of failing', () => {
    const q = productListQuerySchema.parse({ page: '-1', limit: 'abc', minPrice: 'abc', maxPrice: '-4', search: { a: 'b' }, category: { a: 'b' }, sort: 'zzz', vendor: ['x'], featured: 'maybe' });
    assert.deepEqual(q, { page: 1, limit: 20, category: undefined, vendor: undefined, minPrice: undefined, maxPrice: undefined, search: undefined, sort: undefined, featured: undefined });
  });
  it('limit is capped at 100 and valid values pass through', () => {
    assert.equal(productListQuerySchema.parse({ limit: '100000' }).limit, 20);
    const q = productListQuerySchema.parse({ page: '3', limit: '50', minPrice: '5', maxPrice: '90', search: ' lamp ', sort: 'price-asc', featured: 'true' });
    assert.equal(q.page, 3); assert.equal(q.limit, 50); assert.equal(q.minPrice, 5); assert.equal(q.search, 'lamp'); assert.equal(q.sort, 'price-asc'); assert.equal(q.featured, 'true');
  });
});

describe('admin coupon / banner / vendor-onboarding validation', () => {
  const valid = { code: 'save10', type: 'percentage', value: 10, validFrom: '2026-01-01', validUntil: '2027-01-01' };
  it('accepts a valid coupon and upper-cases the code', () => assert.equal(createCouponSchema.parse(valid).code, 'SAVE10'));
  it('rejects empty bodies, bad types, >100% percentages, inverted dates, unknown fields', () => {
    for (const bad of [{}, { ...valid, value: -5 }, { ...valid, value: 0 }, { ...valid, type: 'x' }, { ...valid, value: 150 }, { ...valid, validUntil: '2025-01-01' }, { ...valid, usedCount: 999 }, { ...valid, code: 'a b' }, { ...valid, id: 1 }]) {
      assert.equal(createCouponSchema.safeParse(bad).success, false, JSON.stringify(bad));
    }
  });
  it('banner: requires title + http(s) image, rejects javascript: and data: URLs and unknown fields', () => {
    assert.equal(createBannerSchema.safeParse({ title: 'Sale', image: 'https://example.com/a.png', link: '/shop' }).success, true);
    for (const bad of [{}, { title: 'x', image: 'javascript:alert(1)' }, { title: 'x', image: 'https://e.com/a.png', link: 'javascript:alert(1)' }, { title: 'x', image: 'https://e.com/a.png', link: '//evil.com' }, { title: 'x', image: 'https://e.com/a.png', id: 3 }]) {
      assert.equal(createBannerSchema.safeParse(bad).success, false, JSON.stringify(bad));
    }
  });
  it('vendor onboarding requires a business name and rejects unknown fields (no status/commission smuggling)', () => {
    assert.equal(vendorOnboardSchema.safeParse({ businessName: 'Acme Co' }).success, true);
    for (const bad of [{}, { businessName: 'A' }, { businessName: 'Acme', status: 'approved' }, { businessName: 'Acme', commissionRate: 0 }, { businessName: 12 }]) {
      assert.equal(vendorOnboardSchema.safeParse(bad).success, false, JSON.stringify(bad));
    }
  });
});

describe('order status transitions', () => {
  it('restock only when cancelling an order that has not shipped', () => {
    for (const from of ['pending', 'confirmed', 'processing']) assert.equal(shouldRestockOnTransition(from, 'cancelled'), true);
    for (const from of ['shipped', 'delivered', 'cancelled', 'refunded']) assert.equal(shouldRestockOnTransition(from, 'cancelled'), false);
    assert.equal(shouldRestockOnTransition('pending', 'shipped'), false);
  });
  it('cancelled/refunded orders are not resurrected; only an admin may refund a cancelled order', () => {
    assert.equal(isTransitionAllowed('cancelled', 'shipped', false), false);
    assert.equal(isTransitionAllowed('cancelled', 'shipped', true), false);
    assert.equal(isTransitionAllowed('cancelled', 'refunded', false), false);
    assert.equal(isTransitionAllowed('cancelled', 'refunded', true), true);
    assert.equal(isTransitionAllowed('refunded', 'pending', true), false);
    assert.equal(isTransitionAllowed('pending', 'shipped', false), true);
  });
});

describe('order cancellation puts stock back exactly once', () => {
  beforeEach(() => {
    db.reset();
    db.addUser({ id: 1, role: 'admin' });
    db.addProduct({ id: 1, stock: 5, soldCount: 3 });
    db.addProduct({ id: 2, stock: 0, soldCount: 7 });
    db.addOrder({ id: 100, userId: 4, couponId: null }, [10, 10]);
  });
  it('cancel restocks each line, and a second cancel / un-cancel is refused with nothing written', async () => {
    await orderService.updateOrderStatus('100', 'cancelled', { role: 'admin' });
    assert.equal(db.products.find((p) => p.id === 1)!.stock, 6);
    assert.equal(db.products.find((p) => p.id === 1)!.soldCount, 2);
    assert.equal(db.products.find((p) => p.id === 2)!.stock, 1);
    const writes = db.writeCount;
    await assert.rejects(() => orderService.updateOrderStatus('100', 'shipped', { role: 'admin' }), (e: any) => status(e) === 409);
    assert.equal(db.writeCount, writes);
    assert.equal(db.products.find((p) => p.id === 1)!.stock, 6);
  });
  it('shipping then cancelling does not auto-restock goods that already left', async () => {
    await orderService.updateOrderStatus('100', 'shipped', { role: 'admin' });
    await orderService.updateOrderStatus('100', 'cancelled', { role: 'admin' });
    assert.equal(db.products.find((p) => p.id === 1)!.stock, 5);
  });
});

describe('refresh tokens', () => {
  const sign = (userId: number) => jwt.sign({ userId: String(userId), email: 'a@b.test', role: 'customer' }, config.jwt.refreshSecret, { expiresIn: '1h', jwtid: `t-${Math.random()}` });
  beforeEach(() => db.reset());

  it('missing, empty, non-string and garbage tokens are 401 (never a 500)', async () => {
    for (const bad of [undefined, null, '', 'garbage', 123, { a: 1 }, jwt.sign({ userId: '1' }, 'wrong-secret')]) {
      await assert.rejects(() => authService.refreshToken(bad as never), (e: any) => status(e) === 401, JSON.stringify(bad));
    }
  });
  it('a deactivated account cannot mint new tokens', async () => {
    const token = sign(7);
    db.addUser({ id: 7, email: 'a@b.test', role: 'customer', isActive: false, vendorId: null, refreshToken: token });
    await assert.rejects(() => authService.refreshToken(token), (e: any) => status(e) === 401);
  });
  it('rotation: the new token works once and the old one is dead, even within the same second', async () => {
    const token = sign(8);
    db.addUser({ id: 8, email: 'a@b.test', role: 'customer', isActive: true, vendorId: null, refreshToken: token });
    const next = await authService.refreshToken(token);
    assert.notEqual(next.refreshToken, token);
    assert.equal(db.users.find((u) => u.id === 8)!.refreshToken, next.refreshToken);
    await assert.rejects(() => authService.refreshToken(token), (e: any) => status(e) === 401);
  });
});

describe('error handler maps client-side data errors to 4xx', () => {
  const run = (err: Error) => {
    const out: { code?: number } = {};
    const res: any = { status(c: number) { out.code = c; return res; }, json() { return res; } };
    errorHandler(err, {} as never, res, (() => undefined) as never);
    return out.code;
  };
  it('PrismaClientValidationError -> 400, write conflict P2034 -> 409', () => {
    assert.equal(run(new Prisma.PrismaClientValidationError('bad', { clientVersion: 'x' })), 400);
    assert.equal(run(new Prisma.PrismaClientKnownRequestError('conflict', { code: 'P2034', clientVersion: 'x' })), 409);
  });
  it('unknown errors are still 500', () => assert.equal(run(new Error('boom')), 500));
});
