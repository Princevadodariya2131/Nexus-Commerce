#!/usr/bin/env node
/**
 * Safe wrapper around the Prisma CLI.
 *
 * Non-destructive commands (validate, generate, format, migrate deploy, migrate status,
 * migrate diff) always run. Commands that can drop data (migrate reset, migrate dev,
 * db push, db execute, --force-reset, --accept-data-loss) only run against a LOCAL
 * database outside production. Against anything else they are refused unless BOTH
 *   ALLOW_DESTRUCTIVE_DB=true  and  CONFIRM_DATABASE_HOST=<the exact database host>
 * are set for that single invocation. The host must be typed out, so a stale shell
 * variable pointing at production cannot be wiped by accident.
 *
 * Usage: node scripts/db-guard.mjs <prisma arguments...>     (see the db:* npm scripts)
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]', 'mysql']);

const DESTRUCTIVE_RULES = [
  { test: (a) => a[0] === 'migrate' && a[1] === 'reset', why: '`prisma migrate reset` drops the database and every row in it' },
  { test: (a) => a[0] === 'migrate' && a[1] === 'dev', why: '`prisma migrate dev` may reset the database when it detects drift' },
  { test: (a) => a[0] === 'db' && a[1] === 'push', why: '`prisma db push` bypasses migrations and can drop columns and tables' },
  { test: (a) => a[0] === 'db' && a[1] === 'execute', why: '`prisma db execute` runs arbitrary SQL' },
  { test: (a) => a.includes('--force-reset'), why: '--force-reset drops all data' },
  { test: (a) => a.includes('--accept-data-loss'), why: '--accept-data-loss allows dropping data' },
];

export function hostOf(databaseUrl) {
  try {
    return new URL(databaseUrl).hostname;
  } catch {
    return '';
  }
}

export function isLocalHost(host) {
  return LOCAL_HOSTS.has(host);
}

/** @returns {{ allow: boolean, reason?: string, host: string }} */
export function evaluate(args, env) {
  const host = hostOf(env.DATABASE_URL ?? '');
  const matched = DESTRUCTIVE_RULES.filter((rule) => rule.test(args));
  if (matched.length === 0) return { allow: true, host };

  const why = matched.map((rule) => rule.why).join('; ');
  const local = isLocalHost(host) && env.NODE_ENV !== 'production';
  if (local) return { allow: true, host };

  const confirmed = env.ALLOW_DESTRUCTIVE_DB === 'true' && host !== '' && env.CONFIRM_DATABASE_HOST === host;
  if (confirmed) return { allow: true, host };

  return {
    allow: false,
    host,
    reason:
      `Refusing to run "prisma ${args.join(' ')}": ${why}.\n` +
      `Target database host: ${host || '(unknown: DATABASE_URL is missing or unparseable)'}, NODE_ENV=${env.NODE_ENV ?? '(unset)'}.\n` +
      `This is only allowed against a local database outside production. To override deliberately, run once with:\n` +
      `  ALLOW_DESTRUCTIVE_DB=true CONFIRM_DATABASE_HOST=${host || '<host>'}\n` +
      `and make sure you have a verified backup first (see docs/DATABASE.md).`,
  };
}

/** Minimal .env reader (KEY=VALUE, optional quotes); never overrides variables that are already set. */
export function loadDotEnv(file, env) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || line.trim().startsWith('#')) continue;
    const [, key, raw] = match;
    if (key in env) continue;
    env[key] = raw.replace(/^(['"])(.*)\1$/, '$2');
  }
}

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const env = { ...process.env };
  loadDotEnv(path.join(root, '.env'), env);

  let args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('usage: node scripts/db-guard.mjs <prisma arguments...>');
    process.exit(2);
  }
  // `migrate diff` and `format`/`validate`/`generate` take a schema; default to the project's.
  if (!args.includes('--schema') && !(args[0] === 'migrate' && args[1] === 'diff')) {
    args = [...args, '--schema', path.join(root, 'apps/api/prisma/schema.prisma')];
  }

  const verdict = evaluate(args, env);
  if (!verdict.allow) {
    console.error(verdict.reason);
    process.exit(1);
  }
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const result = spawnSync(npx, ['prisma', ...args], { stdio: 'inherit', env, cwd: root, shell: process.platform === 'win32' });
  process.exit(result.status ?? 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
