# Payments implementation plan (Stripe and Razorpay)

**Status today: no payment integration exists.** `stripe`, `razorpay` and `cloudinary` appear only as configuration keys
(`apps/api/src/config`) and installed packages; there is no SDK call, no webhook route and no upload endpoint. The
checkout page offers "Card (Stripe)" and "Razorpay", but selecting one only stores a string in `orders.payment_method`.
Every order stays `payment_status = 'pending'` forever, so the admin revenue analytics and the vendor revenue figure
(both filter on `paid`) are always zero. Nothing in this plan was implemented or run against a real provider, and no
credentials of any kind were used.

Sources (read during this audit): Stripe docs on PaymentIntent status updates / accepting a payment
(docs.stripe.com/payments/payment-intents/verifying-status, docs.stripe.com/payments/payment-methods.md) and
Razorpay docs on the Orders API, checkout signature verification and webhooks
(razorpay.com/docs/payments/payment-gateway/quick-integration/, razorpay.com/docs/webhooks/validate-test.md).
Provider APIs change: re-read the current docs before building.

## 0. Decide first
* **Which provider(s)?** Razorpay is the natural choice for INR / Indian customers; Stripe for most other markets.
  Supporting both doubles the surface area. Recommended: build one provider end-to-end behind a small interface
  (`PaymentProvider`), then add the second.
* **Currency.** Checkout totals are USD-only (flat shipping 9.99, flat 8% tax, both hard-coded in
  `order.service.ts`; the `currency` column on `users` is just a display preference). Razorpay
  accounts are INR-first. Tax and shipping are placeholders, not real tax logic: they must be replaced before charging
  real customers.
* **Cash on delivery** stays a manual flow (see section 8).

## 1. Data model changes (one Prisma migration)
Existing: `orders.payment_status` (pending/paid/failed/refunded), `payment_method`, `payment_intent_id`,
`razorpay_order_id`. Add:
* `payment_events` — `id`, `provider` (`stripe|razorpay`), `event_id` **UNIQUE per provider**, `type`, `order_id`
  (nullable), `payload` JSON, `received_at`, `processed_at`, `error`. This table is the duplicate-webhook guard and the audit trail.
* `payments` (optional but recommended) — one row per attempt: `order_id`, `provider`, `provider_payment_id`,
  `amount` (integer minor units), `currency`, `status`, `failure_code`, `created_at`. An order can have several
  attempts; a single `payment_status` column cannot represent that history.
* `refunds` — `payment_id`, `provider_refund_id` UNIQUE, `amount`, `reason`, `status`, `created_by`, `created_at`.
* New order states: add `payment_failed`/`awaiting_payment` handling rather than reusing `pending` for both
  "just created" and "customer abandoned the payment page".
Never store card numbers, CVV or full PANs. Only provider ids.

## 2. Payment order creation (server-side, never trust the browser)
1. `POST /api/v1/payments/:provider/intent` (authenticated customer, `orderId`). Load the order, check it belongs to
   the caller, is `pending`, and recompute the amount **from the database** (`orders.total` in minor units). Ignore any
   amount sent by the client.
2. **Stripe:** create a PaymentIntent (or Checkout Session) with `amount`, `currency`, `metadata.orderId`,
   and an **idempotency key** derived from the order id + attempt number so a double-click cannot create two charges.
   Save `payment_intent_id`. Return only the `client_secret` (or session URL) to the browser.
3. **Razorpay:** call the Orders API server-side (amount in the smallest currency unit, e.g. paise; `receipt` =
   order number). Save `razorpay_order_id`. Razorpay's docs say an order must exist for every payment and that payments
   without an `order_id` cannot be captured. Return `order_id` and the public key id to the browser.
