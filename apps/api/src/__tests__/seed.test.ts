import { dynamicMocks } from './helpers/testkit';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Runs the real scripts/seed.ts against a recording database double and checks
 * when it is willing to wipe data. Nothing here touches a real database.
 */
const STRONG_ADMIN = 'Ad' + 'x9!'.repeat(7);
const STRONG_CUSTOMER = 'Cu' + 'q7#'.repeat(7);
const REMOTE = 'mysql://u:p@gateway01.example.test:4000/db';

interface Scenario { url: string; prod?: boolean; env?: Record<string, string> }

async function runSeed({ url, prod = false, env = {} }: Scenario) {
  let wiped = 0;
  let exitCode: number | null = null;
  const hashed: string[] = [];
  const logs: string[] = [];
  let finished!: () => void;
  const done = new Promise<void>((resolve) => (finished = resolve));

  const model = new Proxy({}, { get: (_t, method) => async () => { if (method === 'deleteMany') wiped++; return { id: 1 }; } });
  const prisma = new Proxy({}, { get: (_t, key) => (key === '$disconnect' ? async () => finished() : model) });
  dynamicMocks.set('../config', { config: { db: { url }, isProd: prod, env: prod ? 'production' : 'development' } });
  dynamicMocks.set('../lib/prisma', { prisma });
  dynamicMocks.set('../utils/password', { hashPassword: async (plain: string) => { hashed.push(plain); return 'h'; } });

  const realExit = process.exit, realLog = console.log, realErr = console.error;
  process.exit = ((code?: number) => { exitCode = code ?? 0; throw new Error('__exit__'); }) as never;
  console.log = (...a: unknown[]) => void logs.push(a.join(' '));
  console.error = (...a: unknown[]) => void logs.push(a.join(' '));
  for (const key of ['ALLOW_DESTRUCTIVE_SEED', 'SEED_ADMIN_PASSWORD', 'SEED_CUSTOMER_PASSWORD']) delete process.env[key];
  Object.assign(process.env, env);
  try {
    delete require.cache[require.resolve('../scripts/seed')];
    require('../scripts/seed');
    await done;
  } finally {
    process.exit = realExit; console.log = realLog; console.error = realErr;
    for (const key of ['../config', '../lib/prisma', '../utils/password']) dynamicMocks.delete(key);
  }
  return { ran: wiped > 0, wiped, exitCode, hashed, logs };
}

describe('seed script: local databases keep working as before', () => {
  for (const host of ['localhost', '127.0.0.1', '[::1]', 'mysql']) {
    it(`seeds ${host} with the documented local passwords`, async () => {
      const r = await runSeed({ url: `mysql://root@${host}:3306/nexus_commerce` });
      assert.equal(r.ran, true);
      assert.ok(r.hashed.includes('Admin@123456') && r.hashed.includes('Customer@123'));
      assert.ok(r.logs.some((l) => /local development default/.test(l)));
    });
  }
});

describe('seed script: refuses to wipe anything else', () => {
  const refuses = async (scenario: Scenario, label: string) => {
    const r = await runSeed(scenario);
    assert.equal(r.ran, false, `${label}: must not delete anything`);
    assert.equal(r.exitCode, 1, `${label}: must exit with code 1`);
    assert.equal(r.hashed.length, 0, `${label}: must not hash default passwords`);
  };
  it('a hosted database without flags', () => refuses({ url: REMOTE }, 'remote'));
  it('a look-alike hostname', () => refuses({ url: 'mysql://u:p@localhost.evil.test:4000/db' }, 'look-alike'));
  it('an unparseable URL', () => refuses({ url: 'not a url' }, 'unparseable'));
  it('production, even on localhost', () => refuses({ url: 'mysql://root@localhost:3306/x', prod: true }, 'production'));
  it('the flag without passwords', () => refuses({ url: REMOTE, env: { ALLOW_DESTRUCTIVE_SEED: 'true' } }, 'flag only'));
  it('the flag with only one password', () =>
    refuses({ url: REMOTE, env: { ALLOW_DESTRUCTIVE_SEED: 'true', SEED_ADMIN_PASSWORD: STRONG_ADMIN } }, 'one password'));
  it('passwords without the flag', () =>
    refuses({ url: REMOTE, env: { SEED_ADMIN_PASSWORD: STRONG_ADMIN, SEED_CUSTOMER_PASSWORD: STRONG_CUSTOMER } }, 'no flag'));
  it('a flag value that is not exactly "true"', () =>
    refuses({ url: REMOTE, env: { ALLOW_DESTRUCTIVE_SEED: '1', SEED_ADMIN_PASSWORD: STRONG_ADMIN, SEED_CUSTOMER_PASSWORD: STRONG_CUSTOMER } }, 'flag=1'));
});

describe('seed script: the explicit, intended path', () => {
  it('runs on a remote database only with the flag and both passwords, and never logs them', async () => {
    const r = await runSeed({
      url: REMOTE,
      env: { ALLOW_DESTRUCTIVE_SEED: 'true', SEED_ADMIN_PASSWORD: STRONG_ADMIN, SEED_CUSTOMER_PASSWORD: STRONG_CUSTOMER },
    });
    assert.equal(r.ran, true);
    assert.deepEqual(r.hashed.filter((p) => p === 'Admin@123456' || p === 'Customer@123'), []);
    assert.ok(r.hashed.includes(STRONG_ADMIN) && r.hashed.includes(STRONG_CUSTOMER));
    const log = r.logs.join('\n');
    assert.equal(log.includes(STRONG_ADMIN) || log.includes(STRONG_CUSTOMER), false, 'passwords must not appear in logs');
    assert.equal(log.includes('Admin@123456'), false, 'the default password must not be printed');
  });
});
