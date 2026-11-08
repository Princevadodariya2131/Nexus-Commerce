# Nexus Commerce

Enterprise-grade AI-powered e-commerce SaaS platform — production-ready, multi-tenant marketplace architecture with premium cinematic UI.

## Architecture

```
nexus-commerce/
├── apps/
│   ├── api/          # Express.js REST API + WebSocket
│   └── web/          # Next.js 15 App Router frontend
├── packages/
│   └── shared/       # Shared types & constants
├── docker-compose.yml
└── .env.example
```

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| Frontend | Next.js 15, React 18, TypeScript, Tailwind, Framer Motion, GSAP, R3F, Zustand, TanStack Query |
| Backend | Node.js, Express, MySQL, Prisma, JWT, Socket.io |
| Payments | Stripe, Razorpay |
| Media | Cloudinary |
| DevOps | Docker, GitHub Actions |

## Quick Start

### Prerequisites

- Node.js 20+
- **XAMPP** with MySQL running (or any MySQL 8+ server)
- phpMyAdmin (included with XAMPP)

### Installation (XAMPP — no Docker required)

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit DATABASE_URL if MySQL has a password

# 3. Start MySQL in XAMPP Control Panel

# 4. Import database in phpMyAdmin:
#    http://localhost/phpmyadmin → Import → database/nexus_commerce.sql

# 5. Generate Prisma client
npm run db:generate --workspace=@nexus/api

# 6. Seed demo users & products
npm run seed --workspace=@nexus/api

