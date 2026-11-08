# Baseline migration CANDIDATE - read before using

`migration.sql` here was produced by `scripts/baseline-candidate.mjs` (`npm run db:baseline:candidate`) from
`schema.prisma`. **It was not produced by the Prisma CLI.** It exists because the official generator
(`npm run db:baseline`, which runs `prisma migrate diff`) needs Prisma's native schema engine, and that binary
could not be downloaded in the environment where this project was audited.

## What was verified
Applied to a fresh, disposable MySQL 8.0 database: 18 tables, 24 foreign keys, 14 unique indexes (11 single-column + 3 compound) and the
3 compound indexes were created, and an independent structural comparison of every column (type, nullability,
enum members) against `schema.prisma` found 0 differences.

## What was NOT verified
`prisma migrate status` and `prisma migrate diff --exit-code` (Prisma's own drift check) were not run.
Small cosmetic differences from real Prisma output (statement order, spacing, constraint naming) are possible.

## Before the first production deployment (needs normal internet access)
```bash
npm run db:baseline                      # official; writes apps/api/prisma/migrations/<timestamp>_baseline/
diff apps/api/prisma/migrations/*_baseline/migration.sql apps/api/prisma/baseline-candidate/migration.sql
git add apps/api/prisma/migrations && git commit
# existing database that was created from database/nexus_commerce.sql or by `db push`:
npx prisma migrate resolve --applied <timestamp>_baseline
# brand-new database:
npx prisma migrate deploy && npx prisma migrate status
```
Once the official migration is committed, delete this directory.
