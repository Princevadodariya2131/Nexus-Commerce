# Deployment guide

> **Status:** prepared and statically checked, **not yet deployed or built end-to-end**. Nothing below has been executed
> against real hosting. Follow the verification steps; do not treat the site as production-ready until every item in
> "Go-live gates" passes.

## 1. Architecture

```
Browser --https--> Web (apps/web, Next.js)  --/api/v1/* rewrite-->  API (apps/api, Express, Docker)  --> MySQL 8 compatible database
```

- **Web:** Next.js 15. Set `NEXT_PUBLIC_API_URL=/api/v1` and `API_PROXY_TARGET=https://<api origin>`. Browser requests stay on the web
  origin, so the `httpOnly` auth cookies (`sameSite=lax`, `secure` in production) remain first-party.
- **API:** a long-lived Node process (it cannot run as a serverless function as written). Build with `apps/api/Dockerfile`
  (build context = repository root). Container health check: `GET /api/v1/health` (liveness, no database). Load-balancer
  readiness: `GET /api/v1/health/ready` (503 when the database is unreachable).
- **Database:** see `docs/DATABASE.md`.
- **WebSockets:** the web app does not use them today and nothing emits events. If you add a client: request a 60-second token from
  `GET /api/v1/auth/socket-token` (authenticated by the cookie), then connect **directly to the API origin**:
  ```ts
  const socket = io(API_ORIGIN, { auth: (cb) => fetchSocketToken().then((token) => cb({ token })) });
  socket.emit('join', `user:${userId}`, (result) => { /* { ok: true } or { ok: false, error } */ });
  ```
  Allowed rooms: `user:<own id>`, `vendor:<own approved vendor id>`, `admin` (admins only). Everything else is refused. The API host
  must allow WebSocket connections, and the web origin must be listed in `CLIENT_URL`.

## 2. Environment variables

| Where | Variable | Notes |
|---|---|---|
| API | `NODE_ENV=production`, `PORT` | |
| API | `DATABASE_URL` | Application user (DML only). Required in production. |
| API | `JWT_SECRET`, `JWT_REFRESH_SECRET`, `COOKIE_SECRET` | 32+ random characters each, all different (`openssl rand -base64 48`). The API refuses to start otherwise. |
| API | `CLIENT_URL` | One or more comma-separated web origins, no path or trailing slash, e.g. `https://shop.example.com`. Used for CORS and WebSockets. |
| API | `TRUST_PROXY_HOPS` | Default 1. See "Client IPs" below. |
| API (optional) | `SMTP_*`, `EMAIL_FROM`, `LOG_TO_FILE=true` | File logging is off by default (containers log to stdout). |
| Web | `NEXT_PUBLIC_API_URL=/api/v1`, `API_PROXY_TARGET` | Build-time. The Vercel build fails when they are missing or inconsistent. |
| Web (optional) | `NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS=true` | Shows the demo login hint in a production build. Leave unset for a real site. |

Never commit `.env` files. Stripe, Razorpay, Cloudinary and OpenAI variables exist but are unused by the current code.

## 3. Hosting options (researched November 2026; verify current terms before you commit)

The comparison sites below are third-party; check each provider's own pricing and terms page before relying on a limit.

| Layer | Option | Free tier and commercial use | Fit for this project |
|---|---|---|---|
| Web | **Vercel Hobby** | Free, but restricted to non-commercial personal use. Commercial use needs Pro (about $20 per member per month). | Demo or portfolio only. Best Next.js support. |
| Web | **Netlify free** | Reported to allow commercial use; credit-based limits since September 2025. | Plausible for a commercial launch; needs a test of the `/api/v1` rewrite. |
| Web | **Cloudflare Pages/Workers** | Reported to allow commercial use. Next.js runs on the Workers runtime (different from Node, 128 MB memory limit). | Would require an adapter and testing; not verified. |
| API | **Render free web service** | Sleeps after 15 minutes idle, ephemeral disk, outbound SMTP ports blocked, documented as not for production. | Staging or demo. |
| API | **Render paid (Starter, about $7/month)** | Always on, Docker supported, WebSockets supported. | Reasonable minimum for a real site. |
| API | **Google Cloud Run** | Request-based always-free allowance (2 million requests, 180,000 vCPU-seconds, 360,000 GiB-seconds per month), but a billing account (card) is required and usage above the allowance is charged. Scale-to-zero cold starts. | Possible; needs a billing account and your explicit decision. |
| API | Railway, Fly.io | No permanent free tier for new accounts (small monthly credit or short trial). | Not recommended for a free setup. |
| Database | **TiDB Cloud Starter** | No card; free quota (its own pages quote different sizes, so check the pricing page at sign-up); pay-as-you-go above it; a separate Dedicated tier is "for production use". | Good for demo/staging; check foreign-key support on your cluster version (generally available from TiDB v8.5). |
| Database | **Aiven for MySQL free** | No card, no expiry, 1 node, no SLA, may be powered off when unused; documented as not aimed at production workloads. | Staging only. |

