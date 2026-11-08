import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { canonicalize, compare, findOfficialMigration, splitTopLevel } from '../compare-baseline.mjs';
import { evaluateDatabaseUrl } from '../check-database-url.mjs';

const candidateFile = path.resolve(import.meta.dirname, '../../apps/api/prisma/baseline-candidate/migration.sql');
const candidate = fs.readFileSync(candidateFile, 'utf8');

describe('compare-baseline: canonical comparison', () => {
  it('the real candidate is equivalent to itself and has 18 tables, 24 constraints', () => {
    const result = compare(candidate, candidate);
    assert.equal(result.equal, true);
    const keys = [...canonicalize(candidate).keys()];
    assert.equal(keys.filter((k) => k.startsWith('table ')).length, 18);
    assert.equal(keys.filter((k) => k.startsWith('constraint ')).length, 24);
  });
  it('ignores comments, whitespace, statement order and column order', () => {
    const a = 'CREATE TABLE `t` (\n  `id` INTEGER NOT NULL,\n  `name` VARCHAR(191) NOT NULL,\n  PRIMARY KEY (`id`)\n) DEFAULT CHARACTER SET utf8mb4;\nCREATE TABLE `u` (`id` INTEGER NOT NULL, PRIMARY KEY (`id`)) DEFAULT CHARACTER SET utf8mb4;\n';
    const b = '-- generated\n/* note */\nCREATE TABLE   `u` (\n `id`   INTEGER   NOT NULL ,\n PRIMARY KEY(`id`)\n) DEFAULT CHARACTER SET utf8mb4;\n\nCREATE TABLE `t` (\n PRIMARY KEY (`id`),\n `name` VARCHAR(191) NOT NULL,\n `id` INTEGER NOT NULL\n) DEFAULT CHARACTER SET utf8mb4;\n';
    assert.equal(compare(a, b).equal, true);
  });
  it('detects a changed column type, nullability and default', () => {
    const base = 'CREATE TABLE `t` (`id` INTEGER NOT NULL, `price` DECIMAL(12, 2) NOT NULL, PRIMARY KEY (`id`)) DEFAULT CHARACTER SET utf8mb4;';
    for (const changed of [base.replace('DECIMAL(12, 2)', 'DECIMAL(10, 2)'), base.replace('`price` DECIMAL(12, 2) NOT NULL', '`price` DECIMAL(12, 2) NULL'), base.replace('NOT NULL, PRIMARY', 'NOT NULL DEFAULT 0, PRIMARY')]) {
      const result = compare(base, changed);
      assert.equal(result.equal, false);
      assert.deepEqual(result.different.map((d) => d.key), ['table t']);
    }
  });
  it('detects a missing or extra table, foreign key and index', () => {
    const fk = 'ALTER TABLE `a` ADD CONSTRAINT `a_b_fkey` FOREIGN KEY (`b_id`) REFERENCES `b`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;';
    assert.deepEqual(compare(candidate, candidate.replace(/ALTER TABLE `[a-z_]+` ADD CONSTRAINT[^;]*;/, '')).onlyOfficial.length, 1);
    assert.equal(compare('', fk).onlyCandidate.length, 1);
    assert.equal(compare(fk, fk.replace('RESTRICT', 'CASCADE')).different.length, 1, 'a changed delete rule must be reported');
    assert.equal(compare('CREATE TABLE `x` (`id` INTEGER NOT NULL, PRIMARY KEY (`id`));', '').onlyOfficial[0], 'table x');
    assert.equal(compare(candidate.replace(/UNIQUE INDEX [^\n]*\n/, ''), candidate).equal, false, 'a removed unique index must be reported');
  });
  it('does not split ENUM lists or DECIMAL precision on their commas', () => {
    assert.deepEqual(splitTopLevel("`a` ENUM('x','y,z') NOT NULL, `b` DECIMAL(10, 2), `c` INT").map((s) => s.trim()), ["`a` ENUM('x','y,z') NOT NULL", '`b` DECIMAL(10, 2)', '`c` INT']);
  });
});

describe('compare-baseline: locating the official migration', () => {
  const make = (...names) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mig-'));
    for (const n of names) {
      fs.mkdirSync(path.join(dir, n), { recursive: true });
      fs.writeFileSync(path.join(dir, n, 'migration.sql'), '-- x');
    }
    return dir;
  };
  it('returns the single migration', () => assert.match(findOfficialMigration(make('20260101000000_init')), /20260101000000_init[\\/]migration\.sql$/));
  it('fails clearly when missing, empty or ambiguous', () => {
    assert.throws(() => findOfficialMigration(path.join(os.tmpdir(), 'nope-' + Date.now())), /db:baseline/);
    assert.throws(() => findOfficialMigration(fs.mkdtempSync(path.join(os.tmpdir(), 'mig-'))), /No migration found/);
    assert.throws(() => findOfficialMigration(make('a', 'b')), /exactly one/);
  });
});

