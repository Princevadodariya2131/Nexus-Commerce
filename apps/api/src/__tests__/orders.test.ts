import { db } from './helpers/testkit';
import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { orderService } from '../services/order.service';

const expectError = (status: number, messagePart?: string) => (error: any) => {
  assert.equal(error.statusCode, status, `expected HTTP ${status}, got ${error.statusCode} (${error.message})`);
  if (messagePart) assert.match(error.message, new RegExp(messagePart, 'i'));
  return true;
};

// vendors 10 and 11; orders: 100 (vendor 10 only), 101 (vendor 11 only), 102 (mixed), 103 (no vendor)
beforeEach(() => {
  db.reset();
  db.addUser({ id: 1, role: 'admin' });
  db.addUser({ id: 2, role: 'vendor' });
  db.addUser({ id: 3, role: 'vendor' });
  db.addVendor({ id: 10, userId: 2 });
  db.addVendor({ id: 11, userId: 3 });
  db.addOrder({ id: 100, userId: 4 }, [10, 10]);
  db.addOrder({ id: 101, userId: 4 }, [11]);
  db.addOrder({ id: 102, userId: 4 }, [10, 11]);
  db.addOrder({ id: 103, userId: 4 }, [null]);
});

const statusOf = (id: number) => db.orders.find((o) => o.id === id)!.status;
const vendor10 = { role: 'vendor', vendorId: 10 };

describe('order status updates: administrators', () => {
  it('can update any order, including mixed and vendorless ones, and a history row is written', async () => {
    for (const id of [100, 101, 102, 103]) {
      await orderService.updateOrderStatus(String(id), 'shipped', { role: 'admin' }, 'packed');
      assert.equal(statusOf(id), 'shipped');
    }
    assert.equal(db.statusHistory.length, 4);
    assert.equal(db.statusHistory[0].note, 'packed');
    await orderService.updateOrderStatus('100', 'refunded', { role: 'super_admin' });
    assert.equal(statusOf(100), 'refunded');
  });
  it('returns 404 (not a silent success) for a missing order', async () => {
    await assert.rejects(() => orderService.updateOrderStatus('9999', 'shipped', { role: 'admin' }), expectError(404));
  });
});

describe('order status updates: vendors', () => {
  it("can update an order that consists only of their own items", async () => {
    await orderService.updateOrderStatus('100', 'shipped', vendor10);
    assert.equal(statusOf(100), 'shipped');
    assert.equal(db.statusHistory.length, 1);
  });

  it("cannot update another vendor's order: 404 and nothing is written", async () => {
    await assert.rejects(() => orderService.updateOrderStatus('101', 'shipped', vendor10), expectError(404));
    assert.equal(statusOf(101), 'pending');
    assert.equal(db.writeCount, 0);
  });

  it('cannot update a mixed-vendor order: 403 and nothing is written', async () => {
    await assert.rejects(() => orderService.updateOrderStatus('102', 'shipped', vendor10), expectError(403, 'administrator'));
    assert.equal(statusOf(102), 'pending');
    assert.equal(db.writeCount, 0);
  });

  it('cannot update an order that has no vendor items', async () => {
    await assert.rejects(() => orderService.updateOrderStatus('103', 'shipped', vendor10), expectError(404));
    assert.equal(db.writeCount, 0);
  });

  it('cannot set a financial status such as refunded, even on their own order', async () => {
    await assert.rejects(() => orderService.updateOrderStatus('100', 'refunded', vendor10), expectError(403));
    assert.equal(statusOf(100), 'pending');
    assert.equal(db.writeCount, 0);
  });

  it('is denied without a vendor id', async () => {
    await assert.rejects(() => orderService.updateOrderStatus('100', 'shipped', { role: 'vendor' }), expectError(403));
    await assert.rejects(() => orderService.updateOrderStatus('100', 'shipped', { role: 'vendor', vendorId: undefined }), expectError(403));
    assert.equal(db.writeCount, 0);
  });

  it('cannot reach orders through odd ids', async () => {
    for (const id of ['abc', '0', '-5', '', '1e3x']) {
      await assert.rejects(() => orderService.updateOrderStatus(id, 'shipped', vendor10), (e: any) => e.statusCode === 404 || e.statusCode === 403, `id ${id}`);
    }
    assert.equal(db.writeCount, 0);
  });
});

describe('order status updates: everyone else is denied by default', () => {
  for (const role of ['customer', 'guest', '', 'ADMIN', 'owner']) {
    it(`role "${role}" gets 403`, async () => {
      await assert.rejects(() => orderService.updateOrderStatus('100', 'shipped', { role }), expectError(403));
      assert.equal(db.writeCount, 0);
    });
  }
});
