import './helpers/testkit';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  adminProductCreateSchema,
  adminProductUpdateSchema,
  vendorProductCreateSchema,
  vendorProductUpdateSchema,
} from '../validators/product.validator';
import { updateProfileSchema } from '../validators/auth.validator';
import { addCartItemSchema, updateCartItemSchema } from '../validators/cart.validator';
import { createOrderSchema, updateOrderStatusSchema } from '../validators/order.validator';
import { createReviewSchema } from '../validators/review.validator';
import {
  moderateReviewSchema,
  updateUserStatusSchema,
  updateVendorStatusSchema,
} from '../validators/admin.validator';

const validProduct = {
  name: 'Widget',
  slug: 'widget',
  description: 'A very good widget',
  sku: 'W-1',
  price: 19.99,
  categoryId: 3,
};

const rejects = (schema: { safeParse(v: unknown): { success: boolean } }, value: unknown, label: string) =>
  assert.equal(schema.safeParse(value).success, false, `should reject: ${label}`);

describe('product whitelist (vendor)', () => {
  it('accepts a valid product and coerces numeric strings', () => {
    const parsed = vendorProductCreateSchema.parse({ ...validProduct, price: '19.99', categoryId: '3', stock: '5', lowStockThreshold: 2, isActive: true });
    assert.equal(parsed.price, 19.99);
    assert.equal(parsed.categoryId, 3);
    assert.equal(parsed.stock, 5);
  });

  for (const key of ['vendorId', 'vendor', 'isFeatured', 'rating', 'reviewCount', 'soldCount', 'id', 'createdAt', 'updatedAt', 'role', 'userId']) {
    it(`rejects server-controlled field "${key}" on create`, () => {
      rejects(vendorProductCreateSchema, { ...validProduct, [key]: key === 'isFeatured' ? true : 7 }, key);
    });
    it(`rejects server-controlled field "${key}" on update`, () => {
      rejects(vendorProductUpdateSchema, { name: 'x', [key]: key === 'isFeatured' ? true : 7 }, key);
    });
  }

  it('requires name, slug, description, sku, price and categoryId on create', () => {
    for (const key of ['name', 'slug', 'description', 'sku', 'price', 'categoryId']) {
      const copy: Record<string, unknown> = { ...validProduct };
      delete copy[key];
      rejects(vendorProductCreateSchema, copy, `missing ${key}`);
    }
  });

  it('rejects out-of-range and malformed values', () => {
    rejects(vendorProductCreateSchema, { ...validProduct, price: 0 }, 'price 0');
    rejects(vendorProductCreateSchema, { ...validProduct, price: -5 }, 'negative price');
    rejects(vendorProductCreateSchema, { ...validProduct, price: 1e12 }, 'huge price');
    rejects(vendorProductCreateSchema, { ...validProduct, stock: -1 }, 'negative stock');
    rejects(vendorProductCreateSchema, { ...validProduct, stock: 1.5 }, 'fractional stock');
    rejects(vendorProductCreateSchema, { ...validProduct, slug: 'Not A Slug' }, 'bad slug');
    rejects(vendorProductCreateSchema, { ...validProduct, name: 'x'.repeat(256) }, 'long name');
    rejects(vendorProductCreateSchema, { ...validProduct, images: [{ url: 'javascript:alert(1)' }] }, 'non-http image url');
    rejects(vendorProductCreateSchema, { ...validProduct, images: [{ url: 'https://a.example/x.png', evil: 1 }] }, 'unknown image key');
    rejects(vendorProductCreateSchema, { ...validProduct, images: Array.from({ length: 21 }, () => ({ url: 'https://a.example/x.png' })) }, '21 images');
  });

  it('update requires at least one field and accepts a partial body', () => {
    rejects(vendorProductUpdateSchema, {}, 'empty update');
    assert.deepEqual(vendorProductUpdateSchema.parse({ stock: 4 }), { stock: 4 });
  });
});

describe('product whitelist (admin)', () => {
  it('lets an admin set vendorId and isFeatured', () => {
    const parsed = adminProductCreateSchema.parse({ ...validProduct, vendorId: 11, isFeatured: true });
    assert.equal(parsed.vendorId, 11);
    assert.equal(parsed.isFeatured, true);
    assert.equal(adminProductUpdateSchema.parse({ vendorId: null }).vendorId, null);
  });
  it('still rejects rating, soldCount, reviewCount and id', () => {
    for (const key of ['rating', 'soldCount', 'reviewCount', 'id']) {
      rejects(adminProductCreateSchema, { ...validProduct, [key]: 1 }, key);
    }
  });
});

