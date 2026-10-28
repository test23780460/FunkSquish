# Compliance launch gates

_2026-10-27 · Not legal advice. Every gate is a yes/no check with evidence. A feature may only be switched on when
**every** gate in its section — and every global gate — is marked PASS with the evidence filled in. Record evidence in
`private/LAUNCH-CHECKLIST.md` (git-ignored) or link to it here; never paste secrets._

Status today: **all features below are OFF.** `features.commerce = false`, `checkoutMode = "disabled"`,
`partnerApplications = false`, newsletter and drop alerts not enabled in Production, Stripe live locked.

Legend: 🔧 = automated check exists · 👤 = owner action · ⚖️ = needs attorney/accountant answer (see
`LEGAL-OPEN-QUESTIONS.md`).

## G. Global gates (apply to every feature below)

| # | Gate | Pass when | How to verify |
| --- | --- | --- | --- |
| G-1 | Automated checks green | `npm test`, `npm run lint` (0 errors), `npm run typecheck` (after a build), `npm run build` all pass on the exact commit being deployed | 🔧 run them; paste the summary lines |
| G-2 | Policy consistency | `tests/legal/*` pass: no contradictory deadlines, only approved time commitments, no banned claims, links resolve | 🔧 `npx vitest run tests/legal` |
| G-3 | Draft labels honest | Privacy/Terms show the Draft banner and `noindex` **until** G-4; Shipping/Returns show the date in `src/content/policies.ts` | 🔧 `tests/legal/rendered-policies.test.ts` |
| G-4 | Legal review done | Attorney answers recorded for every Priority 1 question that the feature depends on; owner approves the final text; `POLICIES.<id>.status` changed and date set to the merge date | 👤⚖️ signed-off list in the PR |
| G-5 | Owner approvals recorded | Every "owner approval needed" row in `POLICY-COMPARISON.md` is ✅ or the text is reverted | 👤 |
| G-6 | No secrets in git | Secret scan of the deploy commit finds nothing (patterns in `MASTER-LEGAL-AUDIT.md` §6.3); `.env*` not tracked | 🔧 regex scan |
| G-7 | Dependency audit | `npm audit --omit=dev` reports 0 high/critical | 🔧 |
| G-8 | Analytics scrubbing | Production build with analytics: Umami hook defined before the tracker; Squish Box `name` stripped; `/partners/review*` and `/checkout*` not sent | 🔧 `tests/analytics/*` + browser check (`MASTER` §6.4) |

## PA. Partner applications can open

| # | Gate | Pass when | How to verify |
| --- | --- | --- | --- |
| PA-1 | Privacy text final | Privacy Policy partner section + partner notice approved (G-4) | 👤⚖️ |
| PA-2 | Readiness script | `npm run partners:readiness` passes for Production | 🔧 |
| PA-3 | Retention runs | `partner-retention` deployed, last successful run < 36 h, alert email tested | 🔧 review page shows green |
| PA-4 | Legal hold respected | Deletion request against a held application refuses and logs | 🔧 `tests/partners/review-actions.test.ts` |
| PA-5 | Owner sign-in hardened | Passphrase ≥ 14 chars in a password manager; Netlify and Google accounts use 2-step verification | 👤 |
| PA-6 | Inbox hygiene | Owner has a written routine for deleting partner emails from Gmail per the schedule | 👤 |

## M. Marketing subscriptions can operate (launch list, drop alerts)

| # | Gate | Pass when | How to verify |
| --- | --- | --- | --- |
| M-1 | CAN-SPAM basics | Brevo footer shows the postal address; unsubscribe link works on a preview test campaign; opt-outs honored < 10 business days | 👤 test send |
| M-2 | Children's privacy decision | Attorney answer to **Q-COPPA-1** recorded and implemented (e.g., neutral age screen, or written conclusion that none is needed) | ⚖️ |
| M-3 | Consent wording matches | Form checkbox text, Privacy Policy and the confirmation email describe the same list and purpose | 🔧 `policy-facts` consent tests + 👤 read the Brevo template |
| M-4 | Endorsement/LIVE disclosures | Written script: gifted or paid products disclosed at the start and repeated during LIVEs; creator agreement requires clear disclosures | 👤 |
| M-5 | Reviews policy | Before any review/testimonial appears: no incentivized-only selection, no suppression of negatives, no insider reviews without disclosure (16 CFR 465) | 👤 (none on the site today) |
| M-6 | Giveaway rules | Before any giveaway: attorney-reviewed official rules (no purchase necessary) published with it | ⚖️ **Q-PROMO-1** |
| M-7 | Brevo key healthy | API key not expired; double opt-in test on a preview passes | 👤 |

## P. Product listings can become purchasable

