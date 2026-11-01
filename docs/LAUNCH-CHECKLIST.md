# FunkSquish launch checklist

Last updated 2026-10-31. Two parts:

- **Part A** is technical readiness: what the code already does, verified by tests and CI.
- **Part B** is what only you, a supplier, an accountant or an attorney can do.

Nothing here has been switched on. Every switch is off in code (`src/lib/features.ts`) and checked by
`scripts/safeguards-check.mjs` on every PR.

## Part A — technical readiness

| Area | State | Evidence |
| --- | --- | --- |
| Storefront (preview → real products → live wording) | Built | PR #25; `src/content/launch.ts`; catalog-aware copy tests |
| Owner dashboard (10 sections, two-step sign-in, audit log, backups) | Built | PRs A–F of the dashboard stack; `tests/owner/*` |
| Product management, photos, launch checklist, publish/rollback | Built | `tests/products/*` |
| Suppliers, comparison, documents, manual supplier orders | Built | `tests/suppliers/*` |
| Inventory ledger, TikTok CSV reconciliation, restocks, supplier stock | Built | `tests/inventory/*` |
| Orders: search, refunds, cancellations, disputes, replacements, emails | Built | `tests/orders/*`, `tests/audit/*` |
| Mixed-order shipping (one package per origin) | Built | `tests/shipping/*` |
| Shipping draft editor and approval code | Built — **no verified rates entered** | `tests/shipping/shipping-admin.test.ts` |
| Stripe test mode | Built and sandbox-tested (PR #15 V-1…V-25, except V-7 on Nov 4) | PR #15 results comment |
| Stripe live path | Built, locked; needs PR #24 (Disputes: Read check) | `tests/checkout/*` |
| Email sign-ups (DOI, rate limits, honeypot) | Built, off | `tests/actions/*` |
| Drop/restock alert sending | Built, off — **never tried against real Brevo** | `tests/marketing/*` |
| Analytics (orders-based reports; Umami) | Built; Umami totals need an API key | `tests/marketing/campaigns-and-report.test.ts` |
| Security (sign-in on every action, uploads, isolation) | Reviewed | `docs/SECURITY-REVIEW.md`, `tests/owner/unauthenticated.test.ts` |

### Not verified by automated tests (needs a real device or account)

- [ ] Real iPhone Safari and the TikTok in-app browser (only Chromium was available).
- [ ] The dashboard on a Deploy Preview with Netlify Blobs (local tests use the in-memory store).
  - [ ] The runtime catalog's publish-to-website refresh on Netlify.
  - [ ] Media serving through Netlify's image CDN.
- [ ] A TikTok Seller Center order export from your account (column names).
- [ ] Brevo campaign sending (create + sendNow) on your account.
- [ ] Umami API read (only if you add a key).

## Part B — what only you (or your advisers) can do

### You
- [ ] **Two-step sign-in on production first.**
  - Settings → Security, save the recovery codes offline.
  - Then set `OWNER_MFA_REQUIRED=true` for Production.
- [ ] **Netlify Deploy Preview protection back on.**
  - Project configuration → Access & security → Visitor access → Configure.
  - Choose Netlify Team Login, for non-production deploys only.
- [ ] **Two-step authentication on every account:** Stripe, Netlify, GitHub, Google, Brevo, TikTok Shop.
- [ ] **Run PR #15's V-7 check on Nov 4**, post the result, then close PR #15 without merging.
- [ ] **Review and merge in order** (each merge to `main` deploys production; approve each):
  - PR #24 (Stripe key permissions);
  - then the dashboard stack, from the foundation PR to the docs/security PR.
- [ ] **Add Disputes: Read** to the sandbox key now, and to the live key when you create it.
- [ ] **Products:** for each one, in the dashboard:
  - real photos;
  - verified price and cost;
  - age grade and warnings from the label;
  - weights and box size measured.
- [ ] **Shipping:**
  - weigh packed products;
  - get carrier quotes;
  - enter and verify the `funksquish` rates in the Shipping draft;
  - apply it (PR), then set `STRIPE_LIVE_SHIPPING_TABLE`.
- [ ] **Inventory:** set starting counts. Practice one TikTok upload and one LIVE.
- [ ] **Decide the items in `docs/WEBSITE-COMPLETION-REVIEW.md`:**
  - business-name wording;
  - the Shipping Policy's TikTok Shop sentence;
  - the Netlify badge or a paid plan.
- [ ] **Launch copy:** pick from `docs/LAUNCH-COPY.md` once a date is real.
- [ ] **Stripe live:**
  - business verification and payout account;
  - statement descriptor;
  - Link off;
  - restricted live key and webhook (you create them — never paste them in chat or GitHub).

### Suppliers
- [ ] **Signed agreement for each supplier**, covering:
  - processing time, rate card and tracking;
  - APO/FPO support;
  - safety documents, recalls and returns/defects;
  - **customer data used only to fulfill our orders.**
- [ ] **Their compliance documents:** CPC, a third-party test report from a CPSC-accepted lab, and tracking labels.
- [ ] **Written shipping rates** → their origin in the Shipping draft.

### Accountant
- [ ] **Kentucky sales and use tax permit;** register in Stripe Tax, then `STRIPE_LIVE_AUTOMATIC_TAX=true`.
- [ ] **Record-keeping periods** for orders and stock (Q-RET-1/2), and bookkeeping from the sales CSV.
- [ ] **Assumed-name filing confirmed** (or an LLC formed), then the operator wording updated (B-01).

### Attorney
- [ ] **Privacy Policy, Terms and Returns review** (B6), then remove the Draft banners in a reviewed PR.
- [ ] **Data retention (B5)**, and the COPPA decision before any email list opens.
- [ ] **Partner applications:** legal sign-off, then the Production switch.
- [ ] **Analytics wording** if you want add-to-cart/checkout-start events (`docs/OWNER-GUIDE.md` → Analytics).

### Launch day (one reviewed launch PR)
1. **Flip the switches** in `src/lib/features.ts`:
   - `commerce: true`;
   - `checkoutMode: "hosted-checkout"` (or `"external-links"` for TikTok Shop links);
   - and the email switches you approved.
2. **Update `EXPECTED`** in `scripts/safeguards-check.mjs` in the same PR.
3. **Set the Production variables** (`STRIPE_LIVE_*`), redeploy, and confirm **Settings → Integrations** shows every
   live lock open.
4. **Test with a real purchase:** one low-value purchase with your own card, then refund it.
5. **Rollback** if needed: revert the launch PR, or publish the previous deploy in Netlify.
