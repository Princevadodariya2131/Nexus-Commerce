# Database guide (MySQL 8 + Prisma)

Prisma provider: `mysql`. 18 models, 24 foreign keys, schema in `apps/api/prisma/schema.prisma`.

> **Status when this was prepared:** no Prisma migrations were committed, and the Prisma CLI could not be run
> (no network access in the preparation environment). Step 3 below creates the baseline with the real CLI.
> **Nothing in this guide has been executed against a real MySQL server yet.** Do steps 3 and 4 on a throw-away
> local database before the first production deployment.

## 1. What protects your data

| Layer | Protection |
|---|---|
| Application | No endpoint deletes users, orders or vendors. Products are soft-deleted (`isActive=false`). Only cart and wishlist rows are hard-deleted, scoped to the owner. |
| Schema | `Order -> User`, `OrderItem -> Product` and `Blog -> User` use Prisma's default **Restrict**: a user who placed an order, or a product that was ever ordered, cannot be deleted. Cascades exist only for dependent rows (cart items, order items/status history, reviews, addresses, notifications, wishlist). |
| Tooling | `npm run db:*` goes through `scripts/db-guard.mjs`. `migrate reset`, `migrate dev`, `db push`, `db execute`, `--force-reset` and `--accept-data-loss` run only against a **local** database outside production. Anywhere else they are refused unless you set, for that one command, `ALLOW_DESTRUCTIVE_DB=true` **and** `CONFIRM_DATABASE_HOST=<the exact host>`. |
| Seed | `npm run seed` deletes all data. It refuses non-local databases and production unless `ALLOW_DESTRUCTIVE_SEED=true` and strong `SEED_*_PASSWORD` values are supplied. |
| Database user | Run the API with a user that can only `SELECT, INSERT, UPDATE, DELETE` (section 5). It then cannot `DROP`, `TRUNCATE` or `ALTER` even if the application is compromised. |
| Backups | Take and **test a restore** before every migration and on a schedule (section 8). |

Calling `prisma` directly bypasses the guard. Always use the npm scripts.

## 2. Local development

```bash
# 1. empty database with a modern character set
mysql -u root -e "CREATE DATABASE nexus_commerce CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
# 2. copy .env.example to .env and set DATABASE_URL=mysql://root@localhost:3306/nexus_commerce
npm ci
npm run db:generate
npm run db:migrate:deploy      # after the baseline exists (step 3); before that: npm run db:push --workspace=@nexus/api
npm run seed --workspace=@nexus/api   # local only: deletes everything first
```

Do not run `db:push` against an existing database that was created from `database/nexus_commerce.sql`: that
hand-written dump has four extra `vendors.bank_*` columns Prisma does not know about, and Prisma would offer to drop them.
Create a fresh database instead.

## 3. One-time: create the baseline migration (requires the Prisma CLI)

```bash
npm ci
npm run db:baseline            # prisma migrate diff --from-empty --to-schema-datamodel ... --script
git diff --stat apps/api/prisma/migrations
```

This needs no database connection and refuses to run if migrations already exist. **Read the generated
`migration.sql`**: expect 18 `CREATE TABLE` statements, unique indexes and 24 `FOREIGN KEY` constraints, and no `DROP`.
Commit `apps/api/prisma/migrations/` (including `migration_lock.toml`).

## 4. Verify the migration on a fresh MySQL database

```bash
mysql -u root -e "CREATE DATABASE nexus_verify CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
export DATABASE_URL="mysql://root@localhost:3306/nexus_verify"
npm run db:migrate:deploy                      # applies the migration
npm run db:migrate:status                      # "Database schema is up to date"
# the database must now equal schema.prisma (exit code 0 = no differences):
npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel apps/api/prisma/schema.prisma --exit-code
mysql -u root -e "DROP DATABASE nexus_verify"  # throw-away database only
```

CI repeats this automatically on a fresh MySQL service container once migrations are committed
(`.github/workflows/ci.yml`, step "Migrations - apply to a fresh database and check for schema drift"), including a
drift check against an empty shadow database.

## 5. First-time setup of a hosted database

