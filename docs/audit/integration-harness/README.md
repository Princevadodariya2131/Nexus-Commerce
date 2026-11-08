# Live integration / security harness

~230 checks against a **running API and a real MySQL database**: role-based access, vendor product/order ownership,
vendors without an approved profile, JWT forgery, Socket.io authentication and room permissions, product-field
validation, admin rules, cart, checkout (totals, stock, coupons, concurrency), order tracking, auth-token
lifecycle, malformed-input robustness and security headers.

It complements the unit tests (`npm test`), which run against an in-memory fake database and therefore cannot see
MySQL/Prisma behaviour (transactions, locking, constraints, query-parameter handling).

## Safety
It **creates users, products, coupons and orders** and changes roles directly in the database. It refuses to run
unless `AUDIT_CONFIRM=THIS-DATABASE-IS-DISPOSABLE` is set, `AUDIT_MYSQL_DB` is given, and the database host is
local. Never point it at staging or production data.

## Run
```bash
# 1. a disposable local MySQL 8 with the schema, seeded with the demo catalogue
mysql -uroot -e "CREATE DATABASE nexus_audit CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
mysql -uroot nexus_audit < apps/api/prisma/baseline-candidate/migration.sql     # or: prisma migrate deploy
DATABASE_URL=mysql://root@127.0.0.1:3306/nexus_audit npm run seed --workspace=@nexus/api

# 2. the API, development mode (the production rate limiters would throttle the test run)
DATABASE_URL=mysql://root@127.0.0.1:3306/nexus_audit PORT=4000 CLIENT_URL=http://localhost:3000 \
  JWT_SECRET=$(openssl rand -base64 48) JWT_REFRESH_SECRET=$(openssl rand -base64 48) COOKIE_SECRET=$(openssl rand -base64 48) \
  npm run dev:api

# 3. the harness (needs the mysql client on PATH)
npm i --no-save socket.io-client@4
AUDIT_CONFIRM=THIS-DATABASE-IS-DISPOSABLE AUDIT_MYSQL_DB=nexus_audit node docs/audit/integration-harness/audit-tests.mjs
```
Exit code 0 means the harness ran to completion, not that everything passed: read the `FAIL` lines (also written to
`audit-results.json`). Checks labelled `INFO` record behaviour without judging it.

## Known harness-expectation differences (not application bugs)
* `SEC-VAL-cat-missing`: the harness expects `null`; the application correctly answers 400 (its follow-up check `-b` passes).
* `SEC-VS-*-read-dashboard`: a pending/suspended vendor intentionally gets 200 with its own status and zeroed
  statistics (the vendor page needs that); a vendor with no profile gets 404 (the UI shows "apply"). Product and
  order reads for non-approved vendors are 403.
