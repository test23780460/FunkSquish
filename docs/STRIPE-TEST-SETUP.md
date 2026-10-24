# Stripe Checkout — TEST MODE ONLY (decision B4)

**Decision (Oct 24, 2026):** Stripe Checkout on funksquish.com; TikTok Shop stays a separate marketplace checkout; PayPal may come later. This approves **preparing and testing** only. **Real purchasing stays disabled** until a separate, owner-approved launch.

## Status

| Piece | State |
| --- | --- |
| Live checkout on funksquish.com | ❌ Not approved. `src/commerce/provider.ts` always refuses; `features.commerce = false`. |
| Stripe test integration | ✅ Built and unit-tested (91 automated tests). Runs **only** on Netlify Deploy Previews or `npm run dev`. |
| Real products | ❌ None. Test mode uses 4 labeled **test fixtures** with made-up prices, never shown in the shop. |
| End-to-end test with a real Stripe test account | ⏳ Not done yet. Needs the owner's Stripe **test** keys (see Owner setup). |

## How production is protected

Every Stripe code path calls `readStripeTestConfig()` (`src/commerce/checkout/environment.ts`). It returns nothing — and the routes return **404** — unless **all** of these are true:

1. The build is a **Deploy Preview** or local dev. Netlify production and branch deploys are refused (deploy context is frozen into the build, so re-rendered pages can't lose it).
2. `STRIPE_TEST_CHECKOUT_ENABLED=true` is set for that context.
3. The key starts with `sk_test_` or `rk_test_`. **Live keys (`sk_live_`, `rk_live_`) are rejected outright.**
4. At least one test shipping rate (`shr_…`) and a non-production return URL are configured.

Also: Stripe's reply must be a `cs_test_` session with `livemode: false` hosted on `checkout.stripe.com`; webhook events with `livemode: true` are rejected; no secrets or test data reach browser bundles (checked in the production build).

## What's built (code map)

| File | What it does |
| --- | --- |
| `src/commerce/checkout/environment.ts` | Test-only guard, live-key rejection, config parsing |
| `src/commerce/checkout/validate-cart.ts` | Server-side cart validation: whole-number quantities 1–10, max 20 lines, duplicates merged, prices **from the server catalog only**, stock/sold-out checks, preview samples refused |
| `src/commerce/checkout/stripe.ts` | Stripe client (API version pinned to `2026-09-30.endive` via the official `stripe` SDK 23.0.1), Checkout Session parameters, response sanity check |
| `src/commerce/checkout/service.ts` | Start checkout (hold stock → create session with an idempotency key → release on failure); cancel (expire the session, free stock) |
| `src/commerce/checkout/test-fixtures.ts` | The 4 test products + the "bad cart" list used on the harness |
| `src/commerce/orders/*` | Order model, stock ledger, idempotent fulfillment, webhook routing, storage — see `docs/ORDER-MANAGEMENT.md` |
| `src/app/api/stripe/test-webhook/route.ts` | Signed webhook (official `constructEvent`: HMAC-SHA256, constant-time compare, 5-minute replay window) |
| `src/app/checkout/test/page.tsx` | Internal test harness (real cart drawer + bad-cart buttons) |
| `src/app/checkout/test-result/page.tsx` | Return page: re-fetches the session from Stripe; only a **paid** session creates an order |

Checkout Session settings: `mode=payment`, U.S. shipping address required (`allowed_countries: ["US"]` — all 50 states and APO/FPO/DPO; territories excluded per policy S2), shipping options = your test rate IDs, tax off unless `STRIPE_TEST_AUTOMATIC_TAX=true`, expires after ~31 minutes (Stripe's minimum is 30), metadata links every line to its variant, SKU and fulfillment source.

## Owner setup (you do these — I never handle keys)

1. **Stripe account:** sign up or log in at stripe.com yourself and stay in **Test mode / Sandbox**. No business verification is needed for test mode.
2. **Test API key:** Developers → API keys. Prefer a **restricted test key** (`rk_test_…`) with *Checkout Sessions: Write* and *Products: Read*; the standard test secret key (`sk_test_…`) also works. Never create or paste a live key.
3. **Test shipping rate:** Product catalog → Shipping rates → create one (e.g. "Test standard"). It's a placeholder for testing, **not** a decision about real shipping prices. Copy its `shr_…` ID.
4. **Where to put them** (never in GitHub, never in chat):
   - **Local:** a file named `.env.local` in the project (already git-ignored):
     `STRIPE_TEST_CHECKOUT_ENABLED=true`, `STRIPE_TEST_SECRET_KEY=…`, `STRIPE_TEST_SHIPPING_RATE_IDS=shr_…`
   - **Netlify:** Environment variables → add each with **Deploy Previews only** (Production left empty); tick **Contains secret values** for the key.
5. **Webhooks (local):** install the Stripe CLI, then run
   `stripe listen --forward-to localhost:3000/api/stripe/test-webhook --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,checkout.session.expired,charge.refunded`
   and put the printed `whsec_…` in `.env.local` as `STRIPE_TEST_WEBHOOK_SECRET`.
6. **Webhooks (previews):** Netlify protects Deploy Previews with team login, so **Stripe can't reach a preview's webhook** (it gets 401). That's a good default — keep it. On previews the return page still records paid orders; test expiry/refund/async webhooks locally with the CLI.

## Test plan

Open `/checkout/test` (local or preview). Test cards: `4242 4242 4242 4242` (success), `4000 0000 0000 0002` (declined), `4000 0025 0000 3155` (3-D Secure), any future date, any CVC. **Never** use a real card.

| Scenario | How | Automated test | Manually verified |
| --- | --- | --- | --- |
| Invalid quantities (0, 11, 1.5, "2", NaN) | Harness buttons | ✅ | ✅ local (rejected) |
| Duplicate cart entries | Harness "6 + 6" | ✅ merged; over limit rejected | ✅ local |
| Unavailable / sold-out / not enough stock | Harness buttons | ✅ | ✅ local |
| Incorrect (tampered) price | Harness button | ✅ server price used | ✅ local (validation passed, server price) |
| Preview sample product | Harness button | ✅ | ✅ local |
| Missing Stripe configuration / switch off / production | — | ✅ 404 / "isn't open yet" | ✅ production build: 404s |
| Invalid test credentials | Fake key | ✅ friendly error, stock released | ✅ local (Stripe rejected fake key; log shows only the error class) |
| Live key supplied | — | ✅ rejected | — |
| Invalid / tampered / replayed webhook signature | — | ✅ 400 | ✅ local (bad signature → 400) |
| Duplicate webhook events | — | ✅ one order, stock once | ⏳ needs Stripe CLI |
| Successful payment → order | Card 4242 | ✅ (mocked Stripe) | ⏳ needs your test keys |
| Canceled checkout | Back button on Stripe | ✅ session expired, stock freed | ✅ local (cancel page) |
| Failed / declined payment | Card …0002 | ✅ async failure cancels order | ⏳ needs your test keys |
| Two shoppers, one unit | — | ✅ only one gets it | — |
| Refund | Refund in Stripe test Dashboard | ✅ order updated | ⏳ needs Stripe CLI |

Run the automated suite any time with `npm test`.

## Not built yet (on purpose)

Live checkout, order confirmation/tracking emails, an admin order view, real shipping rates, sales-tax registration, real products. See `docs/CHECKOUT-LAUNCH-READINESS.md`.

Sources: [Checkout Sessions API](https://docs.stripe.com/api/checkout/sessions/create) · [Fulfill orders](https://docs.stripe.com/checkout/fulfillment) · [Webhook signatures & duplicates](https://docs.stripe.com/events/manage-webhook-endpoints) · [API versioning](https://docs.stripe.com/api/versioning) · [Testing](https://docs.stripe.com/testing)