1. Create an **empty** database and two users with your provider's tooling (syntax varies by provider):
   - a *migration* user with DDL rights (`CREATE, ALTER, DROP, INDEX, REFERENCES` plus DML) used only to run migrations;
   - an *application* user with DML only:
     ```sql
     CREATE USER 'nexus_app'@'%' IDENTIFIED BY '<long random password>';
     GRANT SELECT, INSERT, UPDATE, DELETE ON nexus.* TO 'nexus_app'@'%';
     ```
2. Take a backup if the database is not empty (section 8).
3. Apply migrations with the *migration* URL, exported for that single command (do not store it in the API's environment):
   ```bash
   DATABASE_URL="mysql://<migration user>:<password>@<host>:<port>/<db>?<your provider's TLS parameters>" npm run db:migrate:deploy
   ```
   `migrate deploy` only applies committed migrations; it never resets or drops anything. Some providers need extra
   connection parameters for TLS (for example TiDB Cloud uses `sslaccept=strict`); check your provider's Prisma guide.
4. Give the API the *application* user's URL as `DATABASE_URL`.
5. Check `GET /api/v1/health/ready`: it returns 200 only when the database answers.

**Do not run the seed script on a production database.** To create the first administrator, register a normal account
through the site, then promote it with the migration user:
`UPDATE users SET role = 'super_admin' WHERE email = '<your email>';` (table and column names are in `schema.prisma`).

## 6. Changing the schema later

1. Edit `schema.prisma`.
2. Locally: `npm run db:migrate:dev -- --name <short_description>` (local database only; the guard enforces this).
3. Read the generated SQL. Treat any `DROP`, column type change or `NOT NULL` addition on a populated table as dangerous.
   Prefer expand/contract: add the new column, deploy code that writes both, backfill, then remove the old column in a later release.
4. Commit schema and migration together; CI applies it to a fresh database and fails on drift.
5. Production: backup, then `npm run db:migrate:deploy` with the migration user.

## 7. Relationships (from `schema.prisma`)

| Child -> Parent | On delete |
|---|---|
| CartItem -> Cart, CartItem -> Product | Cascade |
| OrderItem -> Order, OrderStatusHistory -> Order | Cascade |
| Review -> Product, Review -> User | Cascade |
| WishlistItem -> Product, WishlistItem -> User | Cascade |
| Cart / Notification / UserAddress / Vendor -> User | Cascade |
| **Order -> User**, **OrderItem -> Product**, Blog -> User, Product -> Category | **Restrict** (default, required) |
| OrderItem/Product/User -> Vendor, Order/Cart -> Coupon, Review -> Order, Category -> parent Category, Product -> subcategory | SetNull (default, optional) |

Only 3 explicit `@@index` entries exist (MySQL indexes foreign-key columns automatically). Consider adding indexes for
`Product(isActive, categoryId)`, `Order(status, createdAt)` and `Order(userId, createdAt)` once real query patterns are known.
This is a schema change: add it through a migration (section 6).

## 8. Backups and restore

```bash
# consistent logical backup, written by mysqldump itself (avoids shell redirection/encoding problems on Windows PowerShell)
mysqldump --single-transaction --routines --result-file=backup-$(date +%F).sql -h <host> -P <port> -u <user> -p <database>
# restore into an EMPTY database
mysql -h <host> -P <port> -u <user> -p <database> < backup-YYYY-MM-DD.sql
```
Enable your provider's automated backups as well, and rehearse a restore into a scratch database. A backup you have not restored is not a backup.

## 9. Moving data from a local XAMPP database

Prefer reseeding demo data. To move real rows, dump data only (`--no-create-info --complete-insert`) for selected
tables, leave out the unused `vendors.bank_*` columns, and import after the schema exists. Review the data first:
user rows contain personal data and password hashes. Never use real customer data for development or testing.

## 10. Never run

`prisma migrate reset`, `prisma db push --accept-data-loss`, `--force-reset`, `DROP DATABASE` or `TRUNCATE` against a
database you have not backed up and verified. The guard blocks the Prisma ones for remote databases.
