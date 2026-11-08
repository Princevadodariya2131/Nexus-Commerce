# Deployment readiness

Everything below was verified by running the code unless marked **(not verified)**. Hosting prices and terms change;
the sources and dates are listed so you can re-check them. Nothing was deployed and no hosting account was created.

## 1. What was verified

| Area | Result |
|---|---|
| API production build (`tsc`) | OK. **Requires** Prisma's engine download (`binaries.prisma.sh`) for `prisma generate`; that host was unreachable in the audit sandbox, so the unmodified `npm run build` exited 1 there. With only that download check skipped it exited 0 and produced `dist/server.js`. |
| Web production build (`next build`) | OK, exit 0, 16/16 routes, **no network needed** (fonts are now self-hosted; before, the build failed whenever Google Fonts was unreachable). Output is `standalone`. |
| Compiled API starts in production mode | OK: booted from `dist/` with the exact layout of the Docker runner stage, `/api/v1/health/ready` answered `ready`, MySQL connected. |
| Compiled web starts (standalone layout of the web Dockerfile) | OK: `/`, `/shop`, `/login`, `/cart`, `/vendor` all HTTP 200. |
| MySQL connectivity | OK against MySQL 8.0.46 (health: `database: up`). Readiness fails (not just logs) if the DB is down: covered by unit tests. |
| Fail-fast configuration | OK: production refuses to start with missing, short (<32 chars) or placeholder `JWT_SECRET`/`JWT_REFRESH_SECRET`/`COOKIE_SECRET` (exit 1, clear message). **Gap:** production still starts with an `http://` `CLIENT_URL`. |
| Cookies | `accessToken` (15 min) and `refreshToken` (7 days): `HttpOnly; Secure; SameSite=Lax; Path=/` when the request arrives over HTTPS (or via `X-Forwarded-Proto: https`). Refresh cookie is sent on every path (could be scoped to `/api/v1/auth`). |
| Security headers | CSP, HSTS (1 year, includeSubDomains), `nosniff`, `X-Frame-Options: SAMEORIGIN`; no `X-Powered-By`; CORS reflects only `CLIENT_URL` with credentials. |
| Rate limiting (production only) | Login/register: 30 per 15 min per IP (tripped after 27 failures in the test, 429). Password-reset endpoints: 10 per 15 min (new in this release; separate counter). Global limiter otherwise. |
| Health checks | `GET /api/v1/health` (liveness, no DB) and `GET /api/v1/health/ready` (readiness, checks DB). The Dockerfile `HEALTHCHECK` uses liveness. |
| Logging / errors | Central error handler: operational errors keep their status, Prisma errors map to 404/409/400 (malformed values now 400; write conflicts 409), unknown errors 500 without leaking details. Request logging via morgan. |
| Docker images | **Could not be built here (no Docker daemon).** The layouts were reproduced by hand and run (see rows above). That found and fixed two build/runtime blockers (section 3). **Not verified: an actual `docker build` / `docker compose up`.** |

## 2. Environment variables
`.env.example` lists every key. **Required in production** (the API refuses to start without them): `DATABASE_URL`,
`JWT_SECRET`, `JWT_REFRESH_SECRET`, `COOKIE_SECRET` (each >= 32 random characters: `openssl rand -base64 48`), `CLIENT_URL`
(use `https://...`). Strongly recommended: `TRUST_PROXY_HOPS` (default 1 = one reverse proxy; wrong values break client-IP
rate limiting), `SMTP_*` + `EMAIL_FROM` (without SMTP, verification and reset e-mails are silently skipped).
Web: `NEXT_PUBLIC_API_URL` is baked into the browser bundle **at build time** (rebuild to change it); `API_PROXY_TARGET`
is read at runtime by the Next.js rewrite. Payment, Cloudinary and OpenAI keys are read but unused (no integration exists).
Keep real values out of git; `.gitignore` already excludes `.env*`; a `.dockerignore` was added.

## 3. Problems found and fixed in the deployment files
1. **API image would crash on start:** `Cannot find module '@nexus/shared'`. The runner stage copied
   `packages/shared/dist` but not `packages/shared/package.json`. Reproduced, fixed in `apps/api/Dockerfile`, re-run OK.
2. **Web image build would fail:** `COPY .../apps/web/public` but the directory did not exist. Added `apps/web/public/.gitkeep`.
3. **No `.dockerignore`:** `COPY . .` would overwrite the container's `node_modules` with the host's (wrong-OS binaries) and
   copy `.env`/`.git` into build layers. Added.
4. **docker-compose:** `NEXT_PUBLIC_API_URL` was a runtime variable (ineffective); the DB was seeded from the drifted
   `database/nexus_commerce.sql` (contains `DROP TABLE`); ports listened on all interfaces; empty JWT secrets were
   accepted. Now: build arg, schema from the generated baseline candidate, loopback-only ports, required secrets
   (`${VAR:?...}`), `NODE_ENV=development` for plain-http localhost. Still **local-development only**.
5. Fonts self-hosted (`apps/web/src/fonts`, SIL OFL, licences included): no build-time dependency on Google and no third-party font requests.

## 4. Production topology that fits the code
```
Browser --HTTPS--> reverse proxy / platform edge --> Next.js (web)  --/api/v1/* rewrite--> API (Express) --> MySQL
```
* Keep the browser talking to **one origin**. The auth cookies are `SameSite=Lax`, so a web app on `shop.example.com`
  and an API on a different registrable domain will not send cookies. Either (a) build the web app with `NEXT_PUBLIC_API_URL=/api/v1`
  (relative; **do not leave it empty**, the code then falls back to `http://localhost:4000/api/v1`) and set `API_PROXY_TARGET` to the
  API's internal URL so the Next.js rewrite proxies it **(rewrite exists in `next.config.ts`; this exact setup was not tested end to end)**, or (b) serve both under
  the same site (`app.example.com` + `api.example.com`) and set `CLIENT_URL` accordingly. Option (a) is simplest.