4. The publishable keys (`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, Razorpay key id) may reach the browser; **secret keys
   and webhook secrets never** (they live only in API environment variables).
5. Order creation (`POST /orders`) already reserves stock inside a transaction. Decide the policy for unpaid orders:
   hold stock for a limited time (e.g. 30 min) and release it with the same restock logic used for cancellation
   if the payment never completes (a scheduled job, see section 6).

## 3. Server-side payment verification
* **Never mark an order paid because the browser said so** (a return URL, a client callback, a success page).
* **Razorpay checkout callback:** compute HMAC-SHA256 over `order_id + "|" + razorpay_payment_id` with the **API key
  secret**, using the `order_id` you stored server-side (not the one echoed by the client), and compare with
  `razorpay_signature` in constant time (`crypto.timingSafeEqual`). A valid signature is a fast path to show "payment
  received"; the webhook (section 4) remains the source of truth. Razorpay says to deliver goods only after the payment is *captured*
  (enable automatic capture or capture on `payment.authorized`).
* **Stripe:** fulfilment is driven by the `payment_intent.succeeded` (or `checkout.session.completed`) webhook. If the
  customer returns before the webhook arrives, show "processing" and poll your own `GET /orders/:id`, or retrieve the
  PaymentIntent server-side. Stripe's docs warn not to rely solely on the return URL.
* Always compare the provider's `amount` and `currency` with `orders.total` before setting `paid`; mismatch -> flag for manual review, do not fulfil.

## 4. Webhooks (the source of truth)
Route: `POST /api/v1/webhooks/stripe` and `/webhooks/razorpay`, **no auth middleware, no CSRF, no JSON body parser,
no rate limiter that could drop provider retries**; protected only by the signature.
* **Raw body.** Mount `express.raw({ type: 'application/json' })` on these routes *before* the global `express.json()`
  (see `app.ts`; today the 10 MB JSON parser is global). Signature verification fails if the body was parsed and re-serialised.
* **Stripe:** `stripe.webhooks.constructEvent(rawBody, req.headers['stripe-signature'], STRIPE_WEBHOOK_SECRET)`; it also
  enforces a timestamp tolerance against replay. Reject with 400 on failure. Use a separate endpoint secret per
  environment (test/live).
* **Razorpay:** HMAC-SHA256 of the raw body with the **webhook secret** (which, per Razorpay, need not equal the API key
  secret) compared with the `X-Razorpay-Signature` header (the SDK's `validateWebhookSignature` does this). Never parse or cast the body first.
  If the secret is rotated, retries of old events are signed with the old secret.
* **Respond fast.** Verify, store, return `200` within seconds (Razorpay requires a 2xx within 5 seconds and disables
  endpoints that keep failing; Stripe retries non-2xx responses for days). Do heavy work (emails, inventory) after the
  acknowledgement, in a queue or `setImmediate` with error capture.
* Only open ports 80/443 for Razorpay; allow-list its webhook IPs if a firewall is in front.

## 5. Duplicate-webhook protection
Providers deliver **at least once**; duplicates and out-of-order events are normal.
* In one DB transaction: `INSERT INTO payment_events (provider, event_id, ...)`. A unique-constraint violation (Prisma
  `P2002`) means "already seen": return `200` and stop. Event id = Stripe `event.id`, Razorpay `X-Razorpay-Event-Id` header
  (documented as unique per event).
* Make the state transition itself idempotent as well: `UPDATE orders SET payment_status='paid' WHERE id=? AND payment_status IN ('pending','failed')` and check the affected row count.
* Order-independence: a late `payment.failed` must not overwrite a later `paid`; only allow forward transitions
  (`pending -> paid`, `pending -> failed`, `paid -> refunded`, `failed -> paid` on a successful retry).

## 6. Failed, cancelled, expired and abandoned payments
| Situation | Stripe signal | Razorpay signal | Action |
|---|---|---|---|
| Payment succeeded | `payment_intent.succeeded` | `payment.captured` / `order.paid` | `paid`, confirm order, email |
| Payment failed | `payment_intent.payment_failed` | `payment.failed` | `failed`, keep order `pending`, let the customer retry with a **new attempt on the same order** |
| Customer abandons / session expires | `checkout.session.expired` (Checkout) / PaymentIntent `canceled` | order stays `created`/`attempted` | scheduled job cancels unpaid orders after N minutes using the existing cancel + restock path (`orderService.updateOrderStatus(..., 'cancelled')`) |
| Authorised, not captured (Razorpay) | n/a | `payment.authorized` | capture server-side, or enable auto-capture |
| Delayed methods (bank debits/vouchers) | status `processing` | n/a | do not fulfil until the success event |
Reconciliation job (daily): list provider payments for the last 48 h and compare with `orders.payment_status`; alert on any difference.

## 7. Order payment-status updates
Single service function `applyPaymentResult(orderId, result)` used by *both* the verification endpoint and the webhook,
doing: validate amount/currency -> transition `payment_status` -> write `order_status_history` -> `confirmed` status
-> notifications. Emit the existing realtime notification to the customer's `user:<id>` room (the socket layer already
authenticates and restricts rooms). Fix the analytics/vendor revenue queries to be based on `paid` orders *and* to
exclude refunded amounts (the vendor revenue calculation was corrected in this release to `price x quantity`).

## 8. Refunds and cash on delivery
* **Refunds:** admin-only endpoint `POST /admin/orders/:id/refund` (amount <= paid amount, reason, audit-logged via the
  existing `auditLog` middleware). Stripe: Refunds API with the PaymentIntent (or charge) id; Razorpay: refund API on the
  payment id. Persist a `refunds` row with the provider refund id (UNIQUE), set `payment_status` to `refunded` only on the
  provider's confirmation webhook (`charge.refunded` / `refund.processed`), not when the request is sent.
  Partial refunds need a `refunded_amount` column. Decide the restock policy for returned goods (cancellation restocks
  automatically only before shipment; refunds after delivery do not).
* **Cash on delivery:** `paid` is set manually by the vendor/admin at delivery (needs a new, audited transition),
  otherwise COD revenue also stays zero.

## 9. Security checklist for the implementation
* Webhook secrets and API secrets only in environment variables; rotate on exposure; separate test/live.
* HTTPS only; raw-body route isolated; signature check before any DB write; constant-time comparisons.
* Never log full payloads or secrets; log provider ids and event ids.
* Amounts as integers in minor units; recompute server-side; reject currency mismatches.
* PCI scope: use Stripe Elements/Checkout or Razorpay Checkout so card data never touches this server (SAQ A level).
* Tests: unit tests with signed fixture payloads (generate signatures in the test with a test secret), duplicate-event
  replay, out-of-order events, amount mismatch, tampered signature, and an integration test against each provider's
  **test mode** (Stripe CLI `stripe listen`/`stripe trigger`, Razorpay test keys).

## 10. Suggested order of work (rough effort for one developer)
1. Migration + `PaymentProvider` interface + `applyPaymentResult` + tests (1-2 days)
2. Provider 1: create-payment endpoint, webhook route with raw body, dedupe table, tests (2-3 days)
3. Frontend: replace the placeholder "pay" choice with the provider's hosted checkout/Elements and a payment-pending screen (2-3 days; no redesign needed, same checkout page)
4. Failed/abandoned handling + stock-release job + reconciliation (1-2 days)
5. Refunds + admin UI hook (1-2 days)
6. Provider 2 (about half of step 2-4), then a test-mode end-to-end rehearsal and a security review before any live key is configured.
