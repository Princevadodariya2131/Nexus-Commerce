# Security and functional test report

**Method.** (1) The project's unit suites (in-memory fake database), 272 tests. (2) A live harness
(`docs/audit/integration-harness`, 240 checks) that drives a running API over HTTP and Socket.io against a **real MySQL 8.0.46**.
Both were run against the code *before* and *after* the fixes in this release. All data was synthetic; the databases were
throwaway local instances; no production system, real credentials or real payment service was touched.

**Deviations from a normal setup (disclosed).** Prisma's native engines could not be downloaded in the audit sandbox, so the live
runs used a **scratch copy** of the project switched to Prisma's Rust-free client engine with the MySQL/MariaDB driver adapter
(`@prisma/adapter-mariadb`), the same application code and queries otherwise. The database schema came from the *baseline
candidate* (not Prisma-generated, see AUDIT_REPORT.md). Differences between that stack and your normal engine are possible,
so re-run the harness in your environment (README in the harness folder).

## Result summary

| Suite | Before fixes | After fixes |
|---|---|---|
| API unit tests | 190 pass | **211 pass** (+21 regression tests) |
| Web tests | 7 pass | 7 pass |
| Script tests | 51 pass | 54 pass |
| Live harness (240 checks) | 195 pass, 34 fail, 11 info | **225 pass, 4 fail, 11 info** |

The 4 remaining harness "fails" are expectation differences, not defects: `SEC-VAL-cat-missing` (harness expected `null`; the app
correctly returns 400) and three `/vendor/dashboard` checks where a pending/suspended vendor intentionally gets its own status with
**zeroed statistics** (HTTP 200, verified: no sales data, no customer data) and a vendor without a profile gets 404, because the
only vendor page in the web app depends on that.

## Requested verifications

| Requirement | Checks | Result |
|---|---|---|
| Customer cannot access admin endpoints | 13 admin endpoints x (customer, vendor, anonymous) incl. PATCH/POST | **Pass** (403 / 401; state unchanged) |
| Vendor cannot modify another vendor's products | PATCH/DELETE as other vendor; `vendorId` transfer; create under another vendor; unowned legacy product | **Pass** |
| Vendor cannot update another vendor's orders | other vendor, mixed-vendor order, customer, 'refunded' by vendor | **Pass** (404/403; DB status unchanged) |
| Vendor without an approved profile denied | pending, suspended, no-profile: create/patch/delete product, order status, **read products, read orders** | **Pass.** *Read* of products/orders was **open** before (a suspended vendor received customer e-mails); now 403. |
| Customers cannot join others' socket rooms | own room ok; other customer, admin room, vendor room, 9 malformed names | **Pass** |
| Unauthenticated / forged sockets rejected | no token, garbage, forged signature, refresh token as socket token | **Pass** |
| Socket token separation | dedicated socket token cannot be used as API token | **Pass** |
| Deactivation reaches open sockets | join after deactivation refused | **Pass** |
| Product fields validated | 20 hostile inputs: negative/zero/NaN/huge price, stock, slug, name length, `javascript:`/`data:` image URLs, >20 images, unknown fields, mass-assignment of `isFeatured/rating/soldCount/id/createdAt/vendorId`, 20k-char description | **Pass** |
| Admin permissions | admin cannot deactivate self/other admin/super_admin; super_admin can deactivate admin; no role smuggling; deactivated user's token dies immediately; cannot log in | **Pass** |
| JWT handling | wrong secret, `alg:none`, expired, tampered role claim | **Pass** |
| Registration cannot create privileged users | `role: admin|vendor` in body; `PATCH /auth/me {role}` | **Pass** (role ignored / 422) |
| Auth cookies | `HttpOnly; Secure; SameSite=Lax` in production mode behind TLS | **Pass** |
| Token refresh | rotation, reuse rejected, empty token, deactivated user, post-password-reset | **Pass after fixes** (see S-3..S-5) |
| Cart | add/increment/update/remove/clear, 5 invalid quantities, over-stock, unknown product, per-user isolation | **Pass** |
| Checkout and order creation | totals (subtotal, 8% tax, shipping), stock decrement, cart emptied, history row, bad address/payment method | **Pass** |
| Order tracking | public tracking exposes no address/e-mail/user id; unknown -> 404; own orders; IDOR blocked | **Pass** |
| Admin and vendor operations | dashboards, vendor onboarding -> admin approval -> product creation -> suspension blocks again | **Pass** |

## Findings register

Severity is my judgement for an internet-facing store.

