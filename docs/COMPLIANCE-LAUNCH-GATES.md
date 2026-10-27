# Compliance launch gates

_2026-10-27 · Not legal advice. Every gate is a yes/no check with evidence. A feature may only be switched on when
**every** gate in its section — and every global gate — is marked PASS with the evidence filled in. Record evidence in
`private/LAUNCH-CHECKLIST.md` (git-ignored) or link to it here; never paste secrets._

Status today: **all features below are OFF.** `features.commerce = false`, `checkoutMode = "disabled"`,
`partnerApplications = false`, newsletter and drop alerts not enabled in Production, Stripe live locked.

**Phase 2 update (2026-10-27):** owner decisions applied and built in draft PRs — mixed-order shipping (#16), shared
manual inventory (#17), owner two-step sign-in (#18), policy directions (#19), CI (#20), combined preview (#15, do not
merge). Gate statuses: `docs/LAUNCH-READINESS-PHASE2.md`.

Legend: 🔧 = automated check exists · 👤 = owner action · ⚖️ = needs attorney/accountant answer (see
`LEGAL-OPEN-QUESTIONS.md`).

## G. Global gates (apply to every feature below)

| # | Gate | Pass when | How to verify |
| --- | --- | --- | --- |
| G-1 | Automated checks green | The CI check "Tests, lint, types, build and safeguards" (`.github/workflows/ci.yml`, PR #20) passes on the exact commit being deployed — tests, lint (0 errors), typecheck, build, catalog check | 🔧 GitHub check on the PR |
| G-2 | Policy consistency | `tests/legal/*` pass: no contradictory deadlines, only approved time commitments, no banned claims, links resolve | 🔧 `npx vitest run tests/legal` |
| G-3 | Draft labels honest | Privacy, Terms and (until its legal review) Returns show the Draft banner and `noindex` **until** G-4; Shipping shows the date in `src/content/policies.ts` | 🔧 `tests/legal/rendered-policies.test.ts`, `phase2-decisions.test.ts` |
| G-4 | Legal review done | Attorney answers recorded for every Priority 1 question that the feature depends on; owner approves the final text; `POLICIES.<id>.status` changed and date set to the merge date | 👤⚖️ signed-off list in the PR |
| G-5 | Owner approvals recorded | Every "owner approval needed" row in `POLICY-COMPARISON.md` is ✅ or the text is reverted | 👤 |
| G-6 | No secrets in git | `scripts/secret-scan.mjs` (CI) finds nothing; `.env*` not tracked; GitHub secret scanning + push protection on | 🔧 CI + 👤 GitHub setting (`docs/CI.md`) |
| G-7 | Dependency audit | `npm audit --omit=dev --audit-level=high` passes (CI); Dependabot alerts on | 🔧 CI + 👤 |
| G-9 | Safeguards changed on purpose | The launch PR is the only PR that changes `EXPECTED` in `scripts/safeguards-check.mjs`, and it says which switch it turns on | 🔧 CI step fails otherwise |
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
| P-6 | Stock is real | Starting count set on the production inventory page (one shared stock for the website and TikTok Shop — owner decision, no separate allocation); TikTok LIVE routine followed (`docs/INVENTORY.md`) | 👤 inventory page |
| P-7 | Prices honest | No compare-at price without `private_compare_at_basis` | 🔧 `catalog:check` |
| P-8 | Processing time supportable | Any `processing_business_days` other than 2 is backed by a supplier SLA or stock on hand | 👤 |
| P-9 | Manufacturer status | Attorney answer to **Q-SAFE-1** if repacking, private-labelling or importing | ⚖️ |

## C. Stripe can accept live payments

Everything in `docs/STRIPE-PRODUCTION.md` ("Exactly what must happen before the first real payment"), plus:

| # | Gate | Pass when | How to verify |
| --- | --- | --- | --- |
| C-1 | Policies final | Privacy + Terms approved (G-4), including order retention (**Q-RET-1**) | 👤⚖️ |
| C-2 | Tax | KY permit; Stripe Tax registration; a test order shows the tax line (**Q-TAX-1**) | 👤 |
| C-3 | Checkout branches merged | PR #14 (compliance fixes), #16 (mixed-order shipping), #17 (inventory) and #18 (two-step sign-in) reviewed and merged in stack order | 🔧 CI green on each |
| C-4 | Webhook events | Live endpoint subscribed to the 5 order events **and** `charge.dispute.created/updated/closed` | 👤 Stripe Dashboard screenshot |
| C-5 | Reconciliation | "Check Stripe for missed orders" run daily for the first 2 weeks and after any outage | 👤 log |
| C-6 | Payment methods | **Decided: cards and card wallets only, Link off.** Link turned off in sandbox and live (`docs/OWNER-ACTIONS.md`); preview check V-25 passes | 👤 + 🔧 `tests/checkout/policy-config.test.ts` |
| C-7 | Dispute evidence pack | Owner knows where to find: order record, policy versions, tracking/delivery proof, emails sent (confirmation, shipping, delay), customer messages; response within Stripe's deadline | 👤 dry run on a test dispute |
| C-8 | Owner area second factor | **Decided: required.** Two-step sign-in set up on production, `OWNER_MFA_REQUIRED=true` set for Production, recovery codes stored offline. (The code also requires it automatically once live checkout is on.) | 👤 + 🔧 `tests/owner/*` |
| C-9 | Live smoke test | One real low-value purchase, confirmation + shipping emails received, refunded from the owner page, refund recorded once | 👤 |
| C-10 | Deploy-preview sandbox run | Every check V-1 … V-25 in `docs/PREVIEW-VERIFICATION-PLAN.md` recorded as PASS on PR #15's deploy preview, sandbox keys only | 👤 results on PR #15 (status: **not run** — `PREVIEW-VERIFICATION-RESULTS.md`) |
| C-11 | Shipping rates verified | The `funksquish` origin has a verified rule from real packed weights and carrier costs; every supplier origin has a signed agreement, a verified rate card and a committed processing time (`docs/MIXED-ORDER-SHIPPING.md` §3). Until then the code refuses those items | 👤 + 🔧 `tests/shipping/*` |
| C-12 | CI required | Branch protection on `main` requires the CI check and a pull request | 👤 GitHub setting |

## F. FunkSquish can begin fulfilling orders

| # | Gate | Pass when | How to verify |
| --- | --- | --- | --- |
| F-1 | Ship-by discipline | Owner checks the orders list every business day; nothing shows "ship-by passed" without a delay notice or refund | 👤 |
| F-2 | Supplier agreement | Each supplier who ships to customers has a signed agreement covering: processing time, rate card, tracking, APO/FPO capability, safety documents per SKU, recall cooperation, returns/defects, and **use of customer data only to fulfill and support our orders** (Privacy Policy) | 👤⚖️ (code: `agreementOnFile` required) |
| F-3 | Supplier-shipped items | No supplier-shipped product is sold until F-2 passes and its origin is entered with verified rates; its product-page processing time is never faster than the supplier's commitment | 🔧 checkout refuses otherwise |
| F-4 | Packaging & returns | Return address; photo-on-arrival routine; label-voiding routine for cancellations. **Returns that don't qualify (owner decision): email explaining why and offering return at the buyer's cost, item kept safe, never disposed of because time passed, unclaimed items handled as the attorney advises (Q-RET-2), items tied to disputes/chargebacks/legal claims kept** | 👤⚖️ |
| F-5 | Recall readiness | Recall/Section 15(b) runbook (`MASTER` §7.5) read; order records retained long enough to contact buyers | 👤 |
| F-6 | Territory/oversold SLA | Orders flagged territory/oversold refunded within 1 business day | 👤 |
| F-7 | Mixed-order shipping | **Decided: mixed orders allowed** (cart-dependent, per-package, built in #16). Passes when C-11 passes and preview checks V-13 … V-16 pass | 👤 + 🔧 |
| F-8 | Shared inventory | Starting counts on production; the owner records TikTok sales as they happen and follows the LIVE routine; "Stock to check" on Today reviewed each business day | 👤 (`docs/INVENTORY.md`) |
| F-9 | Signature confirmation | Advisory only ($150 owner recommendation) until carrier service and price are verified; never charged to customers or advertised without a policy change (**D-OPS-2b**) | 👤 |

## O. Ongoing operations (monthly)

| # | Check | Pass when |
| --- | --- | --- |
| O-1 | Partner retention | Last run green; overdue deletion requests = 0 |
| O-2 | Privacy requests | All answered within 30 days, logged |
| O-3 | Recalls | cpsc.gov/Recalls searched for every listed product type |
| O-4 | Email health | Brevo key valid; failed order emails = 0 or retried |
| O-5 | Policy drift | `npm test` green on `main`; any policy edit bumps `src/content/policies.ts` |
