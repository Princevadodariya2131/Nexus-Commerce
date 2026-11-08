import { db, fakeReq, runChain, statusOf } from './helpers/testkit';
import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { authService } from '../services/auth.service';
import { authController } from '../controllers/auth.controller';
import { validate } from '../middleware/validate';
import { updateProfileSchema } from '../validators/auth.validator';

const baseUser = { id: 4, email: 'c@example.test', firstName: 'Cee', lastName: 'Customer', role: 'customer', isActive: true, vendorId: null };
beforeEach(() => {
  db.reset();
  db.addUser({ ...baseUser });
});
const patchMe = (body: unknown) => runChain([validate(updateProfileSchema), authController.updateProfile], fakeReq({ user: { userId: '4', role: 'customer' }, body }));

describe('PATCH /auth/me: no privilege escalation', () => {
  it('rejects a body that tries to change the role, and nothing is written', async () => {
    const out = await patchMe({ firstName: 'Mallory', role: 'super_admin' });
    assert.equal(statusOf(out), 422);
    assert.equal(db.users[0].role, 'customer');
    assert.equal(db.writeCount, 0);
  });
  for (const field of ['role', 'isActive', 'email', 'password', 'vendorId', 'id']) {
    it(`rejects "${field}" in the body`, async () => {
      assert.equal(statusOf(await patchMe({ [field]: field === 'role' ? 'admin' : 'x' })), 422);
      assert.equal(db.writeCount, 0);
    });
  }
  it('updates the whitelisted fields', async () => {
    const out = await patchMe({ firstName: 'Ada', phone: '555' });
    assert.equal(statusOf(out), 200);
    assert.equal(db.users[0].firstName, 'Ada');
    assert.equal(db.users[0].phone, '555');
    assert.equal(db.users[0].role, 'customer');
  });
  it('the service itself only ever writes the four profile columns (defense in depth)', async () => {
    await authService.updateProfile('4', { firstName: 'Ada', role: 'super_admin', isActive: false, email: 'evil@example.test' } as any);
    const written = db.writes[0].args.data as Record<string, unknown>;
    assert.deepEqual(Object.keys(written).sort(), ['avatar', 'firstName', 'lastName', 'phone']);
    assert.equal(db.users[0].role, 'customer');
    assert.equal(db.users[0].email, 'c@example.test');
    assert.equal(db.users[0].isActive, true);
  });
});

describe('socket token', () => {
  it('is short-lived, signed, and carries the socket purpose', () => {
    const { token, expiresIn } = authService.createSocketToken('4', 'customer');
    const claims = jwt.verify(token, process.env.JWT_SECRET as string) as any;
    assert.equal(claims.purpose, 'socket');
    assert.equal(claims.userId, '4');
    assert.equal(expiresIn, 60);
    assert.ok(claims.exp - claims.iat <= 60);
  });
});
