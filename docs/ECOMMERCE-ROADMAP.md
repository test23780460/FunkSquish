# Ecommerce roadmap

The pre-launch site is built so real selling can be switched on **without redesigning the UI**. This doc explains where each piece plugs in.

## What's already in place

| Area | Where | Status |
| --- | --- | --- |
| Product / variant / price / inventory types | `src/commerce/types.ts` | Ready |
| Catalog access layer (one function per query) | `src/commerce/catalog.ts` | Uses preview provider |
| Preview sample data | `src/commerce/providers/preview.ts` | Illustrative only — delete at launch |
| Shop grid, search, filter, sort | `src/components/shop/ShopCatalog.tsx` | Working |
| Product card + product page + variant picker | `src/components/shop/*` | Working (purchase disabled) |
| Add-to-cart slot | `src/components/shop/PurchaseButton.tsx` | Always disabled |
| Feature switches | `src/lib/features.ts` | All `false` |
| Email sign-up form | `src/components/home/NewsletterSignup.tsx` | Disabled, collects nothing |
| Sold-out / in-stock / coming-soon states | `ProductStatus` + `statusLabel` | Ready |
| Product photos | `Product.images` (falls back to illustrations) | Ready |

## Recommended stack

**Shopify (headless) for products, inventory, checkout, orders, shipping, discounts and taxes.**

Why it fits FunkSquish:

- Secure, PCI-compliant **hosted checkout** — no homemade payment code.
- Built-in **inventory, order management, shipping rates/labels, order tracking emails, discount codes**.
- Official **TikTok channel** for syncing products to **TikTok Shop**.
- Works with this site through the **Storefront API**, so the custom design stays.

Alternative: **Stripe Checkout** + a small inventory store. Fine for a handful of products, but you'd build order management, shipping and TikTok Shop sync yourself. Shopify is less work for this business.

## Launch steps (Shopify)

1. Create the Shopify store, add real products with photos, variants (colors), prices, and stock.
2. Create a **Storefront API** access token (Shopify admin → Apps → Develop apps / Headless channel).
3. Add environment variables in Vercel (never commit them):
   - `SHOPIFY_STORE_DOMAIN` — e.g. `funksquish.myshopify.com`
   - `SHOPIFY_STOREFRONT_TOKEN`
4. Add `src/commerce/providers/shopify.ts` implementing the same `CatalogProvider` interface used in `catalog.ts` (`listProducts`, `getProduct`) and map Shopify products into the `Product` type:
   - product `status` → `"available"` or `"sold-out"` based on stock
   - variants → `ProductVariant` (`price` in cents, `inventory`, `swatch` from a color option/metafield)
   - images → `Product.images`
5. In `catalog.ts`, switch `provider` to the Shopify provider. Cache product reads with `"use cache"` + `cacheTag("products")` and revalidate via a Shopify webhook route.
6. Cart: add a small cart module (`src/commerce/cart.ts`) using the Storefront API `cartCreate` / `cartLinesAdd` mutations from Server Actions, keep the cart id in a cookie, and send shoppers to the returned `checkoutUrl`.
7. Replace the disabled `<button>` in `PurchaseButton.tsx` with the add-to-cart action. Enable the quantity select in `ProductShowcase.tsx`.
8. Add a cart icon/drawer to `SiteHeader.tsx`.
9. Set `features.commerce = true`.
10. Delete `src/commerce/providers/preview.ts` and the preview notices on `/shop`.
11. Publish real **shipping, returns, and pricing** info: update `src/content/faq.ts` (remove `pending: true`), and finalize `/privacy` and `/terms`.

## Email sign-ups

Pick a real email service (Shopify Email, Klaviyo, Mailchimp, or Buttondown). Then:

1. Add its API key as a Vercel environment variable.
2. Add a Server Action that subscribes the address (with consent wording and an unsubscribe link handled by the provider).
3. Wire it into `NewsletterSignup.tsx` and set `features.newsletter = true`.
4. Update the Privacy Policy to name the provider.

## Customer accounts

Only add if genuinely useful (order history, wishlists). Shopify's **Customer Account API** handles sign-in and order history without storing passwords on this site. Gate it behind `features.accounts`.

## TikTok Shop

With Shopify, install the **TikTok** sales channel to sync products and inventory to TikTok Shop, then link to products from LIVEs. Add LIVE dates to `src/content/live-schedule.ts`.
