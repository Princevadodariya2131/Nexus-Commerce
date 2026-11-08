# Nexus Commerce v2: technical validation report

## Verdict
* **Private preview deployment: reasonably safe, with conditions** (section 7).
* **Commercial production launch: NOT safe, and the project is NOT production-ready.** No payment is ever taken, there is no
  committed migration, key customer flows have no UI, and dependency vulnerabilities are untriaged (section 6).

## 1. What was tested, and what was not possible
* The uploaded `Nexus-Commerce-Updated-v2(1).zip` is **byte-identical** to the earlier `Nexus-Commerce-Updated-v2.zip`
  (same SHA-256 `0034cf1f…ce11`), so it contained none of the fixes from the previous round. It was extracted into a clean directory.
* **Blocked by the sandbox network allow-list:** `binaries.prisma.sh` (Prisma native engines) and `fonts.googleapis.com`.
  npm, GitHub and apt worked. Consequences are marked throughout. **The real Prisma CLI could not generate or apply
  a migration here**, so Phase 2 is only partly done (section 4).
* No Docker daemon: images were not built (the Dockerfile layouts were reproduced by hand and run).
* Real services used: Node 22, MySQL 8.0.46 (throwaway local instance). No real credentials, customers, payment providers
  or hosting accounts. Nothing was pushed, deployed or purchased.

## 2. Phase 1: build validation (final state of the delivered project)

| # | Command | As run in the sandbox | With only the Prisma engine-download check skipped* |
|---|---|---|---|
| 1 | `npm ci` | **exit 0**: 752 packages, 45 audit findings (4 critical, 20 high) | n/a |
| 2 | `npm run build` | **exit 1** (`binaries.prisma.sh` ENOTFOUND at `prisma generate`) | **exit 0** (shared, API `dist/`, web standalone, 16/16 routes) |
| 3 | `npm run build -w @nexus/api` | **exit 1** (same cause) | **exit 0** |
| 4 | `npm run build -w @nexus/web` | **exit 0**, no mocks, offline from Google | n/a |
| 5 | `npm run typecheck` | **exit 0** (fresh state; was exit 2 with 38 errors before the fix) | exit 0 |
| 6 | `npm test` | **exit 0**: API 211, web 7, scripts 54 = **272 pass, 0 fail** (was exit 1 on a fresh install) | exit 0 |
\* `PRISMA_SCHEMA_ENGINE_BINARY` / `PRISMA_QUERY_ENGINE_LIBRARY` pointed at placeholders so `prisma generate` skips the download
check. Types and TypeScript output are identical; this shows the code builds, **not** that Prisma's real engine works here. On a normal
network, steps 2-3 need no workaround; please run them once yourself.
Lint: `npm run lint` is **non-functional** (no ESLint configuration exists in either workspace; the web `next lint` opens an
interactive wizard). CI does not run lint. Not fixed (out of the requested scope); a config must be added.

Failures found and fixed: fresh-checkout `typecheck`/`test` failed because the Prisma client was never generated
(`pretypecheck`/`pretest` hooks added in `apps/api/package.json`); web build depended on Google Fonts at build time (self-hosted).

## 3. Changes made in this release
Application (all covered by new tests or the live harness): `order.service.ts` (atomic stock reservation, coupon clamp, per-user
limit, current price, restock-on-cancel, status-transition guard), `orderPolicy.ts`, `auth.service.ts` (refresh guard, `jti`,
`isActive`, session revocation on reset), `admin.controller.ts`/`admin.routes.ts`/`admin.validator.ts`, `vendor.routes.ts`/`vendor.validator.ts`,
`product.controller.ts`/`product.validator.ts`, `ai.routes.ts`, `errorHandler.ts`, `app.ts` (reset limiter), `serialize.ts`, new
`utils/ids.ts` and `utils/coupon.ts`. Details: SECURITY_TEST_REPORT.md.
Tooling/infra: `apps/api/Dockerfile`, `docker-compose.yml`, `.dockerignore`, `apps/web/src/app/layout.tsx` + `src/fonts/`,
`apps/web/public/.gitkeep`, `package.json` scripts (`db:baseline:candidate`), `scripts/baseline-candidate.mjs`.
Tests/docs: `apps/api/src/__tests__/hardening.test.ts` (+21), `scripts/__tests__/baseline-candidate.test.mjs` (+3), fake-DB extensions in
`helpers/testkit.ts`, `docs/audit/integration-harness/`, and these reports. **Nothing was deleted; no UI was redesigned; no feature was removed.**
One existing assertion was changed: a missing order previously surfaced Prisma's raw `P2025`; it is now an explicit 404 (same client result).

