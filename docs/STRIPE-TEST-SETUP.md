# Stripe Checkout — B4 approved, TEST MODE ONLY

Decision date: October 24, 2026. Website: Stripe Checkout on the existing Next.js/Netlify site; TikTok Shop is a separate marketplace checkout; PayPal may be added later. This is authorization to PREPARE AND TEST, **not** to accept real payments or ship customer orders.

## Current status

- `features.commerce = false` and `features.checkoutMode = "disabled"` remain unchanged. No checkout UI, live payments, or product publication is enabled.
- Provider refuses any key other than `sk_test_` and refuses Netlify production. Requires a test shipping rate. A leaked/misconfigured `sk_live_` key cannot be used by this adapter.
- Current public catalog is empty: `products.json = []`; illustrations are NOT real products and cannot be purchased.
- Signed webhook route exists only as a test probe. It does NOT save customer orders, reconcile payment state, send confirmations, reserve stock, or fulfill anything.
- Prices are taken from the server-side published catalog in USD integer cents; no client-supplied amounts are accepted.
- Stripe keys, webhook signing secrets, order details and customer information MUST NOT be committed to this public repository.

## Preparing Stripe (owner actions)

1. Register or access a Stripe account using your own details; complete any required business verification directly with Stripe.
2. Switch to **Stripe test mode / sandbox**. Do not use live API keys or real cards.
3. Create one test shipping rate in Stripe (test mode) for a realistic trial; copy its `shr_...` ID. This is a placeholder for testing only, not an approved production shipping price.
4. In a LOCAL `.env.local` (never commit), configure:
   - `STRIPE_TEST_SECRET_KEY=sk_test_...`
   - `STRIPE_TEST_SHIPPING_RATE_ID=shr_...`
   - `STRIPE_TEST_RETURN_ORIGIN=http://localhost:3000` (local only)
   - `STRIPE_TEST_WEBHOOK_SECRET=whsec_...` (from Stripe CLI test listener or test webhook destination)
5. On Netlify use **Deploy Previews only**, not Production, for these test variables. A preview's return origin must be its exact `https://...netlify.app` URL (or omit `STRIPE_TEST_RETURN_ORIGIN` to use `DEPLOY_PRIME_URL`).
6. The webhook endpoint is `/api/stripe/test-webhook`. Configure it in the Stripe **test** dashboard or Stripe CLI and subscribe to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, and `checkout.session.expired`. Webhook secrets are endpoint-specific and must never be public.
7. To exercise the cart, make a temporary *deploy-preview-only* test branch with an approved, accurately priced, tracked, published product fixture and temporarily enable the feature flags **on that test branch only**. Never merge enabled flags, demo products or mock stock into `main`. A dedicated preview-only test fixture, real catalog, and fulfillment/test order store should be reviewed first. Do not test with products that lack compliance approval on a public live site.
8. Exercise one test card payment, a failure/cancel, invalid cart quantities, duplicate variants, zero/unknown stock, and webhook bad-signature/replay failures. Verify logs and Stripe test events. Never use real payment methods.
9. Keep feature flags OFF on `main` until shipping, taxes, legal policies, inventory/order management, returns, and safety checks are approved for live launch.

## Launch blockers (not implemented in this PR)

- Durable, idempotent order persistence and verified fulfillment flow (verified signed webhook alone is insufficient).
- Stock reservation/decrement and cross-channel reconciliation with TikTok Shop to prevent overselling.
- Actual buyer-paid shipping quotes, APO/FPO coverage and supplier-fulfilled split-ship carts.
- Sales-tax registration/nexus determination and tax calculation; no assumption of tax-free checkout.
- Customer order email, refund handling, order lookup, carrier tracking, rate limiting/abuse mitigation and monitoring.
- Actual product SKUs, cost/profit review, documented compliance and safety approvals.
- Final Privacy / Terms review (B5 and B6) and owner approval for accepting LIVE payments.
- Revisit the test-only adapter in a separate reviewed launch PR for live mode; do not merely swap in a live key.

Relevant API docs: https://docs.stripe.com/api/checkout/sessions/create and https://docs.stripe.com/webhooks/signature
