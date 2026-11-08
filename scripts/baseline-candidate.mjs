#!/usr/bin/env node
/**
 * Baseline CANDIDATE generator - NOT a replacement for `npm run db:baseline`.
 *
 * Reads apps/api/prisma/schema.prisma and emits MySQL DDL that follows the conventions Prisma Migrate
 * uses for the mysql provider (VARCHAR(191) strings, DATETIME(3), `<table>_<cols>_key|idx` names,
 * ON UPDATE CASCADE, SET NULL for optional relations, RESTRICT for required ones).
 *
 * It exists because the official generator (`prisma migrate diff`) needs Prisma's native schema engine,
 * which cannot be downloaded in some locked-down environments. The output is written to
 * apps/api/prisma/baseline-candidate/migration.sql - deliberately OUTSIDE prisma/migrations/ - and must be
 * compared with the real Prisma output before it is trusted:
 *
 *   npm run db:baseline                          # official, needs network access to binaries.prisma.sh
 *   diff apps/api/prisma/migrations/*_baseline/migration.sql apps/api/prisma/baseline-candidate/migration.sql
 *
 * Usage: node scripts/baseline-candidate.mjs [--stdout]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const schemaPath = path.join(root, 'apps/api/prisma/schema.prisma');
const outDir = path.join(root, 'apps/api/prisma/baseline-candidate');

export function parseSchema(text) {
  const enums = {};
  for (const m of text.matchAll(/^enum (\w+) \{([\s\S]*?)^\}/gm)) {
    enums[m[1]] = m[2].split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('//'));
  }
  const models = {};
  for (const m of text.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)) {
    models[m[1]] = { name: m[1], body: m[2] };
  }
  const SCALARS = new Set(['String', 'Int', 'Boolean', 'DateTime', 'Decimal', 'Json', 'Float', 'BigInt']);
  for (const model of Object.values(models)) {
    model.table = /@@map\("(\w+)"\)/.exec(model.body)[1];
    model.cols = [];
    model.rels = [];
    model.indexes = [];
    for (const raw of model.body.split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('//')) continue;
      if (line.startsWith('@@')) {
        const idx = /^@@(index|unique)\(\[([^\]]+)\]/.exec(line);
        if (idx) model.indexes.push({ unique: idx[1] === 'unique', fields: idx[2].split(',').map((s) => s.trim()) });
        continue;
      }
      const f = /^(\w+)\s+(\w+)(\?|\[\])?\s*(.*)$/.exec(line);
      if (!f) continue;
      const [, name, type, mod, rest] = f;
      if (mod === '[]') continue;
      if (type in models || (!SCALARS.has(type) && !(type in enums))) {
        const rel = /@relation\(([^)]*)\)/.exec(rest);
        const fields = rel && /fields:\s*\[([^\]]+)\]/.exec(rel[1]);
        if (fields) {
          model.rels.push({
            fields: fields[1].split(',').map((s) => s.trim()),
            refs: /references:\s*\[([^\]]+)\]/.exec(rel[1])[1].split(',').map((s) => s.trim()),
            target: type,
            optional: mod === '?',
            onDelete: (/onDelete:\s*(\w+)/.exec(rel[1]) || [])[1],
            onUpdate: (/onUpdate:\s*(\w+)/.exec(rel[1]) || [])[1],
          });
        }
        continue;
      }
      model.cols.push({
        field: name,
        type,
        optional: mod === '?',
        column: (/@map\("(\w+)"\)/.exec(rest) || [])[1] || name,
        native: /@db\.(\w+)(?:\(([^)]*)\))?/.exec(rest),
        def: /@default\((.*?)\)(?=\s|$|@)/.exec(rest)?.[1],
        unique: /@unique\b/.test(rest),
        id: /@id\b/.test(rest),
      });
    }
  }
  return { enums, models };
}

function sqlType(col, enums) {
  const [, native, arg] = col.native || [];
  switch (col.type) {
    case 'String':
      if (native === 'Text') return 'TEXT';
      if (native === 'LongText') return 'LONGTEXT';
      return `VARCHAR(${native === 'VarChar' ? arg : 191})`;
    case 'Int': return native === 'UnsignedInt' ? 'INTEGER UNSIGNED' : 'INTEGER';
    case 'Boolean': return 'BOOLEAN';
    case 'DateTime': return native === 'Date' ? 'DATE' : 'DATETIME(3)';
    case 'Decimal': return arg ? `DECIMAL(${arg.replace(/\s/g, '')})` : 'DECIMAL(65, 30)';
    case 'Json': return 'JSON';
    case 'Float': return 'DOUBLE';
    case 'BigInt': return 'BIGINT';
    default:
      if (enums[col.type]) return `ENUM(${enums[col.type].map((v) => `'${v}'`).join(', ')})`;
      throw new Error(`Unsupported type ${col.type}`);
  }
}

function sqlDefault(col) {
  if (col.def === undefined || col.def === 'autoincrement()') return '';
  if (col.def === 'now()') return ' DEFAULT CURRENT_TIMESTAMP(3)';
  if (/^".*"$/.test(col.def)) return ` DEFAULT '${col.def.slice(1, -1).replace(/'/g, "''")}'`;
  if (/^-?\d+(\.\d+)?$/.test(col.def) || col.def === 'true' || col.def === 'false') return ` DEFAULT ${col.def}`;
  return ` DEFAULT '${col.def}'`; // enum member
}

export function generate(text) {
  const { enums, models } = parseSchema(text);
  const colOf = (model, field) => model.cols.find((c) => c.field === field)?.column ?? field;
  const out = ['-- Baseline CANDIDATE generated by scripts/baseline-candidate.mjs from apps/api/prisma/schema.prisma.', '-- NOT produced by the Prisma CLI. Compare with `npm run db:baseline` output before relying on it.', ''];
  const names = Object.keys(models).sort((a, b) => models[a].table.localeCompare(models[b].table));
  for (const n of names) {
    const m = models[n];
    const lines = m.cols.map((c) => {
      const auto = c.def === 'autoincrement()' ? ' AUTO_INCREMENT' : '';
      return `    \`${c.column}\` ${sqlType(c, enums)}${c.optional ? ' NULL' : ' NOT NULL'}${sqlDefault(c)}${auto}`;
    });
    for (const c of m.cols.filter((c) => c.unique)) lines.push(`    UNIQUE INDEX \`${m.table}_${c.column}_key\`(\`${c.column}\`)`);
    for (const ix of m.indexes) {
      const cols = ix.fields.map((f) => colOf(m, f));
      lines.push(`    ${ix.unique ? 'UNIQUE ' : ''}INDEX \`${m.table}_${cols.join('_')}_${ix.unique ? 'key' : 'idx'}\`(${cols.map((c) => `\`${c}\``).join(', ')})`);
    }
    const pk = m.cols.filter((c) => c.id).map((c) => `\`${c.column}\``).join(', ');
    lines.push(`    PRIMARY KEY (${pk})`);
    out.push(`-- CreateTable\nCREATE TABLE \`${m.table}\` (\n${lines.join(',\n')}\n) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\n`);
  }
  for (const n of names) {
    const m = models[n];
    for (const r of m.rels) {
      const cols = r.fields.map((f) => colOf(m, f));
      const target = models[r.target];
      const refs = r.refs.map((f) => colOf(target, f));
      const del = { Cascade: 'CASCADE', Restrict: 'RESTRICT', SetNull: 'SET NULL', NoAction: 'NO ACTION' }[r.onDelete] ?? (r.optional ? 'SET NULL' : 'RESTRICT');
      const upd = { Cascade: 'CASCADE', Restrict: 'RESTRICT', SetNull: 'SET NULL', NoAction: 'NO ACTION' }[r.onUpdate] ?? 'CASCADE';
      out.push(`-- AddForeignKey\nALTER TABLE \`${m.table}\` ADD CONSTRAINT \`${m.table}_${cols.join('_')}_fkey\` FOREIGN KEY (${cols.map((c) => `\`${c}\``).join(', ')}) REFERENCES \`${target.table}\`(${refs.map((c) => `\`${c}\``).join(', ')}) ON DELETE ${del} ON UPDATE ${upd};\n`);
    }
  }
  return out.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const sqlText = generate(fs.readFileSync(schemaPath, 'utf8'));
  if (process.argv.includes('--stdout')) process.stdout.write(sqlText);
  else {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'migration.sql'), sqlText);
    console.log(`Wrote ${path.relative(root, path.join(outDir, 'migration.sql'))} (${sqlText.split('\n').length} lines)`);
  }
}
