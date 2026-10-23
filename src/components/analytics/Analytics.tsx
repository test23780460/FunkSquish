import Script from "next/script";

/**
 * Privacy-friendly analytics (Umami Cloud). Cookieless and no personal data.
 * Loads ONLY when NEXT_PUBLIC_UMAMI_WEBSITE_ID is set, and only records visits
 * on the production domain (deploy previews and localhost are ignored).
 *
 * Measures: page views (home, shop...), referrers (incl. TikTok), UTM campaigns,
 * and custom events: "newsletter-signup", "tiktok-click", "buy-external".
 */
export function Analytics() {
  const websiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
  if (!websiteId) return null;
  return (
    <Script
      src="https://cloud.umami.is/script.js"
      data-website-id={websiteId}
      data-domains="funksquish.com,www.funksquish.com"
      data-do-not-track="true"
      strategy="afterInteractive"
    />
  );
}
