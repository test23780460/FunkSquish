# Stripe production (live) readiness

**Status: built, tested in the Stripe sandbox, LOCKED.** Nothing in this document is switched on. Real payments need
your explicit approval and the steps at the end.

## Architecture

| | Test (sandbox) | Live |
| --- | --- | --- |
| Where it can run | Deploy previews and local dev only | Production only |
| Locks | `STRIPE_TEST_CHECKOUT_ENABLED=true` + a `sk_/rk_test_` key | **Code switch** (`features.commerce = true`, `checkoutMode = "hosted-checkout"`) + production + `STRIPE_LIVE_CHECKOUT_ENABLED=true` + a `sk_/rk_live_` key + webhook secret + shipping rate |
| Rejects | live keys, live sessions, live events | test keys, test sessions, test events |
| Products | labelled test fixtures | real catalog, only where `canPurchase()` is true |
| Webhook | `/api/stripe/test-webhook` | `/api/stripe/webhook` |
| Return page | `/checkout/test-result` | `/checkout/complete` (404 unless live is unlocked) |
| Order store (Netlify Blobs) | `stripe-test-orders` | `stripe-live-orders` (refuses to open off production) |
| Order numbers | `FS-T-YYYYMMDD-XXXXXXXX` | `FS-YYYYMMDD-XXXXXXXX` |

Flow:
1. The browser sends only variant ids and quantities.
2. The server re-prices everything from the catalog, checks stock and **reserves** it (about 31 minutes).
3. The server creates a Stripe Checkout Session with an idempotency key; the shopper pays on Stripe.
4. An order is created only from a **verified webhook**, or from the server re-fetching the session from Stripe. A
   browser redirect is never enough.
5. Stock is committed exactly once and order emails are sent once.
6. The owner ships, refunds or cancels from `/partners/review/orders`.

Code: `src/commerce/checkout/{environment,live,stripe,service}.ts`,
`src/commerce/orders/{fulfill,inventory,webhook,notify,admin,store}.ts`.

## Safeguards (all covered by tests)

- **Server-side cart validation:** integer quantities 1–10, at most 20 lines, prices and stock from the catalog only;
  preview, sold-out and unknown items are refused. Prices the browser sends are ignored.
- **No overselling:** compare-and-set stock ledger, all-or-nothing reservations, holds that expire on their own,
  sales committed once, and late payments that oversell flagged `oversold` for refund.
- **Durable, private orders:** Netlify Blobs (private to the site, encrypted at rest, strong consistency, 5 s
  timeouts, missing-key workaround). Customer data never goes to GitHub, logs or the return page.
- **Signed webhooks:** raw-body HMAC check with Stripe's library, a 5-minute replay window, a 256 KB limit, and
  rejection of events from the other mode. Processing is idempotent per event **and** per session, and a 5xx makes
  Stripe retry.
- **Card payments only:** `allowed_payment_method_types: ["card"]` (Apple Pay / Google Pay count as cards).
  ⚠ See "Payment methods".
- **Refunds:** from the owner page, through Stripe, with an idempotency key, recorded immediately. Stripe's
  `charge.refunded` webhook then finds nothing new, so a refund is never double-counted.
- **Emails:** customer confirmation, owner alert (no customer contact details) and a shipping notice. Each is claimed
  before sending, so it goes out exactly once; failed sends can be retried. Test mode sends nothing unless
  `STRIPE_TEST_SEND_EMAILS=true`.
- **Owner-only management:** same sign-in as partner review; every action re-checks the session; refund and cancel
  need the order number typed.
- **U.S. territories:** Stripe's form can't hide them. A note is shown, and such orders are flagged
  `restricted_destination` for a full refund.

## Compliance additions (legal audit, 2026-10-27 — branch `claude/upbeat-hawking-aonyc6-checkout`)

Built on top of this PR's head; nothing here unlocks live payments.

