# Deploy-preview verification — results (2026-10-27)

**Bottom line: the combined code built on Netlify and passed CI on GitHub, but the sandbox checks on the preview itself
were NOT run.** This session couldn't reach the preview (network policy) and has no Stripe sandbox, Netlify or owner
credentials (by design). Nothing below is claimed as passing unless it actually ran. Plan with pass criteria:
`docs/PREVIEW-VERIFICATION-PLAN.md` (V-1 … V-25).

## What ran

| Where | What | Result |
| --- | --- | --- |
| Preview PR [#15](https://github.com/test23780460/FunkSquish/pull/15) (DO NOT MERGE; `main` + CI + policy stack + checkout stack) | Netlify deploy preview build — `https://deploy-preview-15--ephemeral-syrniki-2b3f3c.netlify.app` (deploy `6ae034705a2eca340fbd2e43`) | **Built.** Netlify "Header rules" and "Redirect rules" checks passed |
| Same PR, GitHub Actions run 40454687640 (job 122025157421) | Secret scan (335 files), `npm ci --ignore-scripts`, launch safeguards, `npm audit` (high+), lint, typecheck, policy/SEO tests (73), **all tests (456/456)**, catalog check, production build | **All passed** |
| This sandbox, combined code (`next dev`, made-up TEST fixtures, throwaway local passphrase, in-memory storage) | Browser checks below | See below |
| This sandbox | Every branch: tests, lint, typecheck, build | All passed (see each PR) |

## Required scenarios (owner's list) — status

| Scenario | On the Netlify preview with Stripe sandbox | What did run |
| --- | --- | --- |
| Normal payment | **Not run** | Automated: order created only from a verified, paid session; idempotent (`tests/orders`, `tests/checkout`). Earlier sandbox run recorded in `docs/STRIPE-PRODUCTION.md` (local dev + Stripe CLI, before this phase). |
| Failed payment | **Not run** | Automated: declined/expired sessions create no order, holds released. Local browser: Stripe unreachable → "Nothing was charged", hold released, only the error type logged. |
| 3-D Secure | **Not run** | Earlier sandbox run in `docs/STRIPE-PRODUCTION.md` (before this phase). No new code path. |
| Incorrect prices / manipulated carts | **Not run** | Automated: browser prices and shipping ignored; bad carts refused (`tests/checkout/validate-cart`, `tests/shipping/checkout-flow` "ignores any shipping amount the browser sends"). |
| Mixed-source orders | **Not run** (V-13 … V-16) | Automated: 60 shipping tests. **Local browser (phone + desktop): PASS** — cart shows 3 packages ($4.50 + $5.99 + $7.00 = $17.49), total before tax $36.49, "no shipping is ever added later"; an item from the unrated supplier is explained and checkout is disabled. |
| Concurrent inventory reservations | **Not run** (V-18) | Automated: 8 shoppers / last unit; 10 concurrent TikTok sales; TikTok sales racing checkouts (`tests/orders/inventory`, `tests/inventory/stock`). |
| Stock changes from manual TikTok sales | **Not run** (V-17, V-19) | Automated: a recorded sale immediately limits the cart and checkout. **Local browser: PASS** — "Sold 1 on TikTok" 5 → 4, activity logged, phone and desktop. |
| Partial and full refunds | **Not run** (V-2, V-3, V-16) | Automated: refund race, per-package refunds, webhook never double-counts. Sandbox key still lacks **Refunds: write**. |
| Duplicate Stripe webhook events | **Not run** (V-11) | Automated: duplicates skipped by event id and per session (`tests/orders/webhook`, `tests/api/webhook-route`). |
| Shipping delays and customer notifications | **Not run** (V-4 … V-7) | Automated: delay notices per package, consent rules, failed email changes nothing. |
| Chargeback event recording | **Not run** (V-8 … V-10) | Automated: `charge.dispute.*` recorded with deadline, duplicates ignored. Sandbox webhook must subscribe to the dispute events. |
| Customer and owner email notifications | **Not run** (V-1, V-4) | Automated: each email claimed once, test mode sends nothing unless `STRIPE_TEST_SEND_EMAILS=true`. |
| Customer-data exposure | **Not run on the preview** (V-23) | Automated: every owner page/action checks the session (static scan + flow tests). **Local browser: PASS** — half-signed-in visits to Orders, Inventory, Today and Partners redirect to the code page with no data. |
| Owner authentication and MFA | **Not run on the preview** (V-21 … V-24) | Automated: 27 owner-security tests. **Local browser: PASS** — setup with a real computed code, wrong codes refused, recovery codes shown once (bug found here and fixed), right code reaches Today. |
| Checkout shows cards only, no Link (V-25) | **Not run** | Automated: session settings request cards only, no payment-method configuration, no saved cards/promotions (`tests/checkout/policy-config`). Link itself is a Dashboard setting. |

Also checked locally on the combined code (phone + desktop): Shipping is in effect; Returns, Privacy and Terms show
"Draft — not yet in effect" and are `noindex`; no serious/critical axe issues on the policy, inventory, LIVE, Today and
activity pages; no horizontal scrolling; no page errors.

## Blockers (what has to change for the preview run)

1. **Network:** this cloud environment's network policy refused `deploy-preview-15--ephemeral-syrniki-2b3f3c.netlify.app`.
   To let a session test it: the environment's settings → Network access → add that host (or `netlify.app`) to Allowed
   domains. The person running the checks in their own browser doesn't need this.
2. **Deploy Previews environment variables (Netlify, owner only):** `STRIPE_TEST_CHECKOUT_ENABLED=true`,
   `STRIPE_TEST_SECRET_KEY` (sandbox **restricted** key with Checkout Sessions **and Refunds** write),
   `STRIPE_TEST_WEBHOOK_SECRET` (`STRIPE_TEST_SHIPPING_RATE_IDS` no longer needed with PR #21), `STRIPE_TEST_SEND_EMAILS=true` (only while testing,
   with your own email addresses), owner sign-in variables. Previews scope only — never Production.
3. **Stripe sandbox webhook** to `https://deploy-preview-15--ephemeral-syrniki-2b3f3c.netlify.app/api/stripe/test-webhook`
   with the 8 events in the plan (including the three `charge.dispute.*`).
4. **Owner passphrase** for V-17 … V-24 (and an authenticator app for V-21 … V-24 — the preview has its own security
   settings, separate from production).

## How to run it (about an hour)

Follow `docs/PREVIEW-VERIFICATION-PLAN.md` top to bottom on PR #15's preview, then post the table (date, PASS/FAIL,
Stripe event ids) as a comment on PR #15. When done: remove `STRIPE_TEST_SEND_EMAILS`, close PR #15 **without merging**,
delete the `claude/upbeat-hawking-aonyc6-preview` branch.