## 4. Phase 2: database migration: PARTIAL, and not done the way you asked
* **Not done:** generating the baseline with the Prisma CLI (`npm run db:baseline` exits 1, `binaries.prisma.sh` unreachable), `prisma migrate
  status`, and Prisma's own drift check. The WASM schema engine bundled in Prisma 6.19.3 crashes (`unreachable`) on every MySQL command, so it is no substitute.
* **Therefore no file was placed in `apps/api/prisma/migrations/`.** I will not present hand-derived SQL as a Prisma migration.
* **What exists instead:** `scripts/baseline-candidate.mjs` generates a *baseline candidate* from `schema.prisma` using Prisma's MySQL
  conventions into `apps/api/prisma/baseline-candidate/migration.sql` (420 lines, with a README). Verified on a **fresh MySQL 8.0.46** database:
  applied with exit 0; 18 tables; **24 foreign keys** (delete rules RESTRICT/CASCADE/SET NULL as the schema implies, matching the 24 `fields:` relations);
  **14 unique indexes (11 single-column + 3 compound) and 3 non-unique compound indexes**; an independent comparison of every column's type, nullability and enum members against
  `schema.prisma` found **0 differences**. Unit tests guard the generator.
* **You must still run, on a normal network:** `npm run db:baseline`, diff it against the candidate, commit the official migration, then
  `migrate deploy` + `migrate status` on a fresh DB (steps in the candidate's README).
* `database/nexus_commerce.sql` (XAMPP file) was also applied and compared: **40 differences** vs `schema.prisma` (34 are `DATETIME` vs `DATETIME(3)`;
  `banners.position` enum vs varchar; `reviews.rating` tinyint vs int; 4 unused bank-account columns on `vendors`; `NO ACTION` vs `RESTRICT` on 4 FKs). Its
  `INSERT`s also fail against a Prisma-shaped schema (they omit `updated_at`, which Prisma, not the DB, fills). It contains `DROP TABLE` statements. Retire it.
* **Correction of my earlier message:** I previously reported `blogs.content` and `analytics.date` as schema drift. That was a bug in *my* comparison script
  (it did not understand `@db.LongText`/`@db.Date`). They are not drift.

## 5. Payment and upload status
Stripe, Razorpay and Cloudinary are **not implemented** (config keys and unused packages only). Checkout records the chosen method as text and never
charges; orders never become `paid`. See `docs/PAYMENTS_IMPLEMENTATION_PLAN.md` (order creation, server-side verification, webhook signatures, duplicate
protection, failures, status updates, refunds). Nothing was run against a provider.

## 6. Exact blockers for commercial production
1. **No payments** (and no real tax/shipping): the shop cannot take money; revenue reports are permanently zero.
2. **No committed Prisma migration** and unverified `migrate status`/drift (needs a normal network; 10 minutes).
3. **Customer flows without UI:** forgot/reset password, verify e-mail, vendor onboarding, vendor products/orders; no way to promote a user to vendor/admin except SQL.
4. **Dependency vulnerabilities** (4 critical, 20 high) untriaged; `multer` 1.x deprecated.
5. **No file upload**; image URLs are free-form.
6. **Order can be created with no payment method** (O-2).
7. **Docker images unbuilt**; the live harness and Docker build are not in CI; lint non-functional.
8. **Operations:** SMTP, backups, monitoring, HTTPS/cookie verification on the real host, single-instance limit for sockets/rate limits.
9. A hosting decision: free tiers that permit commercial use are limited (DEPLOYMENT_READINESS.md).

## 7. Is a private preview safe?
**Yes, if:** the preview uses only demo data and no real customers or card details; `NODE_ENV=production` with strong, unique secrets so the
API's fail-fast checks apply; HTTPS; access limited (basic auth/IP allow-list or unlisted URL); seed demo accounts have the default passwords
changed or are not created (the seed refuses default passwords on non-local databases); the XAMPP SQL file is not imported; you accept that
checkout does not charge anyone. The authorization, vendor-isolation, socket and validation checks all passed against a real database. It is
**not** a statement that the app is free of vulnerabilities: browser-side security, dependency exploitability, load and proxy behaviour were not tested.

## 8. What to do next, in order
1. On a normal network: `npm ci && npm run build && npm run typecheck && npm test`; `npm run db:baseline`; commit the migration; `migrate deploy`/`status` on a fresh DB.
2. Run `docs/audit/integration-harness` against a disposable DB with your real Prisma engine; fix any difference.
3. `npm audit` triage; upgrade `multer` or remove it.
4. Build the missing UI pages; add ESLint; put the harness and a Docker build in CI.
5. Implement payments per the plan in provider test mode; then uploads.
6. Choose a paid always-on host with managed MySQL backups; rehearse deployment.
Do not call it production-ready until items 1-3 and the payment flow pass and a fresh independent security review is done.
