import { db, fakeReq, invoke, statusOf } from './helpers/testkit';
import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { authenticate, authorize } from '../middleware/auth';
import { requireVendorContext } from '../middleware/vendor';

const secret = process.env.JWT_SECRET as string;
const tokenFor = (userId: number, extra: Record<string, unknown> = {}, expiresIn: number = 60) =>
  jwt.sign({ userId: String(userId), email: `u${userId}@example.test`, role: 'customer', ...extra }, secret, { expiresIn });

beforeEach(() => {
  db.reset();
  db.addUser({ id: 1, role: 'admin' });
  db.addUser({ id: 2, role: 'vendor' });
  db.addUser({ id: 4, role: 'customer' });
  db.addUser({ id: 5, role: 'customer', isActive: false });
});

describe('authenticate', () => {
  it('rejects a request without a token', async () => {
    const out = await invoke(authenticate, fakeReq());
    assert.equal(statusOf(out), 401);
  });
  it('rejects a malformed token and a token signed with another secret', async () => {
    assert.equal(statusOf(await invoke(authenticate, fakeReq({ headers: { authorization: 'Bearer not.a.jwt' } }))), 401);
    const foreign = jwt.sign({ userId: '1', role: 'admin' }, 'x'.repeat(32), { expiresIn: 60 });
    assert.equal(statusOf(await invoke(authenticate, fakeReq({ headers: { authorization: `Bearer ${foreign}` } }))), 401);
  });
  it('rejects an expired token', async () => {
    const expired = tokenFor(4, {}, -10);
    assert.equal(statusOf(await invoke(authenticate, fakeReq({ cookies: { accessToken: expired } }))), 401);
  });
  it('accepts the cookie and the Bearer header', async () => {
    const viaCookie = fakeReq({ cookies: { accessToken: tokenFor(4) } });
    assert.equal((await invoke(authenticate, viaCookie)).nextCalled, true);
    assert.equal(viaCookie.user.userId, '4');
    const viaHeader = fakeReq({ headers: { authorization: `Bearer ${tokenFor(4)}` } });
    assert.equal((await invoke(authenticate, viaHeader)).nextCalled, true);
  });
  it('uses the role stored in the database, not the role claimed by the token', async () => {
    // token claims admin; the database says customer (e.g. demoted since the token was issued)
    const req = fakeReq({ cookies: { accessToken: tokenFor(4, { role: 'admin' }) } });
    const out = await invoke(authenticate, req);
    assert.equal(out.nextCalled, true);
    assert.equal(req.user.role, 'customer');
  });
  it('rejects deactivated and unknown accounts', async () => {
    assert.equal(statusOf(await invoke(authenticate, fakeReq({ cookies: { accessToken: tokenFor(5) } }))), 401);
    assert.equal(statusOf(await invoke(authenticate, fakeReq({ cookies: { accessToken: tokenFor(999) } }))), 401);
  });
  it('refuses a socket token as an API access token', async () => {
    const socketToken = tokenFor(4, { purpose: 'socket' });
    const out = await invoke(authenticate, fakeReq({ headers: { authorization: `Bearer ${socketToken}` } }));
    assert.equal(statusOf(out), 401);
  });
});

describe('authorize', () => {
  it('denies a missing user (401), a wrong role (403) and allows a listed role', async () => {
    const guard = authorize('admin', 'super_admin');
    assert.equal(statusOf(await invoke(guard, fakeReq())), 401);
    assert.equal(statusOf(await invoke(guard, fakeReq({ user: { role: 'customer' } }))), 403);
    assert.equal(statusOf(await invoke(guard, fakeReq({ user: { role: 'vendor' } }))), 403);
    assert.equal((await invoke(guard, fakeReq({ user: { role: 'admin' } }))).nextCalled, true);
  });
});

describe('requireVendorContext', () => {
  const asVendor = (extra: Record<string, unknown> = {}) => fakeReq({ user: { userId: '2', role: 'vendor', ...extra } });

  it('denies a vendor-role account that has no vendor profile', async () => {
    const req = asVendor();
    const out = await invoke(requireVendorContext, req);
    assert.equal(statusOf(out), 403);
    assert.equal(req.vendor, undefined);
  });
  it('denies pending, rejected and suspended vendors', async () => {
    for (const status of ['pending', 'rejected', 'suspended']) {
      db.vendors = [];
      db.addVendor({ id: 10, userId: 2, status });
      const req = asVendor();
      assert.equal(statusOf(await invoke(requireVendorContext, req)), 403, status);
      assert.equal(req.vendor, undefined);
    }
  });
  it('resolves the vendor from the database even when the token has no (or a wrong) vendorId', async () => {
    db.addVendor({ id: 10, userId: 2 });
    for (const claim of [undefined, '999']) {
      const req = asVendor({ vendorId: claim });
      const out = await invoke(requireVendorContext, req);
      assert.equal(out.nextCalled, true);
      assert.deepEqual(req.vendor, { id: 10, status: 'approved' });
    }
  });
  it("never picks up another user's vendor profile", async () => {
    db.addVendor({ id: 11, userId: 3 });
    assert.equal(statusOf(await invoke(requireVendorContext, asVendor())), 403);
  });
  it('lets administrators through without a vendor lookup', async () => {
    const req = fakeReq({ user: { userId: '1', role: 'admin' } });
    const out = await invoke(requireVendorContext, req);
    assert.equal(out.nextCalled, true);
    assert.equal(req.vendor, undefined);
  });
  it('requires authentication', async () => {
    assert.equal(statusOf(await invoke(requireVendorContext, fakeReq())), 401);
  });
});
