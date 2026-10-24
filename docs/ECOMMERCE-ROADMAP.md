# Ecommerce roadmap & platform decision

_Updated for approved B4 test-mode decision: October 24, 2026. Last pricing review: October 23, 2026. Prices change — re-check each vendor's pricing page before you sign up. Nothing has been purchased or subscribed to._

## Recommendation (short version)

1. **Launch on TikTok Shop first** (no monthly fee). Your customers are on TikTok, TikTok Shop runs the checkout, collects payment, provides shipping labels, and — as a marketplace — generally collects sales tax on those sales. The website stays your brand home and links each product to its TikTok Shop listing (`checkoutMode: "external-links"`).
2. **Add Shopify Basic later**, when website sales or multi-channel inventory justify ~$29–39/month. Shopify becomes the single source of inventory for both the website (hosted checkout) and TikTok Shop (via Shopify's TikTok channel), which prevents overselling.
3. **Stripe Checkout / Payment Links** is a fine low-cost fallback for a handful of website-only products, but you'd manage inventory, order tracking and TikTok sync by hand — easy to oversell across channels.

Whatever you choose, **no product can be sold until it has its safety paperwork** (see `docs/COMPLIANCE.md`). TikTok Shop will not approve toy listings without it.

## Comparison

| | TikTok Shop (native) | Shopify Basic (+ headless site) | Stripe Checkout + manual ops |
| --- | --- | --- | --- |
| Monthly cost | $0 | ~$39/mo monthly, ~$29/mo annual ([Shopify pricing guides, 2026](https://www.stylefactoryproductions.com/blog/shopify-fees)) | $0 |
| Per-sale cost | Referral fee ~6% of item price (some 2026 sources report 8% from Aug 2026 — **verify in Seller Center**) ([fee guide](https://feescal.com/blog/tiktok-shop-seller-fees-2026)) | Card processing (Shopify Payments) | ~2.9% + 30¢ card processing (standard Stripe US rate — verify) |
| Hosted, secure checkout | ✅ TikTok | ✅ Shopify | ✅ Stripe |
| Inventory & oversell protection | ✅ (TikTok only) | ✅ one inventory for site + TikTok | ❌ manual |
| Orders, labels, tracking | ✅ | ✅ (Shopify Shipping) | ❌ separate tool (e.g. Pirate Ship) |
| Sales tax | Marketplace generally collects | Shopify Tax | Stripe Tax (extra fee) or manual |
| Discount codes | ✅ TikTok promotions | ✅ | ✅ (coupons) |
| Works with this Next.js + Netlify site | Link out (already built) | Hosted checkout via Storefront API (already built, disabled) | Would need a small adapter |
| Effort to run | Lowest | Low | Highest |

**Shopify Starter ($5/mo)** is designed for selling through links and social. Community reports say its plan model does not include the Headless channel / Storefront API that this site's cart integration uses — confirm with Shopify before relying on it ([community thread](https://community.shopify.com/t/starter-plan-as-headless-cms/579455)). Basic is the lowest plan we'd plan around for website checkout.

## What's already built

| Piece | Where | State |
| --- | --- | --- |
| Product model (SKU, variants, price, compare-at, stock, weight, dimensions, media, specs, safety) | `src/commerce/types.ts` | Ready |
| Private data split (cost, supplier, invoices, compliance) | `private/` + `scripts/` (git-ignored) | Ready |
| CSV import/export + launch gate | `npm run catalog:import / export / check` | Ready — see `docs/CATALOG.md` |
| Availability rules (never claims stock unless sellable and tracked) | `src/commerce/availability.ts` | Ready |
| Checkout provider interface + Stripe test-only adapter | `src/commerce/provider.ts`, `providers/stripe-test-checkout.ts` | Prepared, **disabled**; legacy Shopify file retained but not selected |
| Server-side checkout action (re-validates every line) | `src/app/actions/checkout.ts` | Built, **disabled** |
| Cart drawer + header cart button | `src/components/cart/Cart.tsx` | Built, **not rendered** |
| "Buy on TikTok Shop" links per variant | `PurchaseButton` + `externalPurchaseUrl` column | Built, **disabled** |
| Shipping configuration (packages, weights, carriers) | `src/commerce/shipping.ts` | Prepared, all decisions `null` |

The site never handles card numbers. Purchases only ever happen on the provider's own checkout page.

## Switching on — Option A: TikTok Shop links

1. Get TikTok Shop seller approval and toy category qualification (CPC, invoice, tracking-label photos — `docs/COMPLIANCE.md`).
2. List each product on TikTok Shop; copy each listing URL into the `external_purchase_url` column of your catalog sheet.
3. `npm run catalog:import` → `npm run catalog:check` (must pass with no blockers).
4. In `src/lib/features.ts` set `commerce: true` and `checkoutMode: "external-links"`.
5. Push to a branch, test the Netlify deploy preview, then merge (see `docs/LAUNCH-RUNBOOK.md`).

## Historical option B (not selected): Shopify hosted checkout

1. Create the Shopify store (Basic or higher), add products with the **same SKUs** as your catalog sheet.
2. Create a Storefront API token (Headless channel or custom app). Add `SHOPIFY_STORE_DOMAIN` and `SHOPIFY_STOREFRONT_TOKEN` in Netlify environment variables (server-only; never `NEXT_PUBLIC_`).
3. Map each variant's `id` to its Shopify ProductVariant GID (a Shopify catalog provider can replace the local JSON — same `CatalogProvider` interface in `src/commerce/catalog.ts`).
4. Set `commerce: true`, `checkoutMode: "hosted-checkout"`. The cart button and drawer appear automatically.
5. Test on a deploy preview with Shopify's test payment mode before merging.

## Still deliberately out of scope

- Customer accounts and rewards programs (no clear benefit yet; Shopify/TikTok handle order lookup).
- A custom admin dashboard — Shopify/TikTok Seller Center already do this securely.
- Any home-built payment or card handling.
