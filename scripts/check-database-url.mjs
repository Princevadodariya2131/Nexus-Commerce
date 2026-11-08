#!/usr/bin/env node
/**
 * Checks the SHAPE of a DATABASE_URL before you paste it into the host's dashboard. It never prints the password.
 * The URL is read from the DATABASE_URL environment variable (not from an argument, so it does not end up in your shell history):
 *
 *   PowerShell:  $env:DATABASE_URL = "mysql://..."; node scripts/check-database-url.mjs
 *   bash/zsh:    read -rs DATABASE_URL && export DATABASE_URL && node scripts/check-database-url.mjs
 *
 * Exit code: 0 no problems (warnings may remain), 1 problems.
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/** @returns {{ ok: boolean, problems: string[], warnings: string[], summary: object }} */
export function evaluateDatabaseUrl(raw) {
  const problems = [];
  const warnings = [];
  let url;
  try {
    url = new URL(raw);
  } catch {
    return {
      ok: false,
      problems: ['DATABASE_URL is missing or is not a valid URL. A password containing @ / ? # % must be percent-encoded (for example @ becomes %40).'],
      warnings,
      summary: {},
    };
  }

  const summary = {
    host: url.hostname,
    port: url.port || '(none)',
    database: url.pathname.replace(/^\//, '') || '(none)',
    user: decodeURIComponent(url.username || '') || '(none)',
    passwordSet: url.password.length > 0,
  };

  if (url.protocol !== 'mysql:') problems.push(`The scheme must be mysql:// (found ${url.protocol}//).`);
  if (!url.hostname) problems.push('The host is missing.');
  else if (['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname)) problems.push('The host is local; the hosted API cannot reach your machine.');
  if (!url.port) problems.push('The port is missing. Aiven gives every service its own port; copy it from the console (it is not 3306).');
  if (!summary.database || summary.database === '(none)') problems.push('The database name is missing (Aiven creates one called defaultdb).');
  if (!summary.passwordSet) problems.push('The password is missing.');

  // The standard URL parser tolerates a raw "@" in the password, but other parsers (Prisma's included) may not.
  const authority = raw.replace(/^[a-z]+:\/\//i, '').split('/')[0];
  if ((authority.match(/@/g) || []).length > 1) {
    warnings.push('The password appears to contain an unencoded "@". Percent-encode it as %40 (and encode / ? # as %2F %3F %23) so every parser reads the URL the same way.');
  }

  const params = url.searchParams;
  const sslaccept = params.get('sslaccept');
  if (sslaccept !== 'strict') {
    problems.push(
      sslaccept === 'accept_invalid_certs'
        ? 'sslaccept=accept_invalid_certs encrypts but does NOT verify the server. Use sslaccept=strict with sslcert.'
        : 'sslaccept=strict is missing. Prisma defaults to accept_invalid_certs, which does not verify the server.'
    );
  }
  const sslcert = params.get('sslcert');
  if (!sslcert) problems.push('sslcert is missing: point it at the CA certificate inside the container, e.g. /app/apps/api/certs/aiven-ca.pem.');
  else if (!path.posix.isAbsolute(sslcert)) {
    problems.push('sslcert must be an absolute path inside the container. Prisma resolves relative paths against the prisma/ folder, which the runtime image does not contain.');
  }

  const limit = params.get('connection_limit');
  if (!limit) warnings.push('connection_limit is not set. Aiven free allows 76 connections in total; add connection_limit=5.');
  else if (!(Number(limit) >= 1 && Number(limit) <= 10)) warnings.push(`connection_limit=${limit} is outside the recommended 1-10 range for a free-tier database.`);
  const connectTimeout = Number(params.get('connect_timeout'));
  if (!connectTimeout || connectTimeout < 20) warnings.push('Consider connect_timeout=30: a sleeping free database or API can take a while to answer.');
  if (summary.user === 'avnadmin') warnings.push('You are using the Aiven admin user (avnadmin). Acceptable for a private demo; create a restricted application user for anything more.');
  if (summary.host && !summary.host.endsWith('aivencloud.com') && problems.length === 0) warnings.push('The host is not an aivencloud.com name; check that this is the database you intend to use.');

  return { ok: problems.length === 0, problems, warnings, summary };
}

function main() {
  const result = evaluateDatabaseUrl(process.env.DATABASE_URL ?? '');
  const { summary } = result;
  if (summary.host) {
    console.log(`host: ${summary.host}  port: ${summary.port}  database: ${summary.database}  user: ${summary.user}  password: ${summary.passwordSet ? 'set (hidden)' : 'MISSING'}`);
  }
  result.problems.forEach((p) => console.log(`PROBLEM  ${p}`));
  result.warnings.forEach((w) => console.log(`warning  ${w}`));
  console.log(result.ok ? '\nOK: the URL has the shape the API needs.' : '\nNOT OK: fix the problems above before using this URL.');
  process.exit(result.ok ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