**Realistic picture:** a demo can run for $0. A real store taking customer orders needs paid hosting for at least the API and the database,
and a commercial-use frontend plan. Do not assume any trial is permanently free, and budget for the paid tiers.

## 4. Steps

1. **GitHub:** create a private repository and push (not done yet; requires your approval).
2. **Database:** follow `docs/DATABASE.md` sections 3 to 5.
3. **API host:** deploy `apps/api/Dockerfile` with the API variables. Set the platform health check to `/api/v1/health/ready`.
4. **Web host:** import the repository, root directory `apps/web`, framework Next.js, set the web variables, deploy a **Preview** first.
5. **Verify (see 5), then promote to production.**

## 5. Verification checklist (run against the Preview)

```bash
curl -i https://<web>/api/v1/health          # 200 JSON from the API (proves the rewrite and the Host header work)
curl -i https://<web>/api/v1/health/ready    # 200 (503 means the database is unreachable)
# log in through the UI, then in the browser dev tools confirm:
#   - Set-Cookie accessToken / refreshToken: HttpOnly; Secure; SameSite=Lax; no Domain attribute
#   - Application > Local Storage has no 'accessToken' inside 'nexus-auth'
#   - GET /api/v1/auth/me succeeds on the next request
curl -i -X PATCH https://<web>/api/v1/auth/me -H 'content-type: application/json' -d '{"firstName":"x"}'   # 401 without a login
```

Risks that can only be settled by this test: (a) whether the host's proxy forwards a `Host` header the API platform accepts (if you get a
platform 404, add the web domain as a custom domain on the API service or use a code-level proxy); (b) how long a cold API instance
takes to answer through the proxy (free tiers sleep); (c) **client IPs**: if every user shares one rate-limit bucket (login attempts are
limited per IP), raise `TRUST_PROXY_HOPS` to match the number of proxies in front of the API.

## 6. Operations

- **Logs:** the API logs to stdout/stderr (winston console transport); use your host's log viewer. Unhandled rejections and uncaught
  exceptions are logged and the process exits, so configure automatic restart.
- **Shutdown:** SIGTERM triggers a graceful close (10-second limit), then exit.
- **Errors:** responses never include stack traces in production; malformed JSON returns 400 and oversized bodies 413.
- **Rollback:** redeploy the previous image/commit. Database changes are forward-only; restore from backup if a migration must be undone.

## 7. Go-live gates (all must pass before calling this production-ready)

- [ ] CI is green on GitHub: `npm ci`, shared/API/web builds, both type-checks, all test suites, migration check.
- [ ] Baseline migration committed and verified on a fresh MySQL database (`docs/DATABASE.md` sections 3 and 4).
- [ ] The HTTP-level tests (`src/__tests__/http.test.ts`) ran and passed in CI (they skip where Express is absent).
- [ ] Preview verification (section 5) passed, including the proxy, cookies over HTTPS and the cold-start behaviour.
- [ ] **Payments implemented and tested with real provider test credentials.** Today orders are saved as `pending` and nothing is charged.
- [ ] A backup was taken and a restore rehearsed.
- [ ] Production secrets generated fresh; no demo accounts or demo data present; the login page shows no demo credentials.
- [ ] A commercial-use plan is in place for every layer (section 3).
- [ ] `npm audit` reviewed, error monitoring and uptime alerts configured.