describe('profile update whitelist (PATCH /auth/me)', () => {
  it('accepts the four profile fields', () => {
    const parsed = updateProfileSchema.parse({ firstName: 'Ada', lastName: 'Lovelace', phone: '123', avatar: 'https://a.example/a.png' });
    assert.equal(parsed.firstName, 'Ada');
  });
  for (const key of ['role', 'isActive', 'email', 'password', 'vendorId', 'id', 'refreshToken', 'emailVerified', 'resetPasswordToken']) {
    it(`rejects privilege-bearing field "${key}"`, () => {
      rejects(updateProfileSchema, { firstName: 'Ada', [key]: key === 'role' ? 'super_admin' : 'x' }, key);
    });
  }
  it('rejects an empty body and a non-URL avatar', () => {
    rejects(updateProfileSchema, {}, 'empty');
    rejects(updateProfileSchema, { avatar: 'not a url' }, 'avatar');
    for (const avatar of ['javascript:alert(1)', 'data:text/html,<script>1</script>', 'file:///etc/passwd', 'ftp://a.example/x.png']) {
      rejects(updateProfileSchema, { avatar }, avatar);
    }
    assert.equal(updateProfileSchema.parse({ avatar: 'https://cdn.example/a.png' }).avatar, 'https://cdn.example/a.png');
  });
});

describe('cart quantity validation', () => {
  it('coerces a numeric string and defaults to 1', () => {
    assert.equal(addCartItemSchema.parse({ productId: '7', quantity: '3' }).quantity, 3);
    assert.equal(addCartItemSchema.parse({ productId: 7 }).quantity, 1);
  });
  for (const quantity of [-1, 0, 1.5, 101, 'abc', null]) {
    it(`rejects quantity ${JSON.stringify(quantity)}`, () => {
      rejects(addCartItemSchema, { productId: 1, quantity }, String(quantity));
    });
  }
  it('rejects a non-positive product id and strips unknown fields such as price', () => {
    rejects(addCartItemSchema, { productId: 0 }, 'productId 0');
    rejects(addCartItemSchema, { productId: -3 }, 'productId -3');
    const parsed = addCartItemSchema.parse({ productId: 1, quantity: 2, price: 0.01 }) as Record<string, unknown>;
    assert.equal('price' in parsed, false);
  });
  it('update accepts 0 (remove) but not negatives', () => {
    assert.equal(updateCartItemSchema.parse({ quantity: 0 }).quantity, 0);
    rejects(updateCartItemSchema, { quantity: -2 }, 'negative update');
  });
});

describe('order validation', () => {
  it('status must be a known value and unknown keys are rejected', () => {
    assert.equal(updateOrderStatusSchema.parse({ status: 'shipped' }).status, 'shipped');
    rejects(updateOrderStatusSchema, { status: 'hacked' }, 'unknown status');
    rejects(updateOrderStatusSchema, { status: 'shipped', total: 0 }, 'extra key');
    rejects(updateOrderStatusSchema, {}, 'missing status');
  });
  const address = { street: '1 Main', city: 'X', state: 'Y', country: 'Z', zipCode: '12345', phone: '' };
  it('creates an order with a complete address', () => {
    assert.equal(createOrderSchema.parse({ shippingAddress: address, paymentMethod: 'cod' }).paymentMethod, 'cod');
  });
  it('rejects incomplete addresses and unknown payment methods', () => {
    rejects(createOrderSchema, { shippingAddress: { ...address, street: '' }, paymentMethod: 'cod' }, 'empty street');
    rejects(createOrderSchema, { paymentMethod: 'cod' }, 'no address');
    rejects(createOrderSchema, { shippingAddress: address, paymentMethod: 'bitcoin' }, 'bad payment method');
  });
});

describe('review and admin validation', () => {
  it('rating must be an integer from 1 to 5', () => {
    for (const rating of [0, 6, 2.5, -1, 'x']) rejects(createReviewSchema, { productId: 1, rating, comment: 'ok' }, String(rating));
    assert.equal(createReviewSchema.parse({ productId: 1, rating: '5', comment: 'great' }).rating, 5);
    rejects(createReviewSchema, { productId: 1, rating: 5, comment: '   ' }, 'blank comment');
  });
  it('admin bodies are strict', () => {
    assert.equal(updateUserStatusSchema.parse({ isActive: false }).isActive, false);
    rejects(updateUserStatusSchema, { isActive: 'no' }, 'string boolean');
    rejects(updateUserStatusSchema, { isActive: true, role: 'admin' }, 'role smuggled');
    assert.equal(updateVendorStatusSchema.parse({ status: 'approved' }).status, 'approved');
    rejects(updateVendorStatusSchema, { status: 'owner' }, 'bad vendor status');
    rejects(moderateReviewSchema, { isApproved: true, rating: 5 }, 'extra review key');
  });
});
