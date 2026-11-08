#!/usr/bin/env node
/**
 * Compares the OFFICIAL baseline (written by `npm run db:baseline`, apps/api/prisma/migrations/<ts>_init/migration.sql)
 * with the tested baseline CANDIDATE (apps/api/prisma/baseline-candidate/migration.sql).
 *
 * Both are reduced to a canonical form first, so cosmetic differences (comments, whitespace, statement order, column order
 * inside a table) are ignored while real differences (a column type, nullability, default, index, foreign key, delete rule)
 * are reported. Exit code: 0 equivalent, 1 differences, 2 the official migration is missing or ambiguous.
 *
 *   node scripts/compare-baseline.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const norm = (text) =>
  text
    .replace(/`/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([(),])\s*/g, '$1')
    .trim();

/** Split on commas that are not inside parentheses or quotes (ENUM('a','b'), DECIMAL(10,2)). */
export function splitTopLevel(text) {
  const parts = [];
  let depth = 0;
  let quote = null;
  let current = '';
  for (const char of text) {
    if (quote) {
      current += char;
      if (char === quote) quote = null;
    } else if (char === "'" || char === '"') {
      quote = char;
      current += char;
    } else if (char === '(') {
      depth++;
      current += char;
    } else if (char === ')') {
      depth--;
      current += char;
    } else if (char === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) parts.push(current);
  return parts;
}

export function canonicalize(sql) {
  const cleaned = sql
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !/^\s*--/.test(line))
    .join('\n');
  const statements = cleaned.split(/;\s*(?:\n|$)/).map((s) => s.trim()).filter(Boolean);
  const entries = new Map();
  for (const statement of statements) {
    let m = statement.match(/^CREATE TABLE\s+`?(\w+)`?\s*\(([\s\S]*)\)\s*([^)]*)$/i);
    if (m) {
      const definitions = splitTopLevel(m[2]).map(norm).sort();
      entries.set(`table ${m[1]}`, `${norm(m[3])} :: ${definitions.join(' ;; ')}`);
      continue;
    }
    m = statement.match(/^ALTER TABLE\s+`?(\w+)`?\s+ADD CONSTRAINT\s+`?(\w+)`?/i);
    if (m) {
      entries.set(`constraint ${m[1]}.${m[2]}`, norm(statement));
      continue;
    }
    m = statement.match(/^CREATE (?:UNIQUE )?INDEX\s+`?(\w+)`?\s+ON\s+`?(\w+)`?/i);
    if (m) {
      entries.set(`index ${m[2]}.${m[1]}`, norm(statement));
      continue;
    }
    entries.set(`other ${norm(statement)}`, norm(statement));
  }
  return entries;
}

export function compare(officialSql, candidateSql) {
  const official = canonicalize(officialSql);
  const candidate = canonicalize(candidateSql);
  const onlyOfficial = [...official.keys()].filter((key) => !candidate.has(key)).sort();
  const onlyCandidate = [...candidate.keys()].filter((key) => !official.has(key)).sort();
  const different = [...official.keys()]
    .filter((key) => candidate.has(key) && candidate.get(key) !== official.get(key))
    .sort()
    .map((key) => ({ key, official: official.get(key), candidate: candidate.get(key) }));
  return {
    equal: onlyOfficial.length === 0 && onlyCandidate.length === 0 && different.length === 0,
    onlyOfficial,
    onlyCandidate,
    different,
    counts: { official: official.size, candidate: candidate.size },
  };
}

/** Returns the single official migration.sql; throws when there is none or more than one. */
export function findOfficialMigration(migrationsDir) {
  if (!fs.existsSync(migrationsDir)) throw new Error(`No migrations folder at ${migrationsDir}. Run "npm run db:baseline" first.`);
  const dirs = fs.readdirSync(migrationsDir, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  if (dirs.length === 0) throw new Error(`No migration found in ${migrationsDir}. Run "npm run db:baseline" first.`);
  if (dirs.length > 1) throw new Error(`Expected exactly one baseline migration, found ${dirs.length}: ${dirs.map((d) => d.name).join(', ')}`);
  const file = path.join(migrationsDir, dirs[0].name, 'migration.sql');
  if (!fs.existsSync(file)) throw new Error(`Missing ${file}`);
  return file;
}

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  let officialFile;
  try {
    officialFile = findOfficialMigration(path.join(root, 'apps/api/prisma/migrations'));
  } catch (error) {
    console.error(error.message);
    process.exit(2);
  }
  const candidateFile = path.join(root, 'apps/api/prisma/baseline-candidate/migration.sql');
  const result = compare(fs.readFileSync(officialFile, 'utf8'), fs.readFileSync(candidateFile, 'utf8'));
  console.log(`official:  ${path.relative(root, officialFile)} (${result.counts.official} objects)`);
  console.log(`candidate: ${path.relative(root, candidateFile)} (${result.counts.candidate} objects)`);
  if (result.equal) {
    console.log('\nEQUIVALENT: the official baseline matches the tested candidate (ignoring comments, whitespace and ordering).');
    return;
  }
  const show = (title, items) => {
    if (items.length === 0) return;
    console.log(`\n${title} (${items.length})`);
    items.slice(0, 15).forEach((item) => console.log(`  - ${item}`));
  };
  show('Only in the OFFICIAL baseline', result.onlyOfficial);
  show('Only in the CANDIDATE', result.onlyCandidate);
  if (result.different.length) {
    console.log(`\nDifferent definitions (${result.different.length})`);
    for (const d of result.different.slice(0, 5)) console.log(`  * ${d.key}\n      official : ${d.official.slice(0, 220)}\n      candidate: ${d.candidate.slice(0, 220)}`);
  }
  console.log('\nDIFFERENT: review each item above before using the official migration. Differences are not automatically errors');
  console.log('(the official Prisma output is the authority), but every one must be understood before applying it.');
  process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