| Change | Why | Where |
| --- | --- | --- |
| Refund recorded once even if `charge.refunded` lands while the owner's refund is being saved | The race recorded a $5 refund as $10 and capped the owner page's "can still refund" amount too low | `orders/admin.ts` `refundOrder`, `tests/audit/refund-race.test.ts` |
| Ship-by date on every package (2 business days, Eastern Time, federal holidays skipped); owner list/detail flag "due today", "overdue", "set ship-by" | Shipping Policy + FTC Mail Order Rule: the owner must know before a ship-by date passes | `orders/ship-by.ts`, `orderAttention()` |
| Delay notice email from the order page (new date or "unknown"; free cancel; silence = consent only for a first delay ≤ 30 days) with a record on the package | 16 CFR 435.2(b); the Shipping Policy promises it | `sendDelayNotice()`, `delayNoticeEmail()` |
| Card disputes recorded from `charge.dispute.*` with the evidence deadline; order flagged "disputed" while open | Chargeback evidence in one place; Stripe deadlines are 7–21 days | `recordDispute()`; **subscribe the live endpoint to the three dispute events** |
| Policy versions stored on the session and order (`policy_versions` metadata) | Terms: "the versions in effect when you placed it" | `policyVersionsTag()`, `src/content/policies.ts` (identical copy of PR #11's file) |
| Terms notice above Stripe's Pay button (`custom_text.submit`) | Turns "by placing an order you agree" into a visible notice at the moment of purchase | `TERMS_NOTICE` |
| Shipping email: the 7-day damage window is "ideally", not a cutoff; confirmation email promises a delay email with a refund option | Matched to the Returns and Shipping policies (PR #11) | `orders/notify.ts` |

### Open review items (need an explicit owner decision before live payments)

1. ~~One shipping charge per mixed order.~~ **Decided and built (2026-10-27, branch `claude/upbeat-hawking-aonyc6-shipping`):**
   mixed carts are allowed; the server prices one package per origin from verified rates and sends Stripe one inline
   shipping charge for all packages (`docs/MIXED-ORDER-SHIPPING.md`). The `shr_…` ids are still required by the unchanged
   locks but no longer set the price (decision D-SHIP-3).
2. ~~MFA for the owner area.~~ **Decided and built (branch `claude/upbeat-hawking-aonyc6-mfa`):** authenticator-app
   two-step sign-in, required automatically once live checkout (or partner applications) is on, and **live checkout
   refuses to open until an enrollment exists** (`src/lib/owner/mfa-gate.ts`, `docs/OWNER-SECURITY.md`).
3. **Deploy-preview verification is not done.** Refund, delay-notice and dispute flows have automated tests only; see
   `docs/PREVIEW-VERIFICATION-PLAN.md` for the sandbox run and its pass criteria.

## Payment methods

Start with **cards only** (credit/debit, plus Apple Pay and Google Pay). Don't offer delayed methods (bank debits/ACH,
buy-now-pay-later) until their "payment pending, then succeeded or failed" path has been tested end to end. The code
supports it (`async_payment_*` events, `processing` orders that never ship until paid), but it hasn't been tested with
a real bank delay.

**Sandbox finding (2026-10-27):** even with cards only, Stripe Checkout still showed **Link**. It offered "Save my
information with Link" (ticked by default, asking for a phone number) and Link's **Bank ($5 back)** and **Klarna**
options. Stripe rejects excluding Link per session, and our restricted key can't manage payment-method configurations
(correctly). **Owner decision (2026-10-27): cards and card wallets only; Link off at launch.** Owner steps:
`docs/OWNER-ACTIONS.md` (Stripe). Then preview check **V-25** confirms Stripe's page shows no Link. The code side is
tested: sessions request cards only and never a payment-method configuration, saved cards or promotion codes
(`tests/checkout/policy-config.test.ts`).

## Live settings (Netlify → Production, mark secrets as secret)

| Variable | Value |
| --- | --- |
| `STRIPE_LIVE_CHECKOUT_ENABLED` | `true` — only on launch day |
| `STRIPE_LIVE_SECRET_KEY` | A **restricted** live key (`rk_live_…`) with **Checkout Sessions: Write**, **Refunds: Write**, and **Products: Read** + **Prices: Read** (order line items are read with their product details — the sandbox key that passed on Oct 24 had these reads; corrected 2026-10-27), and **Disputes: Read** (when Stripe sends conflicting dispute updates, the current Dispute is read to settle them; without it the order falls back to event times and marks unclear disputes "check in Stripe"). Everything else None. |
| `STRIPE_LIVE_WEBHOOK_SECRET` | From the live webhook endpoint `https://funksquish.com/api/stripe/webhook`, listening to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`, `charge.dispute.created`, `charge.dispute.updated`, `charge.dispute.closed` |
| `STRIPE_LIVE_SHIPPING_TABLE` | **Your approval of the exact shipping rates** (replaces `STRIPE_LIVE_SHIPPING_RATE_IDS`, proposal in its own PR, decision D-SHIP-3): the `ship_v1_…` code shown on the owner Orders page under "Shipping rates for live checkout", after you've checked the rates. Not a secret. If the rates later change in code, live checkout closes until you set the new code. The live lock also needs at least one origin with verified, current rates (`docs/MIXED-ORDER-SHIPPING.md` §4). `STRIPE_LIVE_SHIPPING_RATE_IDS` is no longer read — delete it if set. |
| `STRIPE_LIVE_AUTOMATIC_TAX` | `true` once Stripe Tax has your Kentucky registration |
| `ORDER_EMAIL_FROM` / `ORDER_NOTIFY_EMAIL` | Sender (verified in Brevo) and owner address; default to the `PARTNER_NOTIFY_*` values |
| `BREVO_API_KEY` | Already set for Production |

The **sandbox** key is restricted to Checkout Sessions only, so the owner page's **Refund** button gets
`more_permissions_required` in test mode. That's expected; refunds were tested through the Stripe CLI instead.
It also lacks **Disputes: Read** (checked 2026-10-31: `more_permissions_required`), so on previews conflicting
dispute events are settled from event times only; add Disputes: Read to the sandbox key to test the Stripe re-read.

### Key permission lock (Disputes: Read)

A key's permissions live in Stripe, so live checkout **asks Stripe** before opening
(`src/commerce/checkout/key-permissions.ts`): one read-only `disputes.list` call with `limit: 1`; nothing it returns is
kept. Missing **Disputes: Read** (Stripe answers `more_permissions_required`), a rejected key, or Stripe being
unreachable all keep live checkout and cart quotes closed, with an owner-facing log line (no key text). A pass is reused
for 10 minutes per server instance, a failure for 1 minute, and "unreachable" not at all. Test mode is **not** gated,
so previews keep working with the sandbox key as it is.

**Check key permissions** on the owner Orders page asks Stripe immediately about the key this site uses: the sandbox
key on previews; on production, the live key **even before the other live locks are open**, so a missing permission
can be fixed before launch. A live answer also refreshes the checkout gate at once. CI's safeguards check fails if
the requirement or the gate is removed.

## Failure recovery

| Problem | What happens / what to do |
| --- | --- |
| Webhook delivery fails | Stripe retries for up to 3 days. **"Check Stripe for missed orders"** on the orders page records any paid checkout from the last 3 days that has no order (idempotent). |
| Stripe down when checkout starts | Stock is released; the shopper sees "Nothing was charged — please try again". |
| Shopper closes the tab | The hold expires with the session (`checkout.session.expired` frees it, or it times out on its own). |
| Item sold out during a long checkout | The order is flagged `oversold`; refund that item and email the customer. |
| Email provider fails | The order page shows "failed"; press **Retry failed emails**. |
| Delayed payment fails | The order is canceled and stock freed (`async_payment_failed`). |
| Storage slow or unavailable | Every call times out after 5 s; the webhook returns 5xx and Stripe retries. |

## Rollback

1. **Stop new payments now:** Netlify → Environment variables → remove `STRIPE_LIVE_CHECKOUT_ENABLED` (Production) and
   redeploy (about 15 credits). Or merge a PR setting `features.commerce = false`. The cart goes back to "Checkout
   isn't open yet". Paid orders stay in Stripe and in `stripe-live-orders`.
2. **Bad deploy:** Netlify → Deploys → pick the last good production deploy → **Publish deploy** (instant, no build).
3. **Key exposed:** Stripe Dashboard → Developers → roll the restricted key and the webhook secret, then update Netlify.
4. Afterwards, press **Check Stripe for missed orders**, and refund any order that can't be fulfilled.

## Sandbox test results (2026-10-27, local dev + Stripe CLI webhooks, sandbox account)

| Test | Result |
| --- | --- |
| 11 bad carts (quantity 0/11/1.5/text, duplicates over limit, over stock, sold out, unknown, preview item, empty) | All rejected with clear messages |
| Tampered price ($0.01 from the browser) | Ignored; Stripe session subtotal **$5.00** (catalog price) |
| Card-only session | `payment_method_types: ["card"]` ✅, but Link still shown on the page ⚠ (see above) |
| Paid (4242) | Order recorded, $17.50, two fulfillment groups, supplier group "awaiting supplier" |
| 3-D Secure (4000 0025 0000 3155) | **Fail** → Stripe error, no order; **Complete** → order recorded |
| Declined (4000 0000 0000 0002) | "Your credit card was declined", no order |
| Last-unit hold | A second shopper was refused ("just sold out") while the first checkout was open |
| Cancel (back link) | Session expired, stock released; the second shopper could then check out |
| Interrupted checkout (session expired via API) | `checkout.session.expired` processed, hold released |
| Refund (CLI, $5) | `charge.refunded` synced: "partially refunded", $12.50 remaining |
| Duplicate webhooks (resent completed + refunded) | Both logged "duplicate"; still 2 orders, refund still $5 |
| Mark shipped | Tracking saved, order "partially fulfilled", shipping email claimed once |
| Refund from owner page | Wrong confirmation refused; correct one → Stripe `more_permissions_required` (restricted sandbox key), safe error, order unchanged |
| Reconcile | Found 4 paid sandbox checkouts, recorded the 2 whose orders were lost by a dev restart |

## Exactly what must happen before the first real payment

1. Legal: Privacy Policy and Terms approved after attorney review (PR #11), including the Stripe/order sections and the
   order-record retention period.
2. Tax: Kentucky sales and use tax permit; Kentucky registration added in Stripe Tax; `STRIPE_LIVE_AUTOMATIC_TAX=true`;
   a test order showing the tax line.
3. Stripe account: business verification complete; payouts bank account added by you; **Link (and its Bank/Klarna)
   turned off**; statement descriptor and support details set.
4. Shipping: real packed weights and carrier costs entered as the verified `funksquish` origin rule, each supplier's
   signed agreement and rate card entered as its origin (`docs/MIXED-ORDER-SHIPPING.md` §3); you check the rates on the
   owner Orders page and set `STRIPE_LIVE_SHIPPING_TABLE` to the approval code shown; Shipping Policy wording matches the
   per-package calculation.
5. Products: real, sellable products in the catalog with price, tracked stock, SKU, weight, age grade and safety
   documents (`npm run catalog:check`); final-sale labels before any blind-bag items.
6. Live keys and webhook created **by you** in the Stripe Dashboard and saved in Netlify Production as secrets (never in
   chat or GitHub). Then press **Check key permissions** on the owner Orders page: it must say the live key has
   **Disputes: Read**. Live checkout stays closed until Stripe confirms it (see "Key permission lock" below).
7. Owner security: two-step sign-in set up **on production** (checkout stays closed without it), then `OWNER_MFA_REQUIRED=true` for Production
   (`docs/OWNER-SECURITY.md`); two-step verification on Stripe, Netlify, Google, GitHub, Brevo and TikTok Shop.
8. Inventory: starting counts confirmed on the production inventory page for every product being sold
   (`docs/INVENTORY.md`).
9. A reviewed **launch PR** that flips `features.commerce` / `checkoutMode` (and updates `EXPECTED` in
   `scripts/safeguards-check.mjs`); merge it only after steps 1–8 and a passing preview run
   (`docs/PREVIEW-VERIFICATION-PLAN.md`).
10. Launch-day check: buy one real low-cost item with your own card, confirm the order, emails and shipping flow, then
   refund it from the owner page.