describe('check-database-url', () => {
  const good = 'mysql://avnadmin:s3cret@mysql-demo-example.aivencloud.com:12345/defaultdb?sslaccept=strict&sslcert=/app/apps/api/certs/aiven-ca.pem&connection_limit=5&connect_timeout=30';
  it('accepts the intended shape and never echoes the password', () => {
    const r = evaluateDatabaseUrl(good);
    assert.equal(r.ok, true, r.problems.join('; '));
    assert.equal(JSON.stringify(r).includes('s3cret'), false);
    assert.equal(r.summary.passwordSet, true);
    assert.equal(r.summary.port, '12345');
  });
  const bad = (url, pattern) => {
    const r = evaluateDatabaseUrl(url);
    assert.equal(r.ok, false);
    assert.ok(r.problems.some((p) => pattern.test(p)), `expected a problem matching ${pattern}, got: ${r.problems.join(' | ')}`);
  };
  it('rejects every unsafe or incomplete variant', () => {
    bad('', /not a valid URL/);
    bad('not a url', /not a valid URL/);
    bad(good.replace('mysql://', 'postgresql://'), /scheme/);
    bad(good.replace('sslaccept=strict', 'sslaccept=accept_invalid_certs'), /accept_invalid_certs/);
    bad(good.replace('sslaccept=strict&', ''), /sslaccept=strict is missing/);
    bad(good.replace('&sslcert=/app/apps/api/certs/aiven-ca.pem', ''), /sslcert is missing/);
    bad(good.replace('/app/apps/api/certs/aiven-ca.pem', './aiven-ca.pem'), /absolute path/);
    bad(good.replace(':12345', ''), /port is missing/);
    bad(good.replace('/defaultdb', ''), /database name/);
    bad(good.replace('avnadmin:s3cret', 'avnadmin'), /password is missing/);
    bad(good.replace('mysql-demo-example.aivencloud.com', 'localhost'), /local/);
  });
  it('warns, without failing, about pool size, timeout and the admin user', () => {
    const r = evaluateDatabaseUrl(good.replace('&connection_limit=5', '').replace('&connect_timeout=30', ''));
    assert.equal(r.ok, true);
    assert.ok(r.warnings.some((w) => /connection_limit/.test(w)));
    assert.ok(r.warnings.some((w) => /connect_timeout/.test(w)));
    assert.ok(r.warnings.some((w) => /avnadmin/.test(w)));
  });
  it('warns about an unencoded @ in the password but accepts the encoded form silently', () => {
    const tail = '@host.aivencloud.com:1/db?sslaccept=strict&sslcert=/c.pem&connection_limit=5&connect_timeout=30';
    assert.ok(evaluateDatabaseUrl('mysql://u:p@ss' + tail).warnings.some((w) => /unencoded "@"/.test(w)));
    assert.equal(evaluateDatabaseUrl('mysql://u:p%40ss' + tail).warnings.some((w) => /unencoded/.test(w)), false);
  });
});

describe('preview packaging (static guards)', () => {
  const root = path.resolve(import.meta.dirname, '../..');
  const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

  it('.gitignore lets the public CA file through, and only that .pem', () => {
    const lines = read('.gitignore').split(/\r?\n/);
    const ignoreAll = lines.indexOf('*.pem');
    const allow = lines.indexOf('!apps/api/certs/aiven-ca.pem');
    assert.ok(ignoreAll >= 0 && allow > ignoreAll, 'the negation must come after *.pem');
    assert.equal(lines.filter((l) => l.startsWith('!') && l.includes('.pem')).length, 1, 'no broader .pem exceptions');
  });
  it('the API image copies the certificate folder, which exists in the repo', () => {
    assert.match(read('apps/api/Dockerfile'), /COPY --from=builder \/app\/apps\/api\/certs \.\/apps\/api\/certs/);
    assert.ok(fs.existsSync(path.join(root, 'apps/api/certs/.gitkeep')));
  });
  it('render.yaml keeps secrets out of the repo and supplies every variable production requires', () => {
    const yaml = read('render.yaml');
    for (const key of ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'COOKIE_SECRET']) assert.match(yaml, new RegExp(`key: ${key}\\s+generateValue: true`));
    for (const key of ['DATABASE_URL', 'CLIENT_URL']) assert.match(yaml, new RegExp(`key: ${key}\\s+sync: false`));
    assert.match(yaml, /autoDeployTrigger: "off"/);
    assert.equal(/mysql:\/\/[^\s<]+:[^\s<]+@/.test(yaml.replace(/^\s*#.*$/gm, '')), false, 'no connection string with credentials in executable lines');
  });
  it('the config really requires the variables the blueprint supplies', () => {
    const config = read('apps/api/src/config/index.ts');
    for (const key of ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'COOKIE_SECRET', 'DATABASE_URL', 'CLIENT_URL']) assert.ok(config.includes(`'${key}'`), key);
  });
  it('the db scripts the runbook relies on exist in package.json', () => {
    const scripts = JSON.parse(read('package.json')).scripts;
    for (const name of ['db:baseline', 'db:baseline:compare', 'db:check-url', 'db:migrate:deploy', 'db:migrate:status', 'db:validate']) assert.ok(scripts[name], name);
  });
});