# 7. Start development
npm run dev
```

See [database/XAMPP-SETUP.md](database/XAMPP-SETUP.md) for detailed XAMPP instructions.

- **Frontend:** http://localhost:3000
- **API:** http://localhost:4000/api/v1
- **Health:** http://localhost:4000/api/v1/health

### Demo Accounts (local development only; created by the local seed, never present or displayed on a production deployment)

| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@nexuscommerce.io | Admin@123456 |
| Customer | customer@demo.com | Customer@123 |

## Database

- **Setup, migrations, users, backups and safety rules:** [docs/DATABASE.md](docs/DATABASE.md)
- **SQL schema:** [database/nexus_commerce.sql](database/nexus_commerce.sql)
- **XAMPP guide:** [database/XAMPP-SETUP.md](database/XAMPP-SETUP.md)

The SQL file is a convenience for local XAMPP use. Prisma (`apps/api/prisma/schema.prisma`) is the source of truth; for hosted databases use migrations, not this file.

Default connection (XAMPP):
```env
DATABASE_URL="mysql://root@localhost:3306/nexus_commerce"
```

## Docker (optional)

```bash
docker compose up -d
```

## Features

### Customer
- Premium cinematic homepage with 3D hero
- AI chat assistant & recommendations
- Product search, filters, wishlist, cart
- Checkout, coupons, order tracking
- Multi-language & currency ready

### Admin Panel (`/admin`)
- Real-time sales dashboard
- User, vendor, product, order management
- Review moderation, coupons, banners
- Audit logs & analytics

### Vendor Portal (`/vendor`)
- Vendor onboarding & verification
- Product & order management
- Revenue analytics & payouts

### Security
- JWT + HTTP-only cookies (`accessToken` 15 min, `refreshToken` 7 days)
- RBAC (customer, vendor, admin, super_admin)
- Rate limiting, Helmet, Zod request validation
- Prisma parameterised queries (no raw SQL)
- Production startup refuses missing/weak JWT and cookie secrets

## Integration status (what the code actually does today)

| Area | Status |
|------|--------|
| Auth, cart, wishlist, orders, reviews, coupons, admin & vendor portals | Implemented |
| Order totals | Computed server-side (8% tax, free shipping over 100) |
| **Stripe / Razorpay** | **Not implemented.** SDKs and env vars exist, but no code creates or verifies a payment. Orders are saved with `paymentStatus: pending`. |
| **Cloudinary / uploads** | **Not implemented.** Config only; products use image URLs. |
| **AI assistant** | Rule-based keyword responses; **does not call OpenAI** (`OPENAI_API_KEY` is unused). |
| **Socket.io** | Server accepts connections but emits nothing and the web app has no client. No WebSocket hosting is needed today. |
| Email (verification, password reset, order confirmation) | Sent only when `SMTP_*` is configured; otherwise skipped. |

## API Documentation

See [docs/API.md](docs/API.md) for full endpoint reference.

## Deployment

### Recommended architecture

```
Browser ──> Vercel (apps/web, Next.js) ──/api/v1/* rewrite──> API host (apps/api, Express, Docker) ──> MySQL 8 compatible database
```

- The API needs a Node host that can run a long-lived process (it cannot run on Vercel as written). `apps/api/Dockerfile` builds from the **repository root** as the Docker context.
- Any MySQL 8 compatible database works (for example TiDB Cloud Starter, Aiven MySQL or a managed MySQL). Check each provider's current free-tier terms before relying on them.
- Vercel's Hobby plan is for non-commercial use only; a live store needs a paid plan or another frontend host.
- Browser requests go to `/api/v1` on the web origin and Next.js forwards them to the API (`API_PROXY_TARGET`). This keeps the auth cookies first-party, because they are `sameSite=lax` and the web app relies on cookies only.

### Environment variables

| Where | Variable | Notes |
|-------|----------|-------|
| API | `NODE_ENV=production`, `PORT` | |
| API | `DATABASE_URL` | Required in production. Use your provider's TLS parameters. |
| API | `JWT_SECRET`, `JWT_REFRESH_SECRET`, `COOKIE_SECRET` | Required in production: 32+ random characters each, all different (`openssl rand -base64 48`). The API refuses to start otherwise. |
| API | `CLIENT_URL` | Required in production: the public web URL. |
| API | `TRUST_PROXY_HOPS` | Default `1`. Integer >= 0; raise it if all users appear to share one rate-limit bucket. |
| API (optional) | `SMTP_*`, `EMAIL_FROM` | Only needed for email. Some hosts block outbound SMTP ports. |
| Vercel | `NEXT_PUBLIC_API_URL=/api/v1` | Build-time. The Vercel build fails if it is missing. |
| Vercel | `API_PROXY_TARGET=https://<api-host>` | Server-side, no trailing slash. Read at build time. |

Stripe, Razorpay, Cloudinary and OpenAI variables exist in `.env.example` but are not used by the current code. Never commit a real `.env`.

### Steps

The complete, current procedure is in **`docs/DEPLOYMENT.md`** (architecture, hosting options and their limits, verification checklist, go-live gates) and **`docs/DATABASE.md`** (migrations, users and privileges, backups). In short: create the database and apply migrations with `npm run db:migrate:deploy`; deploy the API from `apps/api/Dockerfile`; deploy `apps/web` with `NEXT_PUBLIC_API_URL=/api/v1` and `API_PROXY_TARGET`; then run the Preview verification (`curl https://<web>/api/v1/health`, log in, check cookies) before promoting.

### Seeding safely

`npm run seed --workspace=@nexus/api` **deletes all data** before inserting demo data. It runs as before against a local database (`localhost`, `127.0.0.1`, `[::1]` or the docker-compose host `mysql`). For any other database, or with `NODE_ENV=production`, it refuses unless you set, for that single run only, `ALLOW_DESTRUCTIVE_SEED=true`, `SEED_ADMIN_PASSWORD` and `SEED_CUSTOMER_PASSWORD` (strong, unique values). The demo passwords in this README are for local development only. The login page also displays demo credentials; remove that text before a public launch.

### Security hardening already in place

- Vendors can only change orders that consist entirely of their own items, and cannot set `refunded`; mixed-vendor orders are admin-only.
- Product create/update bodies are whitelisted (strict Zod schemas by role); vendor identity comes from the database, never from the JWT; vendor-role accounts without an approved vendor profile are denied.
- `PATCH /auth/me` accepts only name, phone and avatar (a body containing `role` is rejected); the user's role is read from the database on every request.
- Cart quantities must be positive integers; ratings 1 to 5; order status values are validated; admins cannot change their own status or another administrator's (super admin only).
- The access token is no longer stored in browser localStorage (the httpOnly cookie is the only credential); an older stored token is purged on load.
- Socket.io requires a valid token and authorises rooms (`user:<own id>`, `vendor:<own approved vendor>`, `admin`).
- Demo credentials are hidden in production builds.
- Database tooling refuses destructive Prisma commands against non-local databases (`docs/DATABASE.md`).

### Known limitations before a live (commercial) launch

- **Payments are not implemented** (see Integration status). This alone blocks a real store.
- No Prisma migrations are committed yet: run `npm run db:baseline`, review and commit (`docs/DATABASE.md`).
- No ESLint configuration exists (`npm run lint` is not usable); `npm run typecheck` and `npm test` are.
- Order tracking by order number is public (status and total only); order numbers are not secret.
- Access tokens are also returned in login/refresh response bodies for API clients; the web app ignores them.
- Admin-created coupons and banners are not field-whitelisted (administrators only).
- Not yet verified end to end: the real build, Prisma against MySQL, the Vercel proxy and WebSocket behaviour. See the go-live gates.

## Testing

```bash
npm ci
npm run build:shared           # the API compiles against @nexus/shared
npm run build --workspace=@nexus/api
npm run typecheck              # API (source and tests) and web
npm test                       # API, web and script tests (Node 22+; uses the built-in test runner via tsx)
```

The API tests exercise the real middleware, validators, policies and services against an in-memory database double; they do not test
MySQL itself. `src/__tests__/http.test.ts` runs the real Express app and is skipped where Express is not installed.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start API + Web concurrently |
| `npm run build` | Build shared, then API, then web (order matters) |
| `npm run seed` | Seed demo data |
| `npm run db:generate --workspace=@nexus/api` | Generate Prisma client |
| `npm run docker:up` | Start Docker stack (optional) |

## License

Proprietary — Commercial use requires license.
