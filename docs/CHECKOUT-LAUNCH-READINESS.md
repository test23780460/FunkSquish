# Checkout launch readiness — what's needed before real sales

_Research Oct 24, 2026. Not legal or tax advice — confirm with the Kentucky Department of Revenue and an accountant._

Current decisions: U.S. only (50 states + APO/FPO/DPO), buyer-paid shipping with rates shown before payment, tracking on every order, TikTok Shop as a separate checkout, custom Next.js site on Netlify, Stripe Checkout (test mode only so far).

## 1. Shipping rates and restrictions
- **Don't guess rates.** Weigh each packed product (`weightGrams` + package tare in `src/commerce/shipping.ts`), then choose rates from real USPS/UPS quotes.
- Stripe Checkout charges **fixed shipping rates** you create (optionally several, e.g. standard/expedited) or rates you compute per cart; Stripe does **not** buy labels or ship anything. Labels come from a shipping tool (e.g. Pirate Ship, free) or the carrier.
- Restriction is already enforced: `allowed_countries: ["US"]` (all states, APO/FPO/DPO; no territories). Revisit if policy S2 changes.
- Before launch: decide 1–3 shipping rates from real package weights; create them in Stripe **live** mode at launch time.

## 2. Sales tax (Kentucky and beyond)
- Kentucky sales tax is **6% statewide, no local add-ons**. Toys are taxable. Delivery charges on taxable goods are generally **taxable** in Kentucky.
- Selling from Kentucky means registering for a **Kentucky sales and use tax permit** (Department of Revenue, online) **before** collecting tax, then filing returns.
- **TikTok Shop** is a marketplace facilitator: it collects and remits sales tax on TikTok Shop orders. Website (Stripe) orders are **your** responsibility.
- Other states: you owe tax there only after crossing that state's economic-nexus threshold (often $100,000 in sales; some states also count transactions). Track website sales by state.
- **Stripe Tax** can calculate it (`automatic_tax`, already wired behind `STRIPE_TEST_AUTOMATIC_TAX`): about **0.5% per transaction** where you're registered, and it **only collects where you've added a registration**. It does **not** register you or file returns by default.
- Before launch: KY permit → add the KY registration in Stripe Tax → turn on automatic tax → confirm the tax line on a test order.

## 3. Refunds and cancellations
- Policy is final (`/returns`): 30-day unopened returns, damaged/wrong items replaced or refunded, refunds within 5 business days.
- Refunds are issued in the Stripe Dashboard; the webhook records them on the order (`charge.refunded`). Stock is **not** auto-returned until returned items are checked.
- Canceling an unshipped order = full refund in Stripe + mark the order canceled. (FTC rule: if we can't ship within the stated 2 business days, offer the choice to cancel.)

## 4. Overselling protection
- Built: stock is held per checkout (~31 min) with compare-and-set writes; sold units are committed exactly once; expired holds free themselves; late payments that oversell are flagged for manual review.
- Before launch: move stock to transactional storage (`docs/ORDER-MANAGEMENT.md`) and **sync stock with TikTok Shop** (same physical units sell on both channels). Until synced, keep separate stock allocations per channel.

## 5. Webhook security
- Built: raw-body signature check with Stripe's official library, 5-minute replay window, live events rejected in test mode, 404 outside test environments, small body limit, no customer data in logs.
- Before launch: a separate live endpoint with its own secret; listen only to needed events; optionally allow only [Stripe's webhook IPs](https://docs.stripe.com/ips); roll the signing secret if it's ever exposed.

## 6. Customer data protection
- Card data never touches our site (Stripe-hosted checkout).
- Orders contain names, emails and addresses → private storage only; never in GitHub, never in logs; the return page shows only items and totals.
- Before launch: retention period (decision B5), Privacy Policy section naming Stripe and order data, owner-only access to orders (login + strong password + 2FA on Stripe/Netlify).

## 7. Payment and checkout error recovery
- Built: friendly errors for bad carts, sold-out items, Stripe outages ("Nothing was charged"); stock released when session creation fails; canceled checkouts expire the Stripe session; if the return page can't reach Stripe, the webhook still records the order.
- Stripe retries failed webhook deliveries for up to 3 days; missed events can be replayed from the Dashboard / Events API.

## 8. Duplicate event delivery
- Built and tested: event-id de-duplication plus per-session idempotency, so duplicates — or two different events for the same session — never create two orders or double-count stock.

## 9. Split fulfillment (in-house + supplier)
- Built: each line carries its fulfillment source; orders split into one fulfillment group (and tracking) per source; supplier groups start as `awaiting_supplier` for **manual** ordering.
- Before launch: written agreement with each approved supplier, their CPC/test reports on file (`docs/COMPLIANCE.md`), and a decision on whether mixed carts pay one or two shipping charges.

## Launch blockers checklist

- [ ] Real products: inventory on hand or supplier authorization, CPC/test reports, photos, weights (`npm run catalog:check`)
- [ ] Stripe account verified by you; **live** keys created by you at launch time only
- [ ] Shipping rates from real package weights
- [ ] Kentucky sales tax permit; Stripe Tax registration added
- [ ] Order storage moved to transactional database (approval needed)
- [ ] Order confirmation + shipping/tracking emails
- [ ] Stock sync or split allocation with TikTok Shop
- [ ] Privacy & Terms final (B5 retention, B6 legal review), Stripe named in Privacy Policy
- [ ] Separate, owner-approved **live launch PR** (never by pasting a live key into the test code)

Sources: [Stripe Tax setup](https://docs.stripe.com/tax/set-up) · [Stripe Tax in Checkout](https://docs.stripe.com/tax/checkout/automatic-tax-default) · [Stripe fulfillment](https://docs.stripe.com/checkout/fulfillment) · [Kentucky sales tax guide (Numeral)](https://www.numeral.com/blog/kentucky-sales-tax-guide) · [Kentucky sales tax (Zamp)](https://zamp.com/guides/kentucky-sales-tax) · [KY DOR on delivery charges (2004 newsletter)](https://revenue.ky.gov/News/Publications/Sales%20Tax%20Newsletters/Sales%20Tax%20Facts%202004%20-%20Jun.pdf)
