# Mixed-order shipping — one checkout, one shipping charge, separate packages

**Status (2026-10-27): built and tested in a draft branch (`claude/upbeat-hawking-aonyc6-shipping`, stacked on PR #14).
Live purchasing is still disabled; no live-payment lock was changed.** Owner decision: customers can buy FunkSquish stock
and supplier-shipped products together in one Stripe checkout (replaces "launch with our own stock only").

## 1. What the customer sees

| Where | What |
| --- | --- |
| Cart drawer (before leaving the site) | Shipping for the cart, split per package when there's more than one ("From FunkSquish: 2 items, ships within 2 business days — $6.50"), the combined shipping charge, and the total before tax. Items that can't be shipped yet are marked with a plain explanation and the checkout button stays off until they're removed. |
| Stripe's checkout page | One shipping line ("Shipping (3 packages)") with the combined charge, the tax, and the final total **before the Pay button**. Above the address form: how many packages, where each ships from (generic labels, never supplier names), each one's processing time, and any package that can't go to APO/FPO/DPO addresses. |
| Confirmation email | Each package with its items, ship-by date and shipping charge; "the shipping you paid at checkout covers every package — we never add shipping charges later". |
| Shipping emails | One per package (and one per replacement), naming the package and saying the others ship separately. |

Nothing is charged after payment. The code has no way to charge a card again.

## 2. How shipping is calculated (`src/commerce/checkout/shipping-quote.ts`)

1. Every variant has an **origin**: where it ships from (`src/commerce/data/shipping-origins.json`, checked by `src/commerce/origins.ts`; prepare changes on the dashboard's Shipping page). Our own stock is `funksquish` by
   default; supplier items must name theirs (catalog column `fulfillment_origin`).
2. **All items from one origin go in one package and share one base charge.** A second item from the same place
   never adds a second base fee.
3. Each package is priced from its origin's **verified rule** only:
   - `per-item`: first item + each additional item, up to a maximum per package (typical supplier rate card);
   - `weight`: items' shipping weights + packaging, looked up in a table of weight tiers (typical for our own USPS labels).
4. The packages add up to **one** shipping charge, sent to Stripe as the only shipping option (inline
   `shipping_rate_data`, `tax_behavior: exclusive`, Stripe tax code `txcd_92010001` for shipping so tax on shipping
   follows each state's rules once Stripe Tax is on).
5. Each package's charge and processing time are stored on the Checkout Session (`metadata.shipping_plan`) and become
   the order's packages. If the plan is missing or doesn't add up to what Stripe charged, the order is flagged
   `shipping_mismatch` for the owner — no package price is ever guessed.

**Mixed orders can cost more than single-origin orders** (two places shipping = two packages). That's shown before
payment, as the owner approved.

### What blocks checkout (only for the affected items)

| Situation | Shopper sees | Owner sees (server log / docs) |
| --- | --- | --- |
| Origin has no verified rule | "Shipping for X isn't set up yet, so it can't be ordered right now. Please remove it to continue — the rest of your cart can still be ordered." | `No verified shipping rates have been entered for this origin.` |
| Verification missing who/when/evidence, dated in the future, or older than `reviewEveryDays` (default 90) | same | `not-verified` / `verification-expired` |
| Supplier without a signed agreement on file | same | `no-supplier-agreement` |
| No committed processing time | same | `no-processing-time` |
| Product page promises faster shipping than the origin commits to | same | `promises N business days but this origin commits to M` |
| Weight-priced origin, item has no weight | same | `weight is missing` |
| A $0 rate without `zeroCostConfirmed: true` | same | `zero-cost-unconfirmed` — free supplier shipping is never assumed |
| Package heavier/larger than the biggest verified tier | "The items shipping from X won't fit in one package. Please lower the quantity of Y or place a second order." | `over the largest package in the rule` |
| More than 5 origins in one cart | "…more than 5 different places. Please remove Y and order it separately." | — |

The product pages use the same readiness check (`canPurchase` → `variantShippingReady`), so an item whose shipping
isn't ready shows as "Coming soon" instead of offering a buy button once purchasing is switched on.

## 3. Entering verified rates (owner)

Nothing here is filled in yet: `SHIPPING_ORIGINS` has only `funksquish` with `rule: null`, so **no real product can be
checked out until you do this** (by design).

**Our own stock (`funksquish`)**
1. Weigh each product packed in its real mailer/box (catalog `weight_grams` is the unit weight; also weigh the empty
   packaging → `packagingGrams`).
2. Price USPS (or your carrier) for each weight tier. Hosted Stripe Checkout **can't change the shipping price after the
   customer types the address**, so the charge can't depend on distance: pick an amount per tier that covers your
   costliest zone (or accept a loss on far zones). Write down the quotes.
3. Add the rule, e.g. `{ kind: "weight", packagingGrams: 60, tiers: [{ upToGrams: 250, cents: 550 }, …] }`, and
   `verified: { on: "YYYY-MM-DD", by: "owner", evidence: "private/shipping/usps-2026-11.pdf" }` in a reviewed PR.

**Each supplier**
1. Signed agreement covering: committed processing time (business days to hand to the carrier), the shipping rate
   card, tracking provided for every package, **use of customer names and addresses only to fulfill FunkSquish
   orders** (Privacy Policy commitment), whether they ship to APO/FPO/DPO, returns/defects handling, and recall
   cooperation.
2. Add an origin with an opaque id (`supplier-a`), the generic label `"a FunkSquish supplier partner"`, the rule from
   their rate card, `processingBusinessDays`, `agreementOnFile: true`, `militaryAddresses`, and `verified`.
3. In the catalog CSV set `fulfillment_source=supplier` and `fulfillment_origin=supplier-a` for their items (optional
   columns; `npm run catalog:import` rejects a supplier row with no origin). Keep the supplier's name, costs and the
   agreement in `private/` only.
4. Re-verify every 90 days (or set `reviewEveryDays`); expired origins stop checkout automatically.

## 4. Stripe shipping-rate ids → replaced by verified, owner-approved rates (decision D-SHIP-3)

**Review (2026-10-27):** the old lock required 1–5 Stripe `shr_…` ids (`STRIPE_*_SHIPPING_RATE_IDS`). Since mixed-order
shipping, checkout sends Stripe the server's own computed rate (`shipping_rate_data`), so those ids are never used: any
valid-looking id opened the lock, it proved nothing about what customers are charged, and a stale id could give false
confidence. The requirement is obsolete.

**Replacement (its own draft PR, stacked on the MFA branch, so you can accept or decline it separately):**

| Mode | Before | After |
| --- | --- | --- |
| Live | 1–5 `shr_…` ids in `STRIPE_LIVE_SHIPPING_RATE_IDS` | (a) at least one origin with **verified** rates (a rule, who/when/evidence, supplier agreement on file) **and** (b) `STRIPE_LIVE_SHIPPING_TABLE` = the **approval code (fingerprint) of the exact table** that will be charged |
| Test (sandbox) | 1–5 `shr_…` ids in `STRIPE_TEST_SHIPPING_RATE_IDS` | nothing extra — test checkout already prices only the labeled test origins; the old variable is ignored |

- Nothing is weakened: every other live lock is untouched (code switch, production only, env switch, live key,
  webhook secret), the live lock goes from 6 to 7 conditions, and the checkout service also needs owner two-step
  sign-in. The new conditions are tied to real prices; the old one wasn't.
- The fingerprint (`src/commerce/shipping-approval.ts`) covers each origin's rule, verification, review period,
  processing time, APO/FPO support, supplier agreement and $0 confirmation (not display wording). **Any change closes
  live checkout until you approve the new table** — rates can't change on customers without you seeing them first.
  The owner Orders page shows the code, how many origins are verified, and whether Production's value matches.
- Review dates: the lock itself doesn't read the clock (pages that check it are built ahead of time, and Next.js
  refuses clock reads there — caught by the build). A verification past its `reviewEveryDays` (or dated in the
  future) is refused item by item at checkout, every time, exactly as before; if every origin lapses, nothing can be
  bought. The owner Orders page counts only current verifications.
- Tests: `tests/shipping/approval.test.ts` (9) and the live-lock cases in `tests/checkout/live-readiness.test.ts`.

## 5. After payment: packages on the order (`/partners/review/orders/<session>`)

| Situation | Owner action | What happens |
| --- | --- | --- |
| Normal | Mark each package shipped with its tracking | One shipping email per package; order "partially fulfilled" until every remaining package ships |
| One package will be late | Delay notice on that package | FTC delay email for those items only; the other packages keep their dates |
| Customer cancels one delayed/unshipped package | **Cancel just this package** (type the order number) | Refund = that package's items (incl. their tax) + its shipping + its share of shipping tax; its stock goes back; the rest carries on. A supplier package already placed needs "I've canceled it with the supplier" ticked. |
| Carrier confirms a package lost | **Carrier confirmed it lost** → **Send a free replacement** or **Refund package** | Replacement: old tracking kept, new ship-by date from today, its own "replacement" email, no charge. Refund: the whole package. |
| Package comes back undeliverable | **Record return** with the cause | "Needs attention" shows the Shipping Policy's 5-business-day refund deadline. Our/carrier fault → reship free or refund; wrong address/refused → refund (reship if the customer agrees). |
| Whole order | Existing refund-by-amount and cancel-before-shipping | Unchanged |

Every refund goes through Stripe with an idempotency key (now including the package id) and is recorded once even if
Stripe's `charge.refunded` webhook arrives first.

**Tax.** Package refunds include the tax Stripe charged on those items and that package's share of the tax on shipping
(split to the cent). How partial refunds appear in Stripe Tax reports and Kentucky filings is an accountant question
(**Q-TAX-3**).

## 6. Limits (said plainly)

- Rates can't vary by destination (hosted Checkout limitation); APO/FPO/DPO restrictions are disclosed, and an order
  that slips through is flagged `military_unsupported` for a refund of that package.
- One package per origin; no automatic splitting of very large orders (they're refused with an explanation).
- Supplier ship-by dates are only as good as the supplier's performance — the delay-notice process still applies.
- Signature confirmation is not offered to customers (see §7).

### Abuse limits on the quote and on "Secure checkout" (`src/commerce/checkout/rate-limit.ts`)

The cart's shipping quote reads the catalog and stock on every call, and "Secure checkout" holds stock for ~31 minutes
and creates a Stripe session, so both are limited **per shopper network** (never site-wide, so one abuser can't close
checkout for everyone):

| Request | Burst guard (memory, per server instance) | Stored limits (all instances) |
| --- | --- | --- |
| Shipping quote | 40 per minute | 150 per 10 minutes |
| Start checkout | 6 per minute | 10 per 30 minutes, 30 per day |

- Quotes and checkout starts are counted **separately**: a shopper who edits the cart a lot can still pay. A limited
  quote says the shipping and total will be shown on Stripe's page before paying, and doesn't disable the button.
- Limits are far above real use (tested: 40 cart edits + checkout; 8 round trips to Stripe; 5 shoppers on one shared
  school/office/phone-carrier address, 25 edits each).
- The network is Netlify's `x-nf-client-connection-ip` (a spoofed `X-Forwarded-For` is ignored); IPv6 is grouped by
  `/64`. Nothing is counted while checkout is closed; inputs are shape-checked (max 20 lines, 1–10 each) before any
  storage read; Next.js server actions also refuse cross-site posts.
- **Privacy:** the address is used in memory and as a keyed, truncated hash (`PARTNER_SECRET`); it's never stored or
  logged. Counters live in the existing `partner-rate-limits` store, whose daily cleanup deletes them 2 days after
  their window (tested). Proposed Privacy Policy sentence: see PR #19 (`docs/POLICY-COMPARISON.md`).
- **Failure modes:** a storage outage lets requests through (checkout then succeeds or fails on its own); a flood of
  parallel requests from one network that keeps colliding on its own counter is refused. Without `PARTNER_SECRET`
  only the in-memory guard applies (a warning is logged).
- **Residual risk:** an attacker with many addresses can still hold stock for up to ~31 minutes per checkout. The
  owner sees units "in shoppers' checkouts" on the Inventory page and can pause a SKU; Netlify's platform rate limits
  (plan-dependent) can be added later without code changes.

## 7. Signature confirmation (proposed $150 threshold)

`src/commerce/signature.ts`: the owner order page **recommends** buying signature confirmation for orders of $150 or
more (configurable `recommendAtOrAboveCents`). It is never charged to the customer and never advertised
(`chargeCustomer: false`, `advertised: false` are fixed in the type). Before enforcing or advertising it: confirm the
carrier service and price, and that a missed signature (post-office pickup) is acceptable for the customer
experience. **Decision D-OPS-2b.**

## 8. Outstanding supplier dependencies

| # | Needed before supplier items can be sold | Status |
| --- | --- | --- |
| SUP-1 | Signed agreement per supplier (processing time, rates, tracking, data-use limit, APO/FPO, returns/defects, recall cooperation) | Not started |
| SUP-2 | Written rate card per supplier → origin rule | Not started |
| SUP-3 | Product safety documents per supplier item (CPC, test reports, tracking labels) | Not started (catalog `private_*` columns) |
| SUP-4 | Supplier's real processing time ≤ what the product page states | Not started |
| SUP-5 | Our own packed weights and USPS costs → `funksquish` rule | Not started |

## 9. Tests

`tests/checkout/rate-limit.test.ts` (22 tests): real shoppers still check out (heavy cart editing, repeated trips to
Stripe, a shared network, rapid taps); quote floods, checkout-start floods (30-minute and daily caps; nothing held or
sent to Stripe when refused), spoofed headers, IPv6 /64 grouping, colliding parallel requests, bounded memory; keyed
hashes only, deleted by the daily cleanup, never logged; storage outage; nothing counted while closed.

`tests/shipping/` (58 tests): single-origin weight tiers; one base charge per origin; supplier-only with two suppliers;
mixed carts; blocked unverified/expired/agreement-less/unknown origins; $0 rates; promise mismatch; too-large and
too-many-origin carts; plan encoding and tamper rejection; Stripe session shape and the cart quote matching it;
browser-sent shipping ignored; per-origin packages with ship-by dates; mismatch and legacy fallbacks; military flag;
tax allocation; per-package cancel/refund (amounts, idempotency, no double count with the webhook, stock returned for
that package only); lost → replacement (new tracking, its own email) or refund; returned with the 5-business-day
deadline; order status; customer emails.

**Not tested here:** a real Stripe sandbox session with inline shipping (needs the deploy-preview run —
`docs/PREVIEW-VERIFICATION-PLAN.md`, checks V-13 to V-16).
