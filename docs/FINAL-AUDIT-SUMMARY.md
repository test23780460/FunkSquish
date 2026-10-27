# Final audit summary — FunkSquish legal & compliance audit (2026-10-27)

**Bottom line:** the policies are substantially more accurate, consistent and backed by working code, but **FunkSquish
is not ready to take payments, open partner applications or run email lists.** Of nine high-severity (P1) findings,
six are fixed or partly fixed on draft branches and three remain open (children's-privacy classification, a second
factor for the owner area, and sales-tax setup); several fixes still need owner approval or an attorney's answer. Nothing was merged, deployed or switched on, and no
policy is claimed to be legally compliant or approved.

Not legal advice. Full detail: `MASTER-LEGAL-AUDIT.md`.

## Findings by severity

| Severity | Count | Fixed / partial | Open | Info |
| --- | --- | --- | --- | --- |
| P0 — critical | 0 | 0 | 0 | 0 |
| P1 — high | 9 | 6 | 3 | 0 |
| P2 — medium | 57 | 44 | 13 | 0 |
| P3 — low | 11 | 7 | 3 | 1 |
| **Total** | **77** | **57** | **19** | **1** |

Plus **83 adversarial scenarios** (`ADVERSARIAL-SCENARIOS.md`).

## Branches and commits

