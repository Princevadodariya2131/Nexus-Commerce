import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { evaluate, hostOf, loadDotEnv } from '../db-guard.mjs';
import { baselineTimestamp, planBaseline, LOCK_FILE_CONTENT } from '../create-baseline-migration.mjs';

const local = { DATABASE_URL: 'mysql://root@localhost:3306/nexus_commerce' };
const remote = { DATABASE_URL: 'mysql://u:p@gateway01.example.test:4000/prod' };
const allowed = (args, env) => evaluate(args, env).allow;

describe('db-guard: non-destructive commands always run', () => {
  for (const args of [['validate'], ['generate'], ['format'], ['migrate', 'deploy'], ['migrate', 'status'], ['migrate', 'diff', '--from-empty']]) {
    it(`prisma ${args.join(' ')} against a remote production database`, () => {
      assert.equal(allowed(args, { ...remote, NODE_ENV: 'production' }), true);
    });
  }
});

describe('db-guard: destructive commands', () => {
  const destructive = [['migrate', 'reset'], ['migrate', 'reset', '--force'], ['migrate', 'dev'], ['db', 'push'], ['db', 'push', '--accept-data-loss'], ['db', 'execute', '--file', 'x.sql'], ['migrate', 'deploy', '--force-reset'], ['migrate', 'deploy', '--accept-data-loss'], ['format', '--force-reset']];
  for (const args of destructive) {
    it(`runs "${args.join(' ')}" on a local database in development`, () => assert.equal(allowed(args, { ...local, NODE_ENV: 'development' }), true));
    it(`refuses "${args.join(' ')}" on a remote database`, () => assert.equal(allowed(args, remote), false));
    it(`refuses "${args.join(' ')}" in production even on localhost`, () => assert.equal(allowed(args, { ...local, NODE_ENV: 'production' }), false));
    it(`refuses "${args.join(' ')}" when DATABASE_URL is missing`, () => assert.equal(allowed(args, {}), false));
  }
  it('refuses a look-alike hostname and an unparseable URL', () => {
    assert.equal(allowed(['migrate', 'reset'], { DATABASE_URL: 'mysql://u@localhost.evil.test:3306/x' }), false);
    assert.equal(allowed(['migrate', 'reset'], { DATABASE_URL: 'not a url' }), false);
  });
  it('needs BOTH the flag and the exact host to override', () => {
    const host = 'gateway01.example.test';
    assert.equal(allowed(['migrate', 'reset'], { ...remote, ALLOW_DESTRUCTIVE_DB: 'true' }), false);
    assert.equal(allowed(['migrate', 'reset'], { ...remote, CONFIRM_DATABASE_HOST: host }), false);
    assert.equal(allowed(['migrate', 'reset'], { ...remote, ALLOW_DESTRUCTIVE_DB: '1', CONFIRM_DATABASE_HOST: host }), false);
    assert.equal(allowed(['migrate', 'reset'], { ...remote, ALLOW_DESTRUCTIVE_DB: 'true', CONFIRM_DATABASE_HOST: 'other.example.test' }), false);
    assert.equal(allowed(['migrate', 'reset'], { ...remote, ALLOW_DESTRUCTIVE_DB: 'true', CONFIRM_DATABASE_HOST: host }), true);
  });
  it('explains the refusal and never prints credentials', () => {
    const verdict = evaluate(['migrate', 'reset'], remote);
    assert.match(verdict.reason, /drops the database/);
    assert.match(verdict.reason, /gateway01\.example\.test/);
    assert.equal(verdict.reason.includes('u:p'), false);
  });
});

describe('db-guard helpers', () => {
  it('hostOf extracts the hostname and tolerates garbage', () => {
    assert.equal(hostOf('mysql://u:p@db.example.test:3306/x'), 'db.example.test');
    assert.equal(hostOf('mysql://root@[::1]:3306/x'), '[::1]');
    assert.equal(hostOf(''), '');
  });
  it('loadDotEnv reads quoted values, skips comments and never overrides existing variables', () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'dbg-')), '.env');
    fs.writeFileSync(file, '# c\nDATABASE_URL="mysql://root@localhost:3306/x"\nNODE_ENV=development\nEMPTY=\n');
    const env = { NODE_ENV: 'production' };
    loadDotEnv(file, env);
    assert.equal(env.DATABASE_URL, 'mysql://root@localhost:3306/x');
    assert.equal(env.NODE_ENV, 'production');
    loadDotEnv(path.join(os.tmpdir(), 'does-not-exist.env'), env);
  });
});

describe('baseline migration planning', () => {
  it('names the migration with a UTC timestamp', () => {
    assert.equal(baselineTimestamp(new Date(Date.UTC(2026, 10, 2, 9, 5, 7))), '20261102090507');
  });
  it('plans a new migration in an empty or missing directory', () => {
    const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mig-')), 'migrations');
    const plan = planBaseline(dir, new Date(Date.UTC(2026, 0, 1)));
    assert.match(plan.dir, /20260101000000_init$/);
    assert.equal(path.basename(plan.sqlPath), 'migration.sql');
    assert.equal(path.basename(plan.lockPath), 'migration_lock.toml');
    fs.mkdirSync(dir, { recursive: true });
    assert.ok(planBaseline(dir));
  });
  it('refuses to run when any migration already exists (never overwrites history)', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mig-'));
    fs.mkdirSync(path.join(dir, '20250101000000_init'));
    assert.throws(() => planBaseline(dir), /already exist/);
  });
  it('writes a MySQL lock file', () => assert.match(LOCK_FILE_CONTENT, /provider = "mysql"/));
});
