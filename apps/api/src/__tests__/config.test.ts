import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import path from 'node:path';

/**
 * Each case loads the real config module in a fresh process, so module-level
 * validation runs exactly as it does at server start. Every variable the config
 * reads is set explicitly (empty string = unset) so a developer's own .env file
 * cannot change the outcome (dotenv never overrides variables that already exist).
 */
const random = () => crypto.randomBytes(48).toString('base64');
const API_ROOT = path.resolve(__dirname, '..', '..');

const baseEnv = (): Record<string, string> => ({
  NODE_ENV: 'production',
  JWT_SECRET: random(),
  JWT_REFRESH_SECRET: random(),
  COOKIE_SECRET: random(),
  DATABASE_URL: 'mysql://user:pw@db.example.test:3306/app',
  CLIENT_URL: 'https://shop.example.test',
  TRUST_PROXY_HOPS: '',
});

const loadConfig = (overrides: Record<string, string>) => {
  const result = spawnSync(
    process.execPath,
    [...process.execArgv, '-e', "const {config}=require('./src/config');console.log('HOPS='+config.app.trustProxyHops+' ORIGINS='+config.app.clientUrls.join('|')+' PRIMARY='+config.app.clientUrl)"],
    { cwd: API_ROOT, env: { ...process.env, ...baseEnv(), ...overrides }, encoding: 'utf8' }
  );
  return { ok: result.status === 0, out: result.stdout, err: result.stderr };
};
const refuses = (overrides: Record<string, string>, label: string) => {
  const r = loadConfig(overrides);
  assert.equal(r.ok, false, `${label}: config should refuse to load`);
  assert.match(r.err, /\[config\]/, `${label}: should fail with a [config] message`);
};

describe('config: production startup validation', () => {
  it('loads with valid production values', () => {
    const r = loadConfig({});
    assert.equal(r.ok, true, r.err);
    assert.match(r.out, /HOPS=1/);
  });
  for (const name of ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'COOKIE_SECRET', 'DATABASE_URL', 'CLIENT_URL']) {
    it(`refuses a missing ${name}`, () => refuses({ [name]: '' }, name));
  }
  it('refuses whitespace-only, short, and placeholder secrets', () => {
    refuses({ JWT_SECRET: '     ' }, 'whitespace');
    refuses({ JWT_SECRET: 'a'.repeat(31) }, '31 chars');
    refuses({ JWT_SECRET: 'your-super-secret-jwt-key-change-in-production' }, '.env.example placeholder');
    refuses({ COOKIE_SECRET: 'dev-secret-change-me'.padEnd(40, 'x') }, 'old dev fallback');
  });
  it('refuses identical JWT and refresh secrets', () => {
    const same = random();
    refuses({ JWT_SECRET: same, JWT_REFRESH_SECRET: same }, 'identical secrets');
  });
  it('accepts a 32-character secret', () => {
    assert.equal(loadConfig({ JWT_SECRET: 'aB3$'.repeat(8) }).ok, true);
  });
  it('validates TRUST_PROXY_HOPS', () => {
    for (const bad of ['abc', '-1', '1.5']) refuses({ TRUST_PROXY_HOPS: bad }, `hops ${bad}`);
    assert.match(loadConfig({ TRUST_PROXY_HOPS: '2' }).out, /HOPS=2/);
    assert.match(loadConfig({ TRUST_PROXY_HOPS: '0' }).out, /HOPS=0/);
  });
  it('accepts several comma-separated client origins and rejects malformed ones', () => {
    const multi = loadConfig({ CLIENT_URL: 'https://a.example, https://b.example' }).out;
    assert.match(multi, /ORIGINS=https:\/\/a\.example\|https:\/\/b\.example/);
    // e-mail links are built from the primary (first) origin only
    assert.match(multi, /PRIMARY=https:\/\/a\.example(\s|$)/);
    assert.equal(loadConfig({ CLIENT_URL: 'https://a.example,' }).ok, true); // a trailing comma is harmless
    for (const bad of ['https://a.example/', 'a.example', 'https://a.example/path', 'ftp://a.example', ' , ']) {
      refuses({ CLIENT_URL: bad }, `CLIENT_URL ${bad}`);
    }
  });
  it('development keeps working with nothing set (local XAMPP workflow)', () => {
    const r = loadConfig({ NODE_ENV: 'development', JWT_SECRET: '', JWT_REFRESH_SECRET: '', COOKIE_SECRET: '', DATABASE_URL: '', CLIENT_URL: '' });
    assert.equal(r.ok, true, r.err);
  });
});