| # | Gate | Pass when | How to verify |
| --- | --- | --- | --- |
| P-1 | Safety documents | `npm run catalog:check` exits 0 for every published product (verified CPC, CPSC-accepted lab report, test date, tracking-label photo, invoice, unit cost) | 🔧 |
| P-2 | Public facts present | `tests/catalog/published-products.test.ts` passes (photos, age grade, manufacturer/importer, material, price, weight, tracked stock) | 🔧 |
| P-3 | Water beads | No product contains water beads unless lab reports show compliance with **16 CFR 1250.4** (products made after March 12, 2026); no product appears on a CPSC recall | 👤 check cpsc.gov/Recalls on listing day |
| P-4 | Warnings above the buy button | For each product with label warnings, the product page shows them in the buy box before the button; cards show "See details to buy" | 🔧 `tests/shop/disclosures.test.ts` + 👤 look at the live page |
| P-5 | Final sale disclosed | Every mystery/blind-bag product has `final_sale_once_opened` set (true or false) | 🔧 `catalog:check` blocks otherwise |
| P-6 | Stock is real | Physical count matches `inventory_available` on the day of listing; separate allocation (or sync) for TikTok Shop | 👤 count sheet |
| P-7 | Prices honest | No compare-at price without `private_compare_at_basis` | 🔧 `catalog:check` |
| P-8 | Processing time supportable | Any `processing_business_days` other than 2 is backed by a supplier SLA or stock on hand | 👤 |
| P-9 | Manufacturer status | Attorney answer to **Q-SAFE-1** if repacking, private-labelling or importing | ⚖️ |

## C. Stripe can accept live payments

Everything in `docs/STRIPE-PRODUCTION.md` ("Exactly what must happen before the first real payment"), plus:

| # | Gate | Pass when | How to verify |
| --- | --- | --- | --- |
| C-1 | Policies final | Privacy + Terms approved (G-4), including order retention (**Q-RET-1**) | 👤⚖️ |
| C-2 | Tax | KY permit; Stripe Tax registration; a test order shows the tax line (**Q-TAX-1**) | 👤 |
| C-3 | Checkout compliance branch merged | `claude/upbeat-hawking-aonyc6-checkout` (refund race fix, ship-by, delay notices, disputes, policy versions, Terms notice) reviewed and merged into the checkout PR | 🔧 its tests (249) pass |
| C-4 | Webhook events | Live endpoint subscribed to the 5 order events **and** `charge.dispute.created/updated/closed` | 👤 Stripe Dashboard screenshot |
| C-5 | Reconciliation | "Check Stripe for missed orders" run daily for the first 2 weeks and after any outage | 👤 log |
| C-6 | Payment methods | Link (and its Bank/Klarna offers) off, or the Privacy Policy updated to mention it; cards only | 👤 |
| C-7 | Dispute evidence pack | Owner knows where to find: order record, policy versions, tracking/delivery proof, emails sent (confirmation, shipping, delay), customer messages; response within Stripe's deadline | 👤 dry run on a test dispute |
| C-8 | Owner area second factor | MFA or equivalent protection for the owner area before real customer addresses are stored (proposal **P-SEC-1**) — or a written owner decision to accept the risk (**D-SEC-1**; MFA recommended, see `OWNER-REVIEW-FLAGS.md` §3) | 👤 |
| C-9 | Live smoke test | One real low-value purchase, confirmation + shipping emails received, refunded from the owner page, refund recorded once | 👤 |
| C-10 | Deploy-preview sandbox run | Every check V-1 … V-12 in `docs/PREVIEW-VERIFICATION-PLAN.md` (PR #14) recorded as PASS on a deploy preview or branch deploy, sandbox keys only (**D-QA-1**) | 👤 results in the PR |

## F. FunkSquish can begin fulfilling orders

| # | Gate | Pass when | How to verify |
| --- | --- | --- | --- |
| F-1 | Ship-by discipline | Owner checks the orders list every business day; nothing shows "ship-by passed" without a delay notice or refund | 👤 |
| F-2 | Supplier agreement | Each supplier who ships to customers has a signed agreement covering: ship-by SLA, tracking, safety documents per SKU, recall cooperation, and **use of customer data only for delivery** | 👤⚖️ |
| F-3 | Supplier-shipped items | No supplier-shipped product is published until F-2 passes and its `processing_business_days` is set | 👤 |
| F-4 | Packaging & returns | Return address, photo-on-arrival routine for returns, label-voiding routine for cancellations; for nonconforming returns: two emails before any disposal, **no disposal while a dispute, chargeback or fraud review is open**, disposal recorded (**D-RET-1**) | 👤 |
| F-5 | Recall readiness | Recall/Section 15(b) runbook (`MASTER` §7.5) read; order records retained long enough to contact buyers | 👤 |
| F-6 | Territory/oversold SLA | Orders flagged territory/oversold refunded within 1 business day | 👤 |
| F-7 | Mixed-order shipping | Written decision **D-SHIP-1** (own stock only at launch, worst-case flat rate, cart-dependent rate, or no mixed carts) before any supplier-shipped product can share a cart with our stock | 👤 (`OWNER-REVIEW-FLAGS.md` §1) |

## O. Ongoing operations (monthly)

| # | Check | Pass when |
| --- | --- | --- |
| O-1 | Partner retention | Last run green; overdue deletion requests = 0 |
| O-2 | Privacy requests | All answered within 30 days, logged |
| O-3 | Recalls | cpsc.gov/Recalls searched for every listed product type |
| O-4 | Email health | Brevo key valid; failed order emails = 0 or retried |
| O-5 | Policy drift | `npm test` green on `main`; any policy edit bumps `src/content/policies.ts` |