* Terminate TLS at the proxy, forward `X-Forwarded-Proto`/`-For`, and set `TRUST_PROXY_HOPS` to the number of proxies.
* **Socket.io:** the realtime client needs `NEXT_PUBLIC_WS_URL` pointing at the API. Next.js rewrites do not reliably
  proxy WebSockets, so route `/socket.io` to the API at the proxy (or use a separate hostname). **(not verified end to end
  through a proxy; socket authentication and room rules were verified directly.)**
* Run **one** API instance until Socket.io gets a shared adapter (Redis) and rate limiting a shared store; both are per-process today.
* Schema changes: `prisma migrate deploy` as a release step (needs the committed official baseline, see AUDIT_REPORT.md).
* Backups: enable automated MySQL backups and test a restore before launch.

## 5. Hosting options (researched 2026-11; verify before relying on them)

The deciding facts: the app is **Node + Next.js + MySQL**, takes payments (so it is *commercial*), and keeps state in
process memory for sockets/rate limits (so it wants an always-on process).

| Option | Free? | Commercial use | Fit / limits |
|---|---|---|---|
| **Vercel Hobby** (frontend) | free | **Not allowed.** Vercel's fair-use docs restrict Hobby to non-commercial personal use; commercial use needs Pro (about $20/user/month, per Vercel's pricing pages). | Ruled out for a store on the free plan. Also cannot host the Express API/Socket.io. |
| **Render free instances** | free web service, static site, Postgres, Key Value | Render's docs say not to use free instances for production. | Spins down after 15 min idle (about a minute to wake), ephemeral filesystem, restarts at any time. **Free database is Postgres only; this app needs MySQL.** Fine for a demo/preview, not a store. |
| **TiDB Cloud Starter** (database) | free monthly quota (5 GiB row storage + 50M request units per instance, up to 5 instances; some pages list 25 GiB / 250M per organisation), then pay-per-use; scales to zero; no card to start | I found no commercial-use prohibition on the pricing/limits pages, but I did not read the full terms | MySQL-*compatible*, not MySQL. **(not verified with this app)**: foreign keys, Prisma migrate and the MariaDB driver adapter need a test run. Request units are consumed by reads, writes and data transfer, so a busy shop can leave the free quota. |
| **Oracle Cloud Always Free** (VM to run API + web + MySQL yourself) | free VMs, 2 AMD micro VMs and Ampere Arm cores | I did not find a commercial-use ban in the pages I read; I did not read the full service agreement | Sources disagree on the Arm allowance (4 OCPU/24 GB in older docs; reports of a 2026 cut to 2 OCPU/12 GB). Capacity errors when provisioning are common, idle instances can be reclaimed (95th-percentile CPU < 20% over 7 days), a card is needed to sign up, and **you** operate the OS, TLS, backups and patching. Cheapest in money, most work and risk. |
| A small paid VPS or managed platform (Railway, Fly.io, DigitalOcean, Hetzner, etc.) | **not researched** | typically yes | The realistic production route: a ~$5-10/month VM plus a managed or self-run MySQL with backups. Prices and terms were **not** verified in this audit. |
| Cloudflare, Netlify, AWS/GCP free tiers | **not researched** | unknown | Not evaluated. |

**Recommendation:** for a *private preview*, Render free instances (or a local `docker compose`) are acceptable because
nothing real is at stake. For *commercial production*, plan on a paid always-on host with a managed/backed-up MySQL;
"free" options either forbid commercial use (Vercel Hobby), sleep (Render), or shift operations and reclamation risk onto
you (Oracle). A free MySQL-compatible database (TiDB Cloud Starter) is worth a test run but is not a drop-in guarantee.

Sources: vercel.com/docs/limits/fair-use-guidelines, vercel.com/docs/plans/hobby, vercel.com/terms;
render.com/docs/free; docs.pingcap.com/tidbcloud/select-cluster-tier, docs.pingcap.com/tidbcloud/serverless-limitations,
pingcap.com/tidb-cloud-pricing; docs.oracle.com/iaas/Content/FreeTier/resourceref.htm, linuxiac.com report on the Always Free change.

## 6. Pre-launch checklist (production)
- [ ] Official Prisma baseline committed, `migrate deploy` + `migrate status` clean on a fresh DB
- [ ] Payments implemented and rehearsed in provider **test mode** (PAYMENTS_IMPLEMENTATION_PLAN.md)
- [ ] File upload implemented (Cloudinary or equivalent) or product images restricted to trusted URLs
- [ ] Missing storefront pages built: forgot-password, reset-password, verify-email, vendor onboarding/products/orders UI
- [ ] Real tax and shipping rules; currency decision
- [ ] SMTP configured and delivery tested
- [ ] HTTPS everywhere, `CLIENT_URL` is `https://`, cookies verified `Secure` in the browser
- [ ] `npm audit` triage (4 critical / 20 high reported at install) and `multer` 2.x upgrade
- [ ] Privacy policy / terms / cookie notice; data-deletion path
- [ ] Monitoring and alerting (health endpoints, error tracking), log retention, tested DB restore
- [ ] Re-run `docs/audit/integration-harness` against staging (disposable copy of data) and the unit suite in CI
