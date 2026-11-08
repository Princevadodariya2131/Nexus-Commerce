import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generate } from '../baseline-candidate.mjs';

const schema = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../apps/api/prisma/schema.prisma'), 'utf8');
const sql = generate(schema);
const count = (re, text) => (text.match(re) || []).length;

describe('baseline candidate generator', () => {
  it('creates one table per Prisma model and one foreign key per relation with fields', () => {
    assert.equal(count(/^CREATE TABLE /gm, sql), count(/^model \w+ \{/gm, schema));
    assert.equal(count(/^ALTER TABLE .* ADD CONSTRAINT .* FOREIGN KEY/gm, sql), count(/fields:\s*\[/g, schema));
  });
  it('is deterministic and never emits destructive statements', () => {
    assert.equal(generate(schema), sql);
    assert.doesNotMatch(sql, /\bDROP\b|\bTRUNCATE\b|\bDELETE FROM\b/i);
  });
  it('follows the Prisma MySQL conventions the project relies on', () => {
    assert.match(sql, /`email` VARCHAR\(\d+\) NOT NULL/);
    assert.match(sql, /DATETIME\(3\) NOT NULL DEFAULT CURRENT_TIMESTAMP\(3\)/);
    assert.match(sql, /ON DELETE CASCADE ON UPDATE CASCADE/);
    assert.match(sql, /ON DELETE SET NULL ON UPDATE CASCADE/);
    assert.match(sql, /ON DELETE RESTRICT ON UPDATE CASCADE/);
    assert.match(sql, /UNIQUE INDEX `users_email_key`/);
  });
});
