import { db, fakeReq, runChain, statusOf } from './helpers/testkit';
import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { productService } from '../services/product.service';
import { authorize } from '../middleware/auth';
import { requireVendorContext } from '../middleware/vendor';
import { validateProductWrite } from '../middleware/productValidation';
import { productController } from '../controllers/product.controller';

const expectError = (status: number) => (error: any) => {
  assert.equal(error.statusCode, status, `expected ${status}, got ${error.statusCode} (${error.message})`);
  return true;
};
const input = { name: 'Widget', slug: 'widget', description: 'desc', sku: 'W-1', price: 10, categoryId: 3 };
const vendor10 = { role: 'vendor', vendorId: 10 };

beforeEach(() => {
  db.reset();
  db.addUser({ id: 1, role: 'admin' });
  db.addUser({ id: 2, role: 'vendor' });
  db.addUser({ id: 3, role: 'vendor' });
  db.addUser({ id: 6, role: 'vendor' }); // vendor role, no vendor profile
  db.addVendor({ id: 10, userId: 2 });
  db.addVendor({ id: 11, userId: 3 });
  db.addProduct({ id: 1, vendorId: 10, name: 'mine' });
  db.addProduct({ id: 2, vendorId: 11, name: 'theirs' });
});
const product = (id: number) => db.products.find((p) => p.id === id)!;

describe('productService: ownership', () => {
  it('a vendor always owns what they create, whatever the input says', async () => {
    const created: any = await productService.createProduct({ ...input, vendorId: 11 } as any, vendor10);
    assert.equal(created.vendorId, 10);
  });
  it('an administrator may assign a vendor, or leave it empty', async () => {
    assert.equal(((await productService.createProduct({ ...input, vendorId: 11 }, { role: 'admin' })) as any).vendorId, 11);
    assert.equal(((await productService.createProduct({ ...input, sku: 'W-2', slug: 'w-2' }, { role: 'admin' })) as any).vendorId, undefined);
  });
  it('only whitelisted columns reach the database', async () => {
    const created: any = await productService.createProduct(
      { ...input, rating: 5, soldCount: 999, reviewCount: 50, role: 'admin', id: 1, createdAt: 'x' } as any,
      vendor10
    );
    assert.equal(created.rating, 0);
    assert.equal(created.soldCount, 0);
    assert.equal(created.reviewCount, 0);
    assert.equal('role' in created, false);
    assert.notEqual(created.id, 1);
  });
  it('a vendor can update and soft-delete their own product', async () => {
    await productService.updateProduct('1', { name: 'renamed', stock: 4 }, vendor10);
    assert.equal(product(1).name, 'renamed');
    assert.equal(product(1).stock, 4);
    await productService.deleteProduct('1', vendor10);
    assert.equal(product(1).isActive, false);
  });
  it("a vendor cannot update or delete another vendor's product: 404, nothing written", async () => {
    await assert.rejects(() => productService.updateProduct('2', { name: 'pwned' }, vendor10), expectError(404));
    await assert.rejects(() => productService.deleteProduct('2', vendor10), expectError(404));
    assert.equal(product(2).name, 'theirs');
    assert.equal(product(2).isActive, true);
    assert.equal(db.writeCount, 0);
  });
  it('a vendor cannot reassign a product to another vendor', async () => {
    await productService.updateProduct('1', { name: 'x', vendorId: 11 } as any, vendor10);
    assert.equal(product(1).vendorId, 10);
  });
  it('an administrator can update any product and reassign it', async () => {
    await productService.updateProduct('2', { name: 'admin edit', vendorId: 10 }, { role: 'admin' });
    assert.equal(product(2).name, 'admin edit');
    assert.equal(product(2).vendorId, 10);
  });
});

describe('productService: accounts without a valid vendor id are denied (defense in depth)', () => {
  for (const actor of [{ role: 'vendor' }, { role: 'vendor', vendorId: undefined }, { role: 'vendor', vendorId: 0 }, { role: 'customer' }, { role: '' }]) {
    it(`denies ${JSON.stringify(actor)} on create, update and delete`, async () => {
      await assert.rejects(() => productService.createProduct(input, actor as any), expectError(403));
      await assert.rejects(() => productService.updateProduct('1', { name: 'x' }, actor as any), expectError(403));
      await assert.rejects(() => productService.deleteProduct('1', actor as any), expectError(403));
      assert.equal(db.writeCount, 0);
    });
  }
});

// The same middleware order that routes/product.routes.ts uses.
const chain = (mode: 'create' | 'update' | 'delete') => [
  authorize('admin', 'super_admin', 'vendor'),
  requireVendorContext,
  ...(mode === 'delete' ? [] : [validateProductWrite(mode)]),
  mode === 'create' ? productController.createProduct : mode === 'update' ? productController.updateProduct : productController.deleteProduct,
];

describe('product routes (middleware chain)', () => {
  const asUser = (userId: number, role: string, body: unknown = {}, params: unknown = {}) =>
    fakeReq({ user: { userId: String(userId), role }, body, params });

  it('rejects a vendor-role user with no vendor profile before anything is written', async () => {
    const out = await runChain(chain('create'), asUser(6, 'vendor', input));
    assert.equal(statusOf(out), 403);
    assert.equal(db.writeCount, 0);
  });
  it('rejects a customer outright', async () => {
    assert.equal(statusOf(await runChain(chain('create'), asUser(4, 'customer', input))), 403);
  });
  it('rejects a vendor body containing isFeatured/vendorId/rating with 422', async () => {
    for (const extra of [{ isFeatured: true }, { vendorId: 11 }, { rating: 5 }, { soldCount: 1000 }]) {
      const out = await runChain(chain('create'), asUser(2, 'vendor', { ...input, ...extra }));
      assert.equal(statusOf(out), 422, JSON.stringify(extra));
    }
    assert.equal(db.writeCount, 0);
  });
  it('creates a vendor product owned by the vendor resolved from the database', async () => {
    const out = await runChain(chain('create'), asUser(2, 'vendor', input));
    assert.equal(statusOf(out), 201);
    assert.equal(db.products.at(-1)!.vendorId, 10);
  });
  it('lets an administrator use the wider schema (isFeatured, vendorId)', async () => {
    const out = await runChain(chain('create'), asUser(1, 'admin', { ...input, isFeatured: true, vendorId: 11 }));
    assert.equal(statusOf(out), 201);
    assert.equal(db.products.at(-1)!.vendorId, 11);
    assert.equal(db.products.at(-1)!.isFeatured, true);
  });
  it("blocks a vendor from updating or deleting another vendor's product", async () => {
    assert.equal(statusOf(await runChain(chain('update'), asUser(2, 'vendor', { name: 'x' }, { id: '2' }))), 404);
    assert.equal(statusOf(await runChain(chain('delete'), asUser(2, 'vendor', {}, { id: '2' }))), 404);
    assert.equal(product(2).isActive, true);
  });
  it('rejects an empty update body', async () => {
    assert.equal(statusOf(await runChain(chain('update'), asUser(2, 'vendor', {}, { id: '1' }))), 422);
  });
});
