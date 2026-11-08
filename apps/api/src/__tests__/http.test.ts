import { db } from './helpers/testkit';
import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import jwt from 'jsonwebtoken';

/**
 * End-to-end HTTP tests: the real Express app (real routing, body parsing, cookie parsing,
 * validation, authentication and authorization) with only the database replaced by the
 * in-memory double. They run wherever Express is installed (CI) and skip themselves where
 * it is not.
 */
let expressInstalled = true;
try {
  require.resolve('express');
} catch {
  expressInstalled = false;
}

const secret = process.env.JWT_SECRET as string;
const bearer = (userId: number, role: string) => ({
  authorization: `Bearer ${jwt.sign({ userId: String(userId), email: `u${userId}@example.test`, role }, secret, { expiresIn: 60 })}`,
});

describe('HTTP API', { skip: expressInstalled ? false : 'express is not installed in this environment' }, () => {
  let server: http.Server;
  let base = '';

  const call = async (method: string, path: string, options: { headers?: Record<string, string>; body?: unknown; raw?: string } = {}) => {
    const hasBody = options.body !== undefined || options.raw !== undefined;
    const response = await fetch(`${base}/api/v1${path}`, {
      method,
      headers: { ...(hasBody ? { 'content-type': 'application/json' } : {}), ...options.headers },
      body: options.raw ?? (options.body !== undefined ? JSON.stringify(options.body) : undefined),
    });
    let json: any = null;
    try {
      json = await response.json();
    } catch {
      /* non-JSON body */
    }
    return { status: response.status, json };
  };

  before(async () => {
    const { createApp } = require('../app');
    server = http.createServer(createApp());
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  beforeEach(() => {
    db.reset();
    db.addUser({ id: 1, role: 'admin', email: 'a@example.test', firstName: 'A', lastName: 'D' });
    db.addUser({ id: 2, role: 'vendor', email: 'v2@example.test', firstName: 'V', lastName: 'Two' });
    db.addUser({ id: 3, role: 'vendor', email: 'v3@example.test', firstName: 'V', lastName: 'Three' });
    db.addUser({ id: 4, role: 'customer', email: 'c@example.test', firstName: 'C', lastName: 'U' });
    db.addVendor({ id: 10, userId: 2 });
    db.addVendor({ id: 11, userId: 3 });
    db.addOrder({ id: 100, userId: 4 }, [10]);
    db.addOrder({ id: 101, userId: 4 }, [11]);
  });

  it('serves liveness and readiness (503 when the database is down)', async () => {
    assert.equal((await call('GET', '/health')).status, 200);
    assert.equal((await call('GET', '/health/ready')).status, 200);
    db.down = true;
    const down = await call('GET', '/health/ready');
    assert.equal(down.status, 503);
    assert.equal(down.json.checks.database, 'down');
    assert.equal((await call('GET', '/health')).status, 200, 'liveness must not depend on the database');
  });

  it('PATCH /auth/me requires authentication and rejects role changes', async () => {
    assert.equal((await call('PATCH', '/auth/me', { body: { firstName: 'X' } })).status, 401);
    const attempt = await call('PATCH', '/auth/me', { headers: bearer(4, 'customer'), body: { firstName: 'X', role: 'super_admin' } });
    assert.equal(attempt.status, 422);
    assert.equal(db.users.find((u) => u.id === 4)!.role, 'customer');
    assert.equal(db.writeCount, 0);
  });

  it('malformed JSON is a 400, not a 500', async () => {
    const response = await call('PATCH', '/auth/me', { headers: bearer(4, 'customer'), raw: '{"firstName": ' });
    assert.equal(response.status, 400);
  });

  it("a vendor can update their own order but not another vendor's, and customers cannot at all", async () => {
    const own = await call('PATCH', '/orders/100/status', { headers: bearer(2, 'vendor'), body: { status: 'shipped' } });
    assert.equal(own.status, 200);
    assert.equal(db.orders.find((o) => o.id === 100)!.status, 'shipped');

    const other = await call('PATCH', '/orders/101/status', { headers: bearer(2, 'vendor'), body: { status: 'shipped' } });
    assert.equal(other.status, 404);
    assert.equal(db.orders.find((o) => o.id === 101)!.status, 'pending');

    const customer = await call('PATCH', '/orders/100/status', { headers: bearer(4, 'customer'), body: { status: 'delivered' } });
    assert.equal(customer.status, 403);
    assert.equal((await call('PATCH', '/orders/100/status', { body: { status: 'delivered' } })).status, 401);
  });

  it('rejects unknown order statuses and vendor attempts at financial statuses', async () => {
    assert.equal((await call('PATCH', '/orders/100/status', { headers: bearer(1, 'admin'), body: { status: 'hacked' } })).status, 422);
    assert.equal((await call('PATCH', '/orders/100/status', { headers: bearer(2, 'vendor'), body: { status: 'refunded' } })).status, 403);
  });

  it('product writes: customers are denied and vendor bodies are whitelisted', async () => {
    const product = { name: 'W', slug: 'w', description: 'd', sku: 'W-1', price: 5, categoryId: 1 };
    assert.equal((await call('POST', '/products', { headers: bearer(4, 'customer'), body: product })).status, 403);
    assert.equal((await call('POST', '/products', { headers: bearer(2, 'vendor'), body: { ...product, isFeatured: true } })).status, 422);
    const ok = await call('POST', '/products', { headers: bearer(2, 'vendor'), body: product });
    assert.equal(ok.status, 201);
    assert.equal(db.products.at(-1)!.vendorId, 10);
  });

  it('a vendor-role account without a vendor profile cannot use vendor product operations', async () => {
    db.addUser({ id: 6, role: 'vendor' });
    const product = { name: 'W', slug: 'w', description: 'd', sku: 'W-1', price: 5, categoryId: 1 };
    assert.equal((await call('POST', '/products', { headers: bearer(6, 'vendor'), body: product })).status, 403);
    assert.equal(db.products.length, 0);
  });

  it('cart: negative, zero and fractional quantities are rejected before reaching the service', async () => {
    for (const quantity of [-1, 0, 1.5, 1000]) {
      const response = await call('POST', '/cart/items', { headers: bearer(4, 'customer'), body: { productId: 1, quantity } });
      assert.equal(response.status, 422, `quantity ${quantity}`);
    }
  });

  it('admin user status: admins cannot deactivate administrators', async () => {
    db.addUser({ id: 7, role: 'admin', email: 'a7@example.test', firstName: 'A', lastName: 'Seven' });
    assert.equal((await call('PATCH', '/admin/users/7', { headers: bearer(1, 'admin'), body: { isActive: false } })).status, 403);
    assert.equal((await call('PATCH', '/admin/users/4', { headers: bearer(4, 'customer'), body: { isActive: false } })).status, 403);
  });

  it('the socket token works only for sockets: it is refused as an API credential', async () => {
    const issued = await call('GET', '/auth/socket-token', { headers: bearer(4, 'customer') });
    assert.equal(issued.status, 200);
    const token = issued.json.data.token as string;
    assert.equal((await call('GET', '/auth/me', { headers: { authorization: `Bearer ${token}` } })).status, 401);
    assert.equal((await call('GET', '/auth/socket-token')).status, 401);
  });

  it('unknown routes are 404 JSON', async () => {
    assert.equal((await call('GET', '/definitely-not-a-route')).status, 404);
  });
});
