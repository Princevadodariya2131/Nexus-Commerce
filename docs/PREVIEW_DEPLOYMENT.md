# Private preview deployment runbook (Vercel + Render + Aiven MySQL)

**Scope:** a private demonstration with demo data only. It is not a commercial launch: checkout never charges anyone, there is no
password-reset or e-mail-verification UI, and the free tiers below sleep, restart and carry no uptime guarantee.
**Nothing in this runbook has been executed against real hosting yet.** Items marked *(unverified)* must be checked on first deploy.

## 0. Order of operations (why the order matters)

1. Prisma baseline, generated on a machine that can download Prisma's engines (section 3).
2. GitHub repository and push (section 4).
3. **Only then** create the Aiven database: a free service that is not used shortly after creation can be powered off (section 1).
4. Apply the migration to the fresh database, create the Render API, create the Vercel project, then fix up `CLIENT_URL` (sections 5 to 7).

## 1. Aiven for MySQL (free plan): verified facts

From Aiven's documentation (free-tier page, last updated 2026-08-05):

| Item | Value |
|---|---|
| Price / card | Free, no credit card. One free MySQL service per organisation. |
| Size | 1 CPU, 1 GB RAM, 1 GB disk, `max_connections` 76, daily backups. |
| Guarantees | None: no SLA, no support, not for production. |
| Power-off | A service with no use in its first few hours, or with no continuous activity, is powered off after a notification and can be powered on again. |
| Version | The page does not state the version. Choose **8.0** if offered (the audit tested 8.0.46). *(unverified: which versions the free plan offers)* |
| Rules that matter here | Every table needs a primary key (all 18 baseline tables have one). Each project has its **own CA**, so the client must be given `ca.pem`. |

### 1.1 Create the service (manual, do this immediately before section 5)

1. Sign up at aiven.io (email only). Create a service: **MySQL**, plan **Free**, any region, version 8.0 if offered.
2. When it is *Running*: Overview -> copy **host**, **port**, **user**, **password**, database (`defaultdb`). Download **CA certificate** as `ca.pem`.
3. Save `ca.pem` as `apps/api/certs/aiven-ca.pem` in your clone (public file, allowed by `.gitignore`).
4. Never paste the password into a chat, a commit, a ticket or a screenshot.

### 1.2 Build and check `DATABASE_URL`

```
mysql://<user>:<password>@<host>:<port>/<database>?sslaccept=strict&sslcert=/app/apps/api/certs/aiven-ca.pem&connection_limit=5&connect_timeout=30
```

| Parameter | Why |
|---|---|
| `sslaccept=strict` | Prisma's default is `accept_invalid_certs`, which encrypts but does not verify the server. |
| `sslcert=/app/apps/api/certs/aiven-ca.pem` | Prisma docs: the CA file is needed when the server's certificate is not in the system store. The path must be **absolute inside the container**: relative paths are resolved against the `prisma/` folder, which the runtime image does not contain. |
| `connection_limit=5` | Aiven free allows 76 connections; Prisma's default pool is larger. |
| `connect_timeout=30` | A sleeping free database or API can be slow to answer. |
| Password | Percent-encode special characters (`@` -> `%40`, `/` -> `%2F`, `?` -> `%3F`, `#` -> `%23`). |

Check the shape (the password is never printed). The URL is read from an environment variable, not an argument:

```powershell
# Windows PowerShell
$env:DATABASE_URL = "mysql://...paste here..."
npm run db:check-url
Remove-Item Env:DATABASE_URL
```
```bash
# bash / zsh
read -rs DATABASE_URL && export DATABASE_URL && npm run db:check-url; unset DATABASE_URL
```

**Not yet verified:** that Prisma accepts this exact TLS combination against Aiven. When running migrations from your machine, replace the
container path in `sslcert` with the local path to `aiven-ca.pem` (an absolute path). If the connection fails with a certificate error,
stop and report it; do not switch to `accept_invalid_certs` without deciding that consciously.

## 2. Connection from your machine versus from Render

