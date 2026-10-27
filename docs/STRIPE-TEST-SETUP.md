# Stripe Checkout — TEST MODE ONLY (decision B4)

**Decision (Oct 24, 2026):** Stripe Checkout on funksquish.com; TikTok Shop stays a separate marketplace checkout; PayPal may come later. This approves **preparing and testing** only. **Real purchasing stays disabled** until a separate, owner-approved launch.

## Status

| Piece | State |
| --- | --- |
| Live checkout on funksquish.com | ❌ Not approved. `src/commerce/provider.ts` always refuses; `features.commerce = false`. |
| Stripe test integration | ✅ Built and unit-tested (98 automated tests). Runs **only** on Netlify Deploy Previews or `npm run dev`. |
| Real products | ❌ None. Test mode uses 4 labeled **test fixtures** with made-up prices, never shown in the shop. |
| End-to-end test with the real Stripe sandbox | ✅ Oct 24, 2026 (local, Stripe CLI forwarding): paid order, decline, cancel, stock holds, signed webhooks, duplicate deliveries, partial + full refunds — see Test plan. ⏳ 3-D Secure not run. |

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

Checkout Session settings: `mode=payment`, U.S. shipping address required (`allowed_countries: ["US"]`; Stripe still lists territories, so a shipping-area note is shown and territory orders are flagged — see Findings), shipping options = your test rate IDs, tax off unless `STRIPE_TEST_AUTOMATIC_TAX=true`, expires after ~31 minutes (Stripe's minimum is 30), metadata links every line to its variant, SKU and fulfillment source.

## Owner setup (you do these — I never handle keys)

1. **Stripe account:** sign up or log in at stripe.com yourself and stay in **Test mode / Sandbox**. No business verification is needed for test mode.
2. **Test API key:** Developers → API keys → Create secret key → *Building your own integration* → *Custom permissions*: **Checkout Sessions: Write; Products, Prices, Shipping Rates: Read**; everything else None (done Oct 24 as `funksquish-test-website`, a `rk_test_` key). Never create or paste a live key.
3. **Test shipping rate:** Product catalog → Shipping rates. Created Oct 24: "TEST standard (not a real rate)", $5.00, `shr_1UUBDKDGCeAlIfUisH1g8nVc` — a placeholder, **not** a real shipping price.
4. **Where to put them** (never in GitHub, never in chat):
   - **Local:** a file named `.env.local` in the project (already git-ignored):
     `STRIPE_TEST_CHECKOUT_ENABLED=true`, `STRIPE_TEST_SECRET_KEY=…`, `STRIPE_TEST_SHIPPING_RATE_IDS=shr_…`
   - **Netlify:** Environment variables → add each with **Deploy Previews only** (Production left empty); tick **Contains secret values** for the key.
5. **Webhooks (local):** install the Stripe CLI (`npm install -g @stripe/cli`), log in with `stripe login` and authorize **only the sandbox** (done Oct 24 as project `funksquish`), then run
   `stripe listen --forward-to localhost:3000/api/stripe/test-webhook --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,checkout.session.expired,charge.refunded,charge.dispute.created,charge.dispute.updated,charge.dispute.closed`
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
| Invalid / tampered / replayed webhook signature | — | ✅ 400 | ✅ local (forged signature → 400) |
| Signed webhook creates the order | Pay with card 4242 while `stripe listen` forwards | ✅ | ✅ real sandbox: `checkout.session.completed` → 200, order `FS-T-20261024-E92D5E6E`; the return page showed the same order |
| Duplicate webhook events | `stripe events resend evt_…` | ✅ one order, stock once | ✅ real sandbox: resent `checkout.session.completed` and `charge.refunded` → 200 "duplicate", not re-processed |
| Successful payment → order | Card 4242 | ✅ | ✅ **real sandbox:** 2 Blue + 1 supplier Mint → $17.50 + $5.00 shipping = $22.50; order `FS-T-20261024-69076031` split into 2 shipments; page reload kept the same order |
| Stock committed after payment | Try to buy 4 of the 5 Blue after 2 sold | ✅ | ✅ real sandbox: "Only 3 … can be ordered" |
| Canceled checkout | "Back" link on Stripe | ✅ session expired, stock freed | ✅ real sandbox: Stripe log shows `POST …/expire 200`; the 3 held units were available again |
| Declined payment | Card `4000 0000 0000 0002` | ✅ | ✅ real sandbox: Stripe shows "card was declined", no redirect; opening the result URL for that unpaid session → "Payment not completed", **no order** |
| Held stock blocks others | Checkout open on all remaining units | ✅ only one gets it | ✅ real sandbox: second cart → "just sold out" |
| Territory address (PR, GU, VI…) | — | ✅ order flagged `restricted_destination` | ✅ note shows on Stripe's address form |
| Refund | `stripe refunds create` (or Dashboard) | ✅ order updated | ✅ real sandbox: $5 partial → "Part of this order was refunded"; rest → "refunded in full" (via `charge.refunded` webhooks) |

Run the automated suite any time with `npm test`.

## Findings from the real sandbox test

- **Stripe lists U.S. territories under "United States".** With `allowed_countries: ["US"]`, Stripe's state menu includes Puerto Rico, Guam, the U.S. Virgin Islands, American Samoa, the Northern Mariana Islands, and the Marshall Islands, Micronesia and Palau. Hosted Checkout can't hide them, so a note now appears on Stripe's address form, and any such order is flagged `restricted_destination` for a refund (`src/commerce/orders/shipping-restrictions.ts`). D.C. is treated as allowed. Confirm this with the owner, since the policy lists "50 states + APO/FPO/DPO".
- **Payment methods shown:** card, Cash App Pay, Klarna and Bank (ACH) are on by default in the sandbox. Bank is a delayed method; the code handles it (order "processing" until Stripe confirms), but stock holds last only ~31 min, so a slow bank payment can be flagged `oversold`. Before launch, decide which payment methods to keep (Dashboard → Settings → Payment methods).
- **Link "save my info" is ticked by default** on Stripe's page. That's Stripe's own feature, not ours.
- **Adaptive Pricing is on** (shows local currencies to foreign cards). It's harmless for U.S.-only shipping; you can turn it off in Dashboard → Settings → Checkout if you prefer USD only.

- **Local dev store:** test orders live in memory under `npm run dev`, shared by the webhook and pages, and reset when the server restarts. Stripe is the source of truth: the next time an order's return page is opened, it's rebuilt from Stripe (refunds recorded before the restart aren't re-applied until the next refund event). Deploy Previews use durable Netlify Blobs.

## Not built yet (on purpose)

Live checkout, order confirmation/tracking emails, an admin order view, real shipping rates, sales-tax registration, real products. See `docs/CHECKOUT-LAUNCH-READINESS.md`.

Sources: [Checkout Sessions API](https://docs.stripe.com/api/checkout/sessions/create) · [Fulfill orders](https://docs.stripe.com/checkout/fulfillment) · [Webhook signatures & duplicates](https://docs.stripe.com/events/manage-webhook-endpoints) · [API versioning](https://docs.stripe.com/api/versioning) · [Testing](https://docs.stripe.com/testing)
