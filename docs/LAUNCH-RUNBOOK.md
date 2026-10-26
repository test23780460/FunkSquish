# Launch runbook — switching features on safely

All switches live in `src/lib/features.ts` and are **off**. Turn them on one at a time, each on its own branch, tested on a Netlify Deploy Preview before merging to `main`.

| Switch | Turns on | Prerequisites |
| --- | --- | --- |
| `NEXT_PUBLIC_UMAMI_WEBSITE_ID` (env) | Analytics | Umami account; privacy policy analytics section finalized |
| `newsletter: true` + Brevo env vars | Launch email sign-up | `docs/NEWSLETTER.md`; privacy policy newsletter section finalized |
| `DROP_ALERTS_ENABLED` + drops list env vars | Drop & restock email alerts | Separate Brevo list + template (`docs/NEWSLETTER.md`); tested on a preview |
| `PARTNER_APPLICATIONS_ENABLED` + partner env vars | Partner/distributor application form + private review | `docs/PARTNERS.md`; Blobs + notification tested on a preview; retention approved |
| Real products `published` | Real catalog replaces samples | `npm run catalog:check` passes with no blockers |
| `commerce: true` + `checkoutMode: "external-links"` | "Buy now" links to TikTok Shop | TikTok Shop approved; listing URLs in catalog; policies final |
| `commerce: true` + `checkoutMode: "hosted-checkout"` | Cart + Shopify checkout | Shopify store, Storefront token in env; test-mode order succeeded |

## Before taking the first real order

1. **Policies final:** remove the draft banners from Privacy, Terms, Shipping, and Returns only after every `[Owner decision]` / `[bracketed]` item is resolved and reviewed.
2. **Catalog:** every published product has photos, age grading, warnings exactly as labeled, price, weight, tracked inventory, and verified CPC/test report/tracking label (`npm run catalog:check`).
3. **FAQ:** update answers marked "Coming soon" (`src/content/faq.ts`).
4. **Test purchase on the Deploy Preview** (provider test mode): add to cart / buy link → checkout → confirmation email → refund the test.
5. **Mobile check:** iPhone Safari and Android Chrome, including the TikTok in-app browser.
6. Merge to `main`, then repeat one real low-value purchase on production and refund it.

## If something goes wrong after launch

- Turn the switch back off (`commerce: false`), push to `main` — the site returns to "Coming soon" states.
- Or roll back in Netlify → Deploys → previous deploy → Publish deploy.
