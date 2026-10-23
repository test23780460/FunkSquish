# Analytics & SEO

## SEO — what's in place

- **Canonical URL on every page** (`pageMetadata()` in `src/lib/seo.ts`). Shop filter URLs (`/shop?category=…`) point to `/shop`.
- **Unique titles and descriptions** per page; shared Open Graph image with the official logo (`src/app/opengraph-image.tsx`).
- **Indexing rules:**
  - Indexed: home, shop, our story, TikTok LIVE, FAQ, contact, order help, product care & safety.
  - `noindex`: illustrated **preview products**, all **draft policies** (privacy, terms, shipping, returns), the newsletter confirmation page, 404.
  - Real products are indexed automatically once `published`.
- **Sitemap** (`/sitemap.xml`) lists indexable pages and published products only. **robots.txt** allows crawling and points to the sitemap.
- **Structured data:** Organization + WebSite on the homepage (name, logo, email, TikTok). Product structured data is generated **only** for published, sellable products with real prices, photos and stock — never for samples. No ratings or reviews are ever emitted.

### Google Search Console

Option A (recommended, no code): verify the **Domain property** with a DNS TXT record — Search Console gives you a `google-site-verification=…` TXT record to add in Squarespace DNS. This is a new record; it does not affect email. Then submit `https://funksquish.com/sitemap.xml`.

Option B: URL-prefix property with the HTML tag — copy only the `content` value into Netlify env var `GOOGLE_SITE_VERIFICATION`, redeploy.

## Analytics — Umami Cloud (free "Hobby" plan)

Prepared, **off** until you add the site ID.

- Cookieless, no personal profiles, no consent banner needed for basic use (still mention it in the privacy policy).
- Free Hobby tier: ~100K events/month, 1 website ([Umami FAQ](https://umami.is/docs/cloud/faq), [summary](https://freetier.co/directory/products/umami)).
- Loaded from Umami's servers → **no Netlify function or bandwidth cost**.
- Only counts visits on `funksquish.com` (deploy previews and localhost are ignored), and respects browser Do Not Track.

What you'll see:

| Question | Where |
| --- | --- |
| Homepage / Shop visits | Pages report (`/`, `/shop`, `/shop/...`) |
| Traffic sources | Referrers report |
| TikTok traffic | Referrers containing `tiktok.com`, plus UTM campaigns (below) |
| TikTok link clicks from the site | Event `tiktok-click` |
| Newsletter conversions | Event `newsletter-signup` (once sign-ups are on) |
| "Buy" clicks to TikTok Shop | Event `buy-external` (once selling is on) |

**Tip:** in-app browsers often hide the referrer. Use a tagged link in your TikTok bio:
`https://funksquish.com/?utm_source=tiktok&utm_medium=social&utm_campaign=bio`

### Setup (owner)

1. Create a free account at umami.is → Add website `funksquish.com`.
2. Copy the **Website ID** (a UUID — it's public by design, not a secret).
3. Netlify → Environment variables → `NEXT_PUBLIC_UMAMI_WEBSITE_ID` = that ID.
4. Update the Privacy Policy analytics section, then deploy.

Cloudflare Web Analytics is a free alternative, but it doesn't support custom events (newsletter conversions).