| # | Finding | Sev. | Status |
|---|---|---|---|
| S-1 | **Coupon could make an order total negative** (fixed $500 coupon on a $25.50 cart gave -$462.47). | Critical (money) | **Fixed**: discount clamped to subtotal; tests |
| S-2 | **Per-user coupon limit never enforced**; global usage-limit check was racy. | High | **Fixed**: counted per user, atomic increment in the order transaction |
| S-3 | **Password reset did not end existing sessions** (refresh token survived). | High | **Fixed** |
| S-4 | **Deactivated/banned users could keep minting tokens** via `/auth/refresh`; admin deactivation did not revoke the refresh token. | High | **Fixed** (also: refresh checks `isActive`) |
| S-5 | `/auth/refresh` without a token returned 500; refresh JWTs lacked a unique id so a rotation within one second reproduced the old token. | Medium | **Fixed** (401; `jti` added) |
| S-6 | **Suspended/pending vendors could read orders incl. customer e-mails** (`/vendor/orders`) and products. | High | **Fixed** (approved-only; dashboard zeroed for others) |
| S-7 | **Oversell race**: 4 concurrent checkouts of the last unit gave 1 order and three **500s** (stock check outside the transaction). | High | **Fixed**: atomic conditional decrement inside the transaction, 409 for the losers; deadlock-safe ordering; P2034 -> 409 |
| S-8 | **Checkout charged the stale cart price** (cart $20, price raised to $50, charged $20). | High (money) | **Fixed** (current price) |
| S-9 | **Cancelling an order did not return stock**; cancelled/refunded orders could be "shipped" again. | High | **Fixed** (restock only before shipment; terminal states locked; cancelled -> refunded only by admin) |
| S-10 | Public/admin endpoints returned **500 on malformed input** (`page=-1`, `minPrice=abc`, `search[a]=b`, `/admin/vendors/abc`, `?role=bogus`, `?status=bogus`, `/orders/abc`, empty coupon/banner bodies, `/ai/chat` with an object, `/ai/search-suggestions?q[a]=b`). | Medium | **Fixed** (lenient query parser, id parser, strict zod schemas for coupons/banners/vendor onboarding, Prisma validation errors -> 400) |
| S-11 | **Coupon/banner creation accepted any body** (mass assignment into Prisma; `javascript:` image/link values possible). | Medium | **Fixed** (strict schemas) |
| S-12 | `GET /auth/me` exposed token-expiry internals (`emailVerificationExpires`, `passwordResetExpires`). | Low | **Fixed** |
| S-13 | `/vendor/onboard` crashed (500) without `businessName`; empty/duplicate slugs. | Low | **Fixed** |
| S-14 | `/forgot-password` had no dedicated limiter (e-mail bombing up to the global 100/15 min). | Medium | **Fixed** (10 per 15 min, own counter; login unaffected, verified) |
| S-15 | Vendor dashboard revenue summed `price` ignoring quantity. | Low | **Fixed** |
| S-16 | Admin user list: unbounded `limit`. | Low | **Fixed** (max 100) |
| O-1 | **Access tokens are stateless**: after logout (or deactivation) an already-issued access token works until it expires (<= 15 min). Deactivation *is* enforced per request; logout is not. | Low | **Open, accepted design**; add a token denylist if required |
| O-2 | **Order can be created without a payment method** (`payment_method = NULL`). | Medium | **Open** (made required once the payment flow exists) |
| O-3 | **No customer-facing way to reset a password or verify an e-mail**: the e-mails link to `/reset-password` and `/verify-email`, which do not exist in the web app. Email verification is not enforced anywhere. | High (functional/security) | **Open** (UI work; not a redesign) |
| O-4 | **No way to become a vendor**: registration ignores `role`, and there is no admin endpoint to promote a user. Vendor onboarding/products/orders have API only, **no UI pages**. | High (functional) | **Open** |
| O-5 | Refresh cookie is sent on every path; refresh token stored unhashed in the DB (one token per user, so a second device logs the first out). | Low | Open |
| O-6 | Production accepts an `http://` `CLIENT_URL`. | Low | Open |
| O-7 | Rate limits and Socket.io state are per-process (single instance only). | Medium (scaling) | Open |
| O-8 | **Dependency vulnerabilities**: `npm ci` reports 45 (4 critical, 20 high, 20 moderate, 1 low), incl. deprecated `multer` 1.x (unused: no upload route). Not triaged or upgraded. | High until triaged | **Open** |
| O-9 | `database/nexus_commerce.sql` is a second, drifted source of truth (40 differences from `schema.prisma`; contains `DROP TABLE`; 4 unused bank-account columns on `vendors`). | Medium | Open (retire it after the official baseline is committed) |
| O-10 | Tax (flat 8%) and shipping (flat 9.99) are placeholders; no payment is ever taken; `paymentStatus` never becomes `paid`, so revenue reports are always empty. | Blocker for commerce | Open (PAYMENTS_IMPLEMENTATION_PLAN.md) |
| O-11 | Product images are free-form http(s) URLs; there is no upload endpoint (Cloudinary unimplemented). | Medium | Open |

**Not tested:** production rate limiting beyond login and password reset; real SMTP delivery; behaviour behind a real reverse
proxy; load/performance; browser-level XSS/CSRF testing of the Next.js UI (the API-side defences were tested: CORS lock-down,
cookies, security headers); `npm audit` exploitability; the AI chat endpoint's behaviour (it only appeared to be a local responder; I tested malformed input, not its logic).

**Coverage.** API unit tests: 85.7% lines / 92.0% branches / 89.5% functions across all files **including the test files themselves**.
Business-critical services are much lower in unit tests alone (order 59%, auth 55%, cart 51%, vendor routes 41%, analytics 39%);
the live harness covers those paths, but it is **not run in CI** yet (recommended).
