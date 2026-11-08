import { db, fakeReq, runChain, statusOf } from './helpers/testkit';
import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { adminController } from '../controllers/admin.controller';
import { validate } from '../middleware/validate';
import { updateUserStatusSchema } from '../validators/admin.validator';

beforeEach(() => {
  db.reset();
  db.addUser({ id: 1, role: 'super_admin', email: 's@example.test', firstName: 'S', lastName: 'A' });
  db.addUser({ id: 2, role: 'admin', email: 'a@example.test', firstName: 'A', lastName: 'D' });
  db.addUser({ id: 3, role: 'admin', email: 'a2@example.test', firstName: 'A', lastName: 'D' });
  db.addUser({ id: 4, role: 'customer', email: 'c@example.test', firstName: 'C', lastName: 'U' });
});
const setStatus = (actorId: number, actorRole: string, targetId: number, body: unknown = { isActive: false }) =>
  runChain([validate(updateUserStatusSchema), adminController.updateUserStatus], fakeReq({ user: { userId: String(actorId), role: actorRole }, params: { id: String(targetId) }, body }));
const active = (id: number) => db.users.find((u) => u.id === id)!.isActive;

describe('admin: user status changes', () => {
  it('an admin can deactivate a customer', async () => {
    assert.equal(statusOf(await setStatus(2, 'admin', 4)), 200);
    assert.equal(active(4), false);
  });
  it('nobody can change their own status', async () => {
    assert.equal(statusOf(await setStatus(2, 'admin', 2)), 400);
    assert.equal(statusOf(await setStatus(1, 'super_admin', 1)), 400);
    assert.equal(db.writeCount, 0);
  });
  it('an admin cannot touch another admin or a super admin', async () => {
    assert.equal(statusOf(await setStatus(2, 'admin', 3)), 403);
    assert.equal(statusOf(await setStatus(2, 'admin', 1)), 403);
    assert.equal(active(3), true);
    assert.equal(active(1), true);
    assert.equal(db.writeCount, 0);
  });
  it('a super admin can change an admin', async () => {
    assert.equal(statusOf(await setStatus(1, 'super_admin', 2)), 200);
    assert.equal(active(2), false);
  });
  it('unknown users give 404 and malformed bodies give 422', async () => {
    assert.equal(statusOf(await setStatus(2, 'admin', 999)), 404);
    assert.equal(statusOf(await setStatus(2, 'admin', 4, { isActive: 'no' })), 422);
    assert.equal(statusOf(await setStatus(2, 'admin', 4, { isActive: false, role: 'super_admin' })), 422);
  });
});
