# Launch readiness — after Phase 2 (2026-10-27)

**Not ready to launch, by design.** Everything the owner approved in Phase 2 is built and tested in draft PRs, but real
sales still need verified shipping rates, legal and tax answers, owner account settings, and a passing sandbox run on
the preview. Purchasing, partner applications and email sign-ups stay off; no production setting or secret changed.

## Pull requests (all draft, none merged)

| PR | Branch → base | What | Tests (branch) |
| --- | --- | --- | --- |
| #13 | `claude/upbeat-hawking-aonyc6` → `legal/policy-accuracy` (#11) | Legal & compliance audit (Phase 1) | 185 |
| **#19** | `claude/upbeat-hawking-aonyc6-policies` → #13 | Phase 2 policy directions | 199 |
| #14 | `claude/upbeat-hawking-aonyc6-checkout` → `feature/stripe-live-readiness` (#12) | Checkout compliance fixes | 249 |
| **#16** | `claude/upbeat-hawking-aonyc6-shipping` → #14 | Mixed-order shipping + checkout abuse limits | 341 |
| **#17** | `claude/upbeat-hawking-aonyc6-inventory` → #16 | Shared manual inventory + Today dashboard + live stock labels + CSV export | 401 |
| **#18** | `claude/upbeat-hawking-aonyc6-mfa` → #17 | Owner two-step sign-in, required before orders or partner applications; preview results | 442 |
| **#21** | `claude/upbeat-hawking-aonyc6-shipping-lock` → #18 | **Proposal** (D-SHIP-3): verified, owner-approved shipping rates replace the obsolete Stripe rate-ID lock; sandbox checklist | 452 |
| **#20** | `claude/upbeat-hawking-aonyc6-ci` → `main` | GitHub Actions CI (+ guards for the two-step gates and shipping lock) | 111 (main's tests) |
| **#15** | `claude/upbeat-hawking-aonyc6-preview` → `main` | **DO NOT MERGE** — everything combined, for the Netlify preview + CI | 456 (passed on GitHub) |

Every branch: lint 0 errors (one old warning), typecheck and production build pass; secret scan clean; `npm audit` 0
vulnerabilities on the combined code.

## Owner decisions → status

| Decision | Status |
| --- | --- |
| Manual TikTok inventory, one shared stock | ✅ Built (#17). Can't make overselling impossible — said on the page. |
| Mixed-order shipping at launch | ✅ Built (#16). Blocked for real products until verified rates exist (C-11). |
| MFA before real orders | ✅ Built (#18). Set it up on production + `OWNER_MFA_REQUIRED=true` (C-8). |
| MFA before partner applications (follow-up) | ✅ Built (#18): required once switched on; form issues no token and stores nothing until it's set up. |
| Quote/checkout abuse limits (follow-up) | ✅ Built (#16): per-network limits, real shoppers tested; keyed hashes deleted after 2 days (proposed Privacy sentence, #19). |
| Live stock labels (follow-up, was INV-F1) | ✅ Built (#17): every stock label reads the shared count; paused/unreadable → "Unavailable"; nothing changes while selling is off. |
| Low-stock warning 5, $150 advisory (follow-up) | ✅ Owner low warning now fires at 5 (was 3) — the public "Only a few left" label stays at 3; signature stays advisory (pinned by tests). |
| Stock history export, no auto-deletion (follow-up) | ✅ Owner-only CSV (#17); no deletion until Q-RET-1 is answered (test-guarded). |
| No automatic disposal of returns | ✅ Policy text (#19); Returns kept Draft for legal review (Q-RET-2). |
| Shipping decisions 1–10 | ✅ Policy text (#19) + code (#14, #16). Wording sign-off needed. |
| Privacy / partner directions | ✅ (#19; partner notice already matched). Order retention still open. |
| Terms directions | ✅ (#19), still Draft. |
| Cards only, Link off | ✅ Code tested (cards-only session). Link off is your Stripe setting (V-25). |
| $150 signature threshold | ✅ Advisory on the owner order page only; not charged or advertised. |
| Deploy preview + CI | ✅ PR #15 built on Netlify; CI passed on GitHub. ❌ Sandbox run on the preview not done (blocked here). |

## What still blocks launch

1. **Verified shipping rates** for our own stock and each supplier; supplier agreements (C-11, F-2, F-3).
2. **Sandbox run on the preview** — V-1 … V-25 (C-10). Needs the preview variables, sandbox key with Refunds, webhook,
   and you running it (`docs/PREVIEW-VERIFICATION-RESULTS.md`).
3. **Legal/tax:** COPPA classification (Q-COPPA-1), assent method (Q-TERMS-1), warranties (Q-WAR-1), Kentucky sales tax
   + Stripe Tax (Q-TAX-1), record retention (Q-RET-1), manufacturer status and online warnings (Q-SAFE-1/2), unclaimed
   returns (Q-RET-2), partial-refund tax (Q-TAX-3); Privacy, Terms and Returns approved after review (G-4).
4. **Owner settings:** Link off; two-step sign-in on production and on Stripe/Netlify/Google/GitHub/Brevo/TikTok; GitHub
   secret scanning, push protection, Dependabot, branch protection (`docs/OWNER-ACTIONS.md`).
5. **Real products:** catalog with safety documents (P-1 … P-9), starting stock counts (P-6, F-8).
6. **Merge in order** (CI first), then a separate reviewed launch PR (G-9).
7. Still open from Phase 1: product liability insurance, assumed-name filing, order backups/export, CSP/HSTS headers.
   (Checkout rate limiting is done in #16.)

## New owner decisions needed

| # | Decision | Recommendation |
| --- | --- | --- |
| D-SHIP-2 | Our own shipping rule (weight tiers or flat per item) and amounts | Weight tiers that cover your costliest zone |
| D-SHIP-3 | Replace the obsolete `STRIPE_*_SHIPPING_RATE_IDS` lock | **Proposal ready: #21** — verified rates + your approval code (`STRIPE_LIVE_SHIPPING_TABLE`); stricter than before. Accept by merging #21, or skip it to keep the old lock |
| D-SHIP-4 | Sign off the exact Shipping Policy wording (#19) | Review `docs/POLICY-COMPARISON.md` Phase 2 rows |
| D-OPS-2b | Enforce/advertise signature confirmation over $150? | Keep advisory until priced |
| D-INV-1 | Owner low-stock warnings | ✅ Decided: 5 units (both warnings) |
| D-INV-2 | How long to keep stock history | CSV export built; **keep everything** until the accountant/attorney confirms the period (Q-RET-1), then decide |
| D-INV-3 | Public "Only a few left" label threshold (now from live shared stock) | Keep at 3 (unchanged); attorney view in Q-INV-1 |
| D-PRIV-3 | Proposed Privacy edits (abuse-limit codes; MFA before partner applications) | Approve the three rows in `docs/POLICY-COMPARISON.md` ("Follow-up proposals") |
| D-QA-2 | Who runs the preview checks, and when | You, on your phone + laptop, before merging #16–#18 |
| D-OPS-5 | Order-record retention period | After the accountant answers Q-RET-1 |
