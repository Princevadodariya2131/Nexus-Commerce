import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { AUTH_STORAGE_KEY, purgeLegacyAuthToken, sanitizePersistedAuth } from '../auth-persist';

const user = { _id: '4', email: 'c@example.test', firstName: 'C', lastName: 'U', role: 'customer' };

class MemoryStorage {
  data = new Map<string, string>();
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
}

describe('auth persistence', () => {
  it('drops the access token and unknown fields when sanitising persisted state', () => {
    const cleaned = sanitizePersistedAuth({ user, isAuthenticated: true, accessToken: 'secret.jwt.value', extra: 1 });
    assert.deepEqual(cleaned, { user, isAuthenticated: true });
    assert.equal('accessToken' in cleaned, false);
  });
  it('survives garbage input', () => {
    for (const junk of [null, undefined, 'string', 42, [], { user: 'x' }]) {
      const cleaned = sanitizePersistedAuth(junk);
      assert.equal(typeof cleaned.isAuthenticated, 'boolean');
    }
    assert.deepEqual(sanitizePersistedAuth(null), { user: null, isAuthenticated: false });
    assert.equal(sanitizePersistedAuth({ user: null, isAuthenticated: true }).isAuthenticated, false);
  });
  it('purges a token persisted by an older version and keeps the profile', () => {
    const storage = new MemoryStorage();
    storage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ state: { user, isAuthenticated: true, accessToken: 'secret.jwt.value' }, version: 0 }));
    assert.equal(purgeLegacyAuthToken(storage), true);
    const after = storage.getItem(AUTH_STORAGE_KEY)!;
    assert.equal(after.includes('secret.jwt.value'), false);
    assert.equal(JSON.parse(after).state.user.email, 'c@example.test');
  });
  it('does nothing when there is nothing to purge, and never throws', () => {
    const storage = new MemoryStorage();
    assert.equal(purgeLegacyAuthToken(storage), false);
    storage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ state: { user }, version: 1 }));
    assert.equal(purgeLegacyAuthToken(storage), false);
    storage.setItem(AUTH_STORAGE_KEY, '{not json');
    assert.equal(purgeLegacyAuthToken(storage), false);
    assert.equal(purgeLegacyAuthToken(null), false);
    assert.equal(purgeLegacyAuthToken({ getItem() { throw new Error('denied'); }, setItem() {} }), false);
  });
});

// Static regression guards on the UI source files.
const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, '..', '..', rel), 'utf8');

describe('auth store and login page (static guards)', () => {
  it('the store neither declares nor persists an access token', () => {
    const store = read('store/auth.store.ts');
    assert.equal(/accessToken\s*:/.test(store), false, 'no accessToken field in the store state');
    assert.ok(store.includes('partialize'), 'persisted state must be restricted with partialize');
    assert.ok(store.includes('purgeLegacyAuthToken'));
  });
  it('no page passes an access token to the store', () => {
    for (const page of ['app/(auth)/login/page.tsx', 'app/(auth)/register/page.tsx']) {
      assert.equal(/setAuth\([^)]*accessToken/.test(read(page)), false, page);
    }
  });
  it('demo credentials render only behind the development/opt-in guard', () => {
    const login = read('app/(auth)/login/page.tsx');
    assert.match(login, /const SHOW_DEMO_CREDENTIALS\s*=\s*\n?\s*process\.env\.NODE_ENV !== 'production'/);
    const index = login.indexOf('Customer@123');
    assert.ok(index > -1, 'sanity: the demo text still exists for development');
    const before = login.slice(0, index);
    assert.ok(before.lastIndexOf('{SHOW_DEMO_CREDENTIALS && (') > before.lastIndexOf('</p>'), 'demo text must sit inside the guarded block');
  });
});
