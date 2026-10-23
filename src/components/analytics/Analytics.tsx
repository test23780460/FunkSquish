import Script from "next/script";
import { analyticsActive } from "@/lib/integrations/status";

/**
 * Privacy-friendly analytics (Umami Cloud). Cookieless and no personal data.
 * Loads ONLY on the Netlify production build with NEXT_PUBLIC_UMAMI_WEBSITE_ID
 * set — never in local development or deploy previews — and even then only
 * records visits on the production domains.
 *
 * Measures: page views (home, shop...), referrers (incl. TikTok), UTM campaigns,
 * and custom events: "newsletter-signup", "tiktok-click", "buy-external".
 */
export function Analytics() {
  const websiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
  if (!websiteId || !analyticsActive()) return null;
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
