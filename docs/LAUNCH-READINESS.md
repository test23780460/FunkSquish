> **Historical document (kept for the record).** Current guidance: `docs/OWNER-GUIDE.md` and `docs/LAUNCH-CHECKLIST.md` — see `docs/README.md`.

# Launch readiness audit — 2026-10-26

Seen as a first-time customer, supplier and future distributor. Supplier pricing and contacts are in the private
evaluation (`private/suppliers/`), never here.

| Area | Status | Notes |
| --- | --- | --- |
| Brand & homepage | ✅ Ready | One consistent look across all four upgrades; "coming soon / nothing for sale yet" stated in the hero and on every preview product. |
| Navigation & discovery | ✅ Ready | Header: Shop, Squish Lab, New Drops, TikTok LIVE, Our Story. The mobile menu and footer add the quiz, Squish Box, wishlist, FAQ and partners. No broken internal links (automated crawl). |
| Mobile | ✅ Ready | 23 pages checked at 375, 768 and 1280 px: no sideways scrolling, one H1 per page, no serious/critical axe-core issues, no console errors. Quiz, Squish Box, wishlist, Squish Lab, Drops and LIVE flows checked at 375 px. |
| Partner workflow | ⚠ Built, form OFF in production | Review area, retention cleanup and deletion requests verified on a preview. The public form stays closed (email fallback) until legal review — run `npm run partners:readiness` before switching it on. |
| Contact & support | ✅ Ready | Email and TikTok on /contact; mailing address on policies; order-help page. No contact form (by design — email only). |
| Shipping & returns | ✅ Approved and live | Owner-approved 2026-10-24; indexable. |
| Legal notices | ⛔ Blocked — legal review | Privacy policy and Terms are drafts (noindex, marked Draft). Needed before taking orders, newsletter/drop-alert sign-ups or partner applications. |
| Product safety disclosures | ⚠ Waiting on products | Product-care page live. Real products need age grade, warnings, materials and CPC/lab reports from the supplier before listing. |
| Checkout safeguards | ✅ Purchasing off | `commerce: false`, `checkoutMode: "disabled"`; Stripe stays test-mode in unmerged PR #5. Squish Box ordering shows "isn't open yet". |
| Product information | ⛔ Blocked — no inventory | Only illustrated previews (noindex, no prices or stock in structured data). Real listings need samples, photos, weights and safety documents. |
| Email deliverability | ✅ Authenticated | Google Workspace SPF + DKIM; Brevo domain code + DKIM (brevo1/brevo2) published; DMARC `p=none` (monitoring). Consider moving to `p=quarantine` after a few weeks of clean reports (DNS change — owner approval). |
| Monitoring | ⚠ Basic | Umami analytics; Netlify function logs; retention run status in the review area plus an alert email on failure. No uptime monitor (a free one is optional). |
| SEO | ✅ Fixed in code | See `docs/SEO.md`. Search Console validation/indexing requests to be submitted after the production deploy. |

## External dependencies (not website work)

- Legal review of privacy policy, terms and the partner notice (B6).
- Business registration, state resale certificate and sales-tax registration — some U.S. distributors require them before a first order.
- Product liability insurance (recommended before selling children's products).
- Supplier verification and exact-model CPCs and lab reports before any product goes on sale.
- Checkout provider decision and live Stripe activation (owner only; not part of this project).

## Deploy note (2026-10-26)

The first production build after merging reused a stale stylesheet from Netlify's build cache: the CSS added by the
upgrades (phone-width fieldset fix, Squish Lab/Box animations) was missing, so `/squish-lab` rendered 792px wide on
phones. A **"Clear cache and deploy"** rebuild fixed it (same commit). If a deploy ever looks unstyled or wider than the
screen while a local `npm run build` looks right, compare the CSS file names and rebuild with the cache cleared.
