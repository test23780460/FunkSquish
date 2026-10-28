# Owner actions — things only you can do (Stripe, Netlify, GitHub and others)

_2026-10-27. None of these were done for you: no account, setting or secret was changed by this work. Menu names change
over time — if one doesn't match, search the service's settings for the term in **bold**. Never paste keys or codes into
chat, GitHub or email._

## Now (to test the drafts on the combined preview, PR #15)

**Step-by-step version: `docs/SANDBOX-TEST-CHECKLIST.md` (on #21 and the preview).** Corrections in the 2026-10-27
follow-up: the sandbox key also needs **Products: Read, Prices: Read, Shipping Rates: Read** (line items are read with
product details); `STRIPE_TEST_SHIPPING_RATE_IDS` is no longer needed once #21 is in.

| # | Where | Do this |
| --- | --- | --- |
| 1 | **Stripe sandbox** → Developers → API keys | Create (or edit) a **restricted key** with **Checkout Sessions: Write**, **Refunds: Write**, **Products / Prices / Shipping Rates: Read**, nothing else. |
| 2 | **Netlify** → Site configuration → Environment variables (scope: **Deploy Previews only**, mark as secret) | `STRIPE_TEST_CHECKOUT_ENABLED=true`, `STRIPE_TEST_SECRET_KEY` (the key from 1), `STRIPE_TEST_WEBHOOK_SECRET` (from 3), `STRIPE_TEST_SEND_EMAILS=true` (only while testing), owner sign-in variables if the preview doesn't have them. **Never** put these in Production. |
| 3 | **Stripe sandbox** → Developers → **Webhooks** | Endpoint `https://deploy-preview-15--ephemeral-syrniki-2b3f3c.netlify.app/api/stripe/test-webhook` with the 8 events in `docs/PREVIEW-VERIFICATION-PLAN.md` (including `charge.dispute.created/updated/closed`). |
| 4 | **Stripe sandbox** → Settings → **Payment methods** | Turn **Link** off (and leave only Cards; Apple Pay / Google Pay are card wallets). Then run preview check V-25. |
| 5 | **Netlify** → Deploys → PR #15's preview | Retry the deploy once after setting the variables (they apply to new builds). |
| 6 | Your browser + phone | Run V-1 … V-25 (`docs/PREVIEW-VERIFICATION-PLAN.md`), use only your own email addresses, post results on PR #15. Then remove `STRIPE_TEST_SEND_EMAILS`, **close PR #15 without merging** and delete its branch. |
| 7 | (Optional) the cloud environment Claude runs in → Network access | To let a future session test the preview itself, add `netlify.app` (or the preview host) to Allowed domains. |

## Before any real payment

### Stripe (live)
- **Payment methods:** Link off (owner decision: cards and card wallets only). Re-check the live Checkout page shows
  no Link.
- **Tax:** Kentucky sales and use tax permit; add the registration in **Stripe Tax**; then `STRIPE_LIVE_AUTOMATIC_TAX=true`.
- **Keys and webhook (you create them):** restricted live key (**Checkout Sessions: Write**, **Refunds: Write**,
  **Products: Read**, **Prices: Read**); webhook `https://funksquish.com/api/stripe/webhook` with the 8 events.
- **Shipping approval (if you accept #21):** after checking the rates on the owner Orders page, set
  `STRIPE_LIVE_SHIPPING_TABLE` (Production, not secret) to the approval code shown there; `STRIPE_LIVE_SHIPPING_RATE_IDS`
  is then no longer used. (If you decline #21: keep one live `shr_…` id for the old lock.)
- Business verification, payout bank account, statement descriptor, support email/phone.
- **Two-step authentication** on your Stripe login.

### Netlify (Production)
- After setting up two-step sign-in on the production owner area (`docs/OWNER-SECURITY.md`): set
  `OWNER_MFA_REQUIRED=true` for Production.
- `STRIPE_LIVE_*` variables only on launch day, as listed in `docs/STRIPE-PRODUCTION.md`.
- `OWNER_MFA_RESET_ID` only for the lock-out procedure — delete it right after.
- **Two-step verification** on your Netlify login; review who else has access to the team.

### GitHub (this repository)
- Review and merge in stack order — never merge PR #15:
  1. PR #20 (CI) into `main`, then merge `main` into the stack bases so every PR gets checks.
  2. Policy stack: #11 → #13 → #19.
  3. Checkout stack: #5 → #12 → #14 → #16 → #17 → #18 → #21 (#21 is a proposal: skip it to keep the old lock).
  4. Later, a separate **launch PR** that flips `features.commerce` / `checkoutMode` and updates `EXPECTED` in
     `scripts/safeguards-check.mjs`.
- Settings → **Code security**: Secret scanning + **Push protection**, **Dependabot alerts** + security updates.
- Settings → **Branches** (after CI has run once): protect `main` — require a pull request and the CI check, block force
  pushes. Settings → Actions: keep the default **read** permission for workflows.
- **Two-step authentication** on your GitHub account.

### Shipping and suppliers
- Weigh packed products and empty packaging; get carrier costs; enter the verified `funksquish` rule
  (`docs/MIXED-ORDER-SHIPPING.md` §3). Until then, no real product can be checked out.
- For each supplier: signed agreement (processing time, rate card, tracking, APO/FPO, safety documents, recalls,
  returns/defects, customer data used only to fulfill our orders), then their origin entry.
- Decide whether to buy signature confirmation for $150+ orders once you've priced it (never charged to customers).

### Inventory
- On the production inventory page, set the starting count for every product (drafts included), and mark the ones
  listed on TikTok Shop. Practice the LIVE routine once (`docs/INVENTORY.md`).
- Download the stock history (Inventory → Activity → *Download stock history*) for your records as needed. Nothing is
  deleted automatically until the record-keeping period is confirmed (Q-RET-1).

### Owner two-step sign-in — order matters
Set it up on production **while everything is still off**, save the recovery codes, set `OWNER_MFA_REQUIRED=true`,
and only then switch on partner applications or live checkout — both stay closed without it (`docs/OWNER-SECURITY.md`).

### Other accounts — turn on two-step sign-in
Google (business email), Brevo, TikTok Shop / Seller Center. Store owner-area recovery codes offline.

### Attorney and accountant
`docs/LEGAL-OPEN-QUESTIONS.md` — Priority 1 plus the new Q-RET-2 (rewritten), Q-TAX-3, Q-SHIP-2, Q-INV-1, Q-SEC-1.