| Branch | Base | Commits | Status |
| --- | --- | --- | --- |
| `claude/upbeat-hawking-aonyc6` (legal audit, child of PR #11) | `legal/policy-accuracy` @ `95a8f22` | Audit commits: policies + code + tests; analytics loader fix; second-pass fixes; documents; review flags | **Draft PR #13** → `legal/policy-accuracy` |
| `claude/upbeat-hawking-aonyc6-checkout` (child of PR #12) | `feature/stripe-live-readiness` @ `5dba5f2` | Checkout compliance fixes; deploy-preview verification plan | **Draft PR #14** → `feature/stripe-live-readiness` |

The two PRs are deliberately separate: #13 holds policy wording and site code, #14 holds checkout code. Neither is merged,
and neither has a Netlify deploy preview (Netlify builds previews only for PRs into `main` here) or CI (the repository has
no GitHub Actions); all results below come from manual runs in this session.

PR #5 needs no separate change: PR #12 contains it, and the checkout branch builds on PR #12.

## What changed (committed)

**Policies (legal branch)** — Privacy and Terms rewritten (still Draft + noindex); Shipping and Returns clarified
(owner approval needed — see below); Order help, FAQ, Product care, partner notice, drop-alert form and product-page copy
corrected. Every wording change: `POLICY-COMPARISON.md`.

**Code (legal branch)**
- Analytics: one inline loader defines a before-send hook and then loads Umami — strips URL parameters except `utm_*`,
  drops owner/checkout pages and private referrers; website id validated; values escaped.
- Product pages: label warnings, "Final sale once opened" and processing time shown **above the buy button**; product
  cards and the mobile sticky bar don't offer direct purchase when a disclosure is needed (16 CFR 1500.20).
- Catalog: `final_sale_once_opened`, `processing_business_days`, `private_compare_at_basis` columns; `catalog:check`
  blocks undisclosed mystery items and unevidenced "was" prices.
- Partner deletion requests can't delete applications under legal hold (bug fix).
- `src/content/policies.ts`: one source of policy versions/dates.

**Code (checkout branch)** — refund double-count race fixed; ship-by dates (Eastern Time, federal holidays);
owner "needs attention" list; FTC delay-notice emails with recorded consent type; card-dispute records with deadlines;
policy versions stored on sessions/orders; Terms notice above Stripe's Pay button; order emails aligned with the
policies. Live-payment locks untouched.

## Tests executed (all on 2026-10-27, this sandbox)

| Check | Legal branch | Checkout branch | Combined (trial merge) |
| --- | --- | --- | --- |
| `npm test` | **185/185 pass** (baseline 118) | **249/249 pass** (baseline 228) | **323/323 pass** |
| `npm run lint` | 0 errors (1 pre-existing warning) | 0 errors (same warning) | — |
| `npm run typecheck` | pass | pass | pass |
| `npm run build` | pass | pass | pass |
| `npm run seo:check` (local server) | 90 checks, all good | not run | — |
| Browser: 13 pages × desktop/mobile, axe-core | all pass, no serious/critical issues | not run | — |
| Browser: analytics scrubbing (production-context build) | pass (after fixing PV-04) | — | — |
| Secret scan (regex) | no secrets | no secrets (test fixtures only) | — |
| `npm audit --omit=dev` | 0 vulnerabilities | 0 vulnerabilities | — |

Re-run on the latest commits on 2026-10-27 after opening PR #14 (see the table above — same results).

**Not executed:** real payments, real email sends, Netlify deploy previews (including the refund/delay/dispute run in
`PREVIEW-VERIFICATION-PLAN.md`), TikTok in-app browser, screen-reader testing,
anything against live Stripe/Brevo/Netlify accounts. Direct fetching of legal sources was blocked in this sandbox; sources
were verified via search retrieval of the official pages (see `MASTER-LEGAL-AUDIT.md` §1–2).

## Issues fixed (highlights)

- Restored the owner-approved refund clock that PR #11 had changed (R7).
- Removed every hard 7-day damage cutoff (Shipping, FAQ, checkout email) that contradicted Returns.
- Shipping delays now follow the FTC Mail Order Rule step by step, and the checkout branch gives the owner the tools.
- Children's-product warnings can no longer be hidden below a buy button.
- A typed Squish Box name (possibly a child's) and Stripe session ids can't reach analytics — verified in a browser.
- Partner notice no longer promises absolute confidentiality, unconditional deletion, or that emails aren't stored.
- Legal holds now actually stop deletion.
- Refunds can't be double-counted; chargebacks are recorded with their deadline.
- Contradictions introduced by the first rewrite (entire-agreement clause, lost/undeliverable overlap) caught and removed
  in the second pass.

## Issues remaining (open)

P1: COPPA classification (L-04) · assent method / checkbox (L-05, partial) · owner-area MFA (T-07) · sales tax setup
(B-02). P2: order retention + deletion (PV-13/T-08) · supplier data-use contract (PV-14) · newsletter age wording
(PV-16) · CI pipeline (T-10) · local-only catalog gate (T-09, partial) · stock sync with TikTok Shop (T-14) · Stripe Link
(T-17) · checkout rate limits (T-19) · product liability insurance (PS-04) · manufacturer status (PS-05) · assumed name
(B-01) · retention schedule (B-03) · reviews readiness (M-02). P3: CSP/HSTS (T-12) · provider data regions (PV-15) ·
Prop 65 (PS-06). Full list: `MASTER-LEGAL-AUDIT.md` §4.

## Legal questions unresolved

Priority 1: **Q-COPPA-1, Q-TERMS-1, Q-WAR-1, Q-TAX-1, Q-RET-1, Q-SAFE-1, Q-SAFE-2**. Priority 2: Q-PRIV-1, Q-PRIV-2,
Q-PRIV-3, Q-BREACH-1, Q-FTC-1, Q-PROMO-1, Q-INS-1, Q-ENT-1. Priority 3: Q-TAX-2, Q-ARB-1, Q-AGE-1, Q-P65-1, Q-ADA-1,
Q-MKT-1. Hand-off document: `LEGAL-OPEN-QUESTIONS.md`.

## Production readiness

| Feature | Ready? | Blocking gates (`COMPLIANCE-LAUNCH-GATES.md`) |
| --- | --- | --- |
| Current pre-launch site | Yes — unchanged behavior; drafts stay noindex | — |
| Partner applications | **No** | G-4/G-5 (legal + owner approval), PA-1, PA-5 |
| Launch list / drop alerts | **No** | M-2 (COPPA decision), G-4 |
| Purchasable listings | **No** | No real products; P-1…P-9 |
| Stripe live payments | **No** | C-1…C-10 (policies, tax, checkout branch merged, webhooks, MFA decision, deploy-preview sandbox run, smoke test) |
| Fulfilment | **No** | F-1…F-7 (supplier agreements, recall readiness, mixed-order shipping decision) |

## What the owner must decide or approve

1. **Shipping Policy clarifications** (live once merged): Washington, D.C. added; one shipping charge per order;
   "within 2 business days" defined (end of 2nd business day, Eastern Time); FTC-style delay process; lost-in-transit
   remedy; free reship for our/carrier mistakes; undeliverable refunds within 5 business days; late "delivered but
   missing" reports keep legal rights.
2. **Returns Policy clarifications** (live once merged): sales tax refunded with change-of-mind refunds; damage claims
   "usually" reviewed within 2 business days; replacement unavailable → refund; non-conforming returns sent back or
   disposed after 30 days; "shipped" defined; restored R7 refund clock.
3. **Partner notice:** qualified confidentiality and the legal-exception wording on deletion.
4. **Privacy:** 30-day response target; recall/safety emails to buyers; supplier data-use commitment (requires contracts).
5. **Terms:** pricing-error choice bounded by the ship-by date; per-customer drop limits with full refunds of excess.
6. **Operational decisions:** D-OPS-1 turn Stripe Link off (or disclose it) · D-OPS-2 order value above which to buy
   signature confirmation · D-OPS-3 build MFA (P-SEC-1) or accept the risk in writing · D-OPS-4 TikTok Shop stock
   allocation/sync · D-OPS-5 order retention period after the accountant answers Q-RET-1.
7. **Explicit review items** (`OWNER-REVIEW-FLAGS.md`):
   - **D-SHIP-1** — how mixed carts pay for two shipments (recommended: launch with our own stock only).
   - **D-RET-1** — keep, lengthen or drop the 30-day disposal of nonconforming returns (recommended: keep with two
     emails and no disposal during a dispute; attorney Q-RET-2).
   - **D-SEC-1** — require MFA for the owner area before real customer data (recommended) or accept the risk in writing.
   - **D-QA-1** — how to get a deploy preview for the sandbox run of refunds, delays and disputes, and who runs it.

## Monitoring

No continuous monitoring is configured for these PRs, CI or deployments: no GitHub Actions, no Netlify builds for the
stacked PRs, and no scheduled check or PR subscription from this session. New comments or failures will only be seen when
someone looks or asks for another review.

After approval: set `src/content/policies.ts` dates to the merge date, and keep Privacy/Terms in Draft until the attorney
has answered the Priority 1 questions.
