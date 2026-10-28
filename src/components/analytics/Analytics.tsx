import Script from "next/script";
import { analyticsActive } from "@/lib/integrations/status";
import { isUmamiWebsiteId, umamiLoaderScript } from "./before-send";

/**
 * Privacy-friendly analytics (Umami Cloud). Cookieless and no personal data.
 * Loads ONLY on the Netlify production build with NEXT_PUBLIC_UMAMI_WEBSITE_ID
 * set — never in local development or deploy previews — and even then only
 * records visits on the production domains. Browsers sending Do Not Track
 * aren't counted.
 *
 * One inline script defines the before-send hook (before-send.ts) and then
 * inserts the tracker, so the hook always exists first: private owner and
 * checkout pages are dropped and URL parameters other than campaign tags
 * (utm_*) are stripped — typed text such as a shared Squish Box name never
 * reaches Umami.
 *
 * Measures: page views, referrers (incl. TikTok), UTM campaigns, and the
 * custom events listed in the Privacy Policy (tests/legal/policy-facts.test.ts
 * keeps the two in sync).
 */
export function Analytics() {
  const websiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
  if (!isUmamiWebsiteId(websiteId) || !analyticsActive()) return null;
  return (
    <Script id="umami-loader" strategy="afterInteractive">
      {umamiLoaderScript(websiteId)}
    </Script>
  );
}