Your machine runs migrations (path to the file on your disk); Render runs the API (`/app/apps/api/certs/aiven-ca.pem`). Aiven free services
accept connections from anywhere unless you restricted allowed IPs *(unverified for the free plan; if your machine cannot connect, check the service's allowed IP addresses)*.

## 3. The official Prisma baseline (needs a machine that can reach `binaries.prisma.sh`)

```powershell
git clone <your repo or unzip the project> ; cd Nexus-Commerce-Updated
npm ci
npm run db:baseline            # prisma migrate diff --from-empty ... -> apps/api/prisma/migrations/<timestamp>_init/
npm run db:baseline:compare    # official output vs the tested candidate (exit 0 = equivalent)
```

`db:baseline:compare` ignores comments, whitespace, statement order and column order inside a table, and reports any real difference (a
type, nullability, default, index, foreign key or delete rule). A difference is not automatically wrong (Prisma's output is the authority) but
each one must be understood before the migration is used. Expect: 18 tables, 24 foreign keys, no `DROP`.

### 3.1 Validate on a fresh MySQL 8 (recommended: Docker)

XAMPP ships **MariaDB**, not MySQL; do not use it for this check.

```powershell
docker run --name nexus-verify -e MYSQL_ROOT_PASSWORD=verify-only -e MYSQL_DATABASE=nexus_verify -p 3307:3306 -d mysql:8.0
docker exec nexus-verify mysqladmin ping -h 127.0.0.1 -pverify-only --silent   # repeat until it prints: mysqld is alive
$env:DATABASE_URL = "mysql://root:verify-only@127.0.0.1:3307/nexus_verify"
npm run db:migrate:deploy
npm run db:migrate:status                                                      # expect: Database schema is up to date
npx prisma migrate diff --from-url $env:DATABASE_URL --to-schema-datamodel apps/api/prisma/schema.prisma --exit-code   # exit 0 = identical
docker rm -f nexus-verify
Remove-Item Env:DATABASE_URL
```
(bash: use `export DATABASE_URL=...` instead of `$env:`.)
Without Docker: apply it to the fresh, empty Aiven database in section 5 and run the same `status` and `diff` commands there; that database is disposable.

Commit `apps/api/prisma/migrations/` (including `migration_lock.toml`). Do **not** commit `baseline-candidate` changes.

## 4. GitHub (manual: the integration cannot create repositories)

1. github.com/new -> name `nexus-commerce` -> **Private** -> **tick "Add a README file"** so the default branch is `main`.
   (Correction to an earlier instruction: with an empty repo the first pushed branch becomes the default branch, which Vercel would then treat as
   the *production* branch, and Hobby does not protect production domains.)
2. Push the project on a branch called **`preview`**:

```bash
cd Nexus-Commerce-Updated
git init
git checkout -b preview
git add -A
git status                      # check: no .env, no node_modules, no *.pem other than apps/api/certs/aiven-ca.pem
git commit -m "Nexus Commerce private preview"
git remote add origin https://github.com/<your-user>/nexus-commerce.git
git push -u origin preview
```
Git asks you to sign in (browser or personal access token). Do not use `git push --force`.

## 5. Database: apply the migration to the fresh Aiven service

From your machine (local path in `sslcert`), only against the **fresh, empty** service:

```powershell
$env:DATABASE_URL = "mysql://<user>:<password>@<host>:<port>/defaultdb?sslaccept=strict&sslcert=C:/path/to/aiven-ca.pem&connection_limit=5&connect_timeout=30"
npm run db:migrate:deploy
npm run db:migrate:status
Remove-Item Env:DATABASE_URL
```
`migrate deploy` only applies committed migrations. Do **not** run the seed script, `db push`, or import `database/nexus_commerce.sql`.
Demo content: register a normal account through the site. To make one administrator for the demo, promote it in Aiven's SQL console:
`UPDATE users SET role = 'super_admin' WHERE email = '<your email>';` (use a strong, unique password; never the seed defaults).

## 6. Render (manual: no connector)

1. render.com -> sign up (no card for free web services) -> **New -> Blueprint** -> connect GitHub -> repository `nexus-commerce` -> branch **`preview`**.
   Render reads `render.yaml`: service `nexus-commerce-api`, free plan, Docker, health check `/api/v1/health`, auto-deploy off.
2. Render generates `JWT_SECRET`, `JWT_REFRESH_SECRET`, `COOKIE_SECRET` itself. It asks for two values:
   - `DATABASE_URL`: the checked URL from 1.2 (container path in `sslcert`).
   - `CLIENT_URL`: not known yet. Enter a valid placeholder origin such as `https://example.com`; you will edit it in step 8.
3. Deploy. Watch the build log. **Open risk *(unverified)*:** the Docker image has never been built; if the Prisma engine fails to load on Alpine, report the
   exact error (the usual fix is adding `binaryTargets` to the Prisma generator, a schema change that needs your approval).
4. Note the service URL, for example `https://nexus-commerce-api.onrender.com`. Check `https://<service>/api/v1/health` (expect 200) and `/api/v1/health/ready`
   (expect 200 only if the database connection works; the first request may take about a minute while the service wakes).

## 7. Vercel (I can create the project through the connector once you approve and the repo exists)

| Setting | Value |
|---|---|
| Git repository / branch | `nexus-commerce`, deploy branch `preview`; Production Branch stays `main` |
| Root Directory | `apps/web` (keep "include source files outside the root directory" enabled) |
| Framework Preset | Next.js; build and install commands default |
| `NEXT_PUBLIC_API_URL` | `/api/v1` (build-time) |
| `API_PROXY_TARGET` | the Render URL from step 6.4, no trailing slash (build-time) |
| `NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS` | leave **unset** |
| Deployment Protection | **Vercel Authentication** (Standard Protection). Hobby protects previews and generated URLs but **not the production domain**, and Password Protection is not available on Hobby. |

Rules: only ever deploy the `preview` branch as a Preview deployment; **never promote it to production**. The first automatic build of `main` (README only) will fail or
be skipped; that is expected and harmless. The web build fails on purpose if `NEXT_PUBLIC_API_URL` or `API_PROXY_TARGET` is missing or inconsistent.

## 8. Wire the two together

1. After the first successful Preview deployment, read its **branch alias origin** (Vercel project -> Domains, or the deployment details), e.g. `https://<project>-git-preview-<scope>.vercel.app`.
2. Render -> `nexus-commerce-api` -> Environment -> set `CLIENT_URL` to that origin (`https://`, no path, no trailing slash) -> save (Render restarts the service).
   `CLIENT_URL` matters for CORS and the WebSocket token flow; normal page and API calls go through the same-origin proxy and do not depend on it.

## 9. Verification checklist

| Check | How | Who can run it |
|---|---|---|
| API liveness / readiness | open `https://<render>/api/v1/health` and `/health/ready` | anyone / I can fetch them |
| Preview is protected | open the Preview URL in a private window: it must ask for a Vercel login | you |
| Pages load | home, `/shop`, a product page, `/login`, `/cart` while logged in to Vercel | you (I can fetch through the Vercel connector) |
| Proxy and Host header *(unverified)* | in the Preview: `/api/v1/health` returns the API's JSON | you / me (GET) |
| Cookies | log in; dev tools -> Application -> Cookies: `HttpOnly`, `Secure`, `SameSite=Lax`, no Domain; Local Storage has no token | you |
| Register, login, add to cart, checkout (demo) | manual walk-through with a test account | you (my sandbox cannot reach deployed hosts unless network access is enabled) |
| Admin/vendor routes | `/admin` as the promoted account; `/vendor` shows the intended state for a non-vendor | you |
| Socket.IO | not used by the UI. Needs a script with a socket token; only after network access is enabled | me, optional |
| Client IPs *(unverified)* | repeated failed logins must not lock out other users; if they do, raise `TRUST_PROXY_HOPS` | you |

## 10. Manual actions required from you (complete list)

1. Run `npm ci && npm run db:baseline && npm run db:baseline:compare` on a machine with network access; validate (3.1); commit the migration. *(or enable network access for the assistant)*
2. Create the private GitHub repo with a README (section 4) and push the `preview` branch.
3. Create the Aiven account and the free MySQL service **right before** section 5; download `ca.pem` into `apps/api/certs/aiven-ca.pem` and commit it.
4. Run `npm run db:check-url`, then apply the migration to Aiven (section 5).
5. Create the Render account and the Blueprint; enter `DATABASE_URL` and a placeholder `CLIENT_URL`.
6. Approve and (optionally) let the assistant create the Vercel project, or do it by hand with the table in section 7.
7. Set the real `CLIENT_URL` on Render (section 8).
8. Perform the interactive checks in section 9, or enable network access so the assistant can.

## 11. Known limits of this preview

No payments; orders stay `pending`. No password-reset/e-mail-verification pages. SMTP is not configured, so no e-mails are sent. API and database sleep when idle
(about a minute to wake). One API instance only (Socket.IO and rate limits are per process). The API URL on Render is publicly reachable (free plan has no access control), so
use demo data only. Dependency vulnerabilities from `npm audit` are untriaged. Vercel Hobby is for non-commercial use.

## 12. Tear-down

Delete the Render service, the Aiven service, and the Vercel project when the preview is finished. The private repository can stay or be archived.
