/**
 * Which pages search engines may index. One list so the sitemap, page
 * metadata and tests can't drift apart (tests/seo/indexing.test.ts checks
 * every page against it).
 *
 * Rules:
 *  - Indexable pages are in the sitemap, set a canonical via pageMetadata()
 *    and never set noindex.
 *  - Noindex pages stay crawlable (robots.txt must NOT block them, or Google
 *    can't see the noindex and may index the bare URL anyway) and are never in
 *    the sitemap.
 */
export const CANONICAL_ORIGIN = "https://funksquish.com";

/** The Netlify subdomain that serves the same production site. It redirects to the canonical origin. */
export const NETLIFY_PRODUCTION_HOST = "ephemeral-syrniki-2b3f3c.netlify.app";

export const INDEXABLE_PATHS = [
  "",
  "/shop",
  "/squish-lab",
  "/quiz",
  "/squish-box",
  "/drops",
  "/partners",
  "/our-story",
  "/tiktok-live",
  "/faq",
  "/contact",
  "/order-help",
  "/product-care",
  "/shipping",
  "/returns",
] as const;

/** Deliberately excluded, with the reason. Product pages are handled per product (preview samples are noindex). */
export const NOINDEX_PATHS: Record<string, string> = {
  "/privacy": "Draft policy awaiting legal review",
  "/terms": "Draft policy awaiting legal review",
  "/wishlist": "Personal list stored in the visitor's browser",
  "/newsletter/confirmed": "Confirmation page after an email link",
  "/drops/confirmed": "Confirmation page after an email link",
  "/partners/review": "Private owner area (sign-in required)",
  "/partners/review/[id]": "Private owner area (sign-in required)",
  "/partners/review/requests": "Private owner area (sign-in required)",
  "/partners/review/orders": "Private owner area: orders (sign-in required)",
  "/partners/review/orders/[session]": "Private owner area: one order (sign-in required)",
  "/partners/review/today": "Private owner area: today's to-do list (sign-in required)",
  "/partners/review/inventory": "Private owner area: inventory (sign-in required)",
  "/partners/review/inventory/live": "Private owner area: TikTok LIVE stock (sign-in required)",
  "/partners/review/inventory/activity": "Private owner area: stock activity log (sign-in required)",
  "/checkout/test": "Stripe test-mode harness (404 unless test checkout is on; never on production)",
  "/checkout/test-result": "Stripe test-mode result page (404 unless test checkout is on)",
  "/checkout/complete": "Order confirmation (404 unless live checkout is approved and switched on)",
};
