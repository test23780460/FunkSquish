import Script from "next/script";
import { analyticsActive } from "@/lib/integrations/status";
import { UMAMI_BEFORE_SEND_NAME, UMAMI_BEFORE_SEND_SCRIPT } from "./before-send";

/**
 * Privacy-friendly analytics (Umami Cloud). Cookieless and no personal data.
 * Loads ONLY on the Netlify production build with NEXT_PUBLIC_UMAMI_WEBSITE_ID
 * set — never in local development or deploy previews — and even then only
 * records visits on the production domains. Browsers sending Do Not Track
 * aren't counted.
 *
 * Before anything is sent, `before-send.ts` drops private owner and checkout
 * pages and strips URL parameters other than campaign tags (utm_*), so typed
 * text such as a shared Squish Box name never reaches Umami.
 *
 * Measures: page views, referrers (incl. TikTok), UTM campaigns, and the
 * custom events listed in the Privacy Policy (tests/legal/policy-facts.test.ts
 * keeps the two in sync).
 */
export function Analytics() {
  const websiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
  if (!websiteId || !analyticsActive()) return null;
  return (
    <>
      {/* Must exist on window before the tracker loads (Umami docs). This component is rendered only by the
          root layout, which is where the App Router docs say beforeInteractive belongs (the lint rule predates it). */}
      {/* eslint-disable-next-line @next/next/no-before-interactive-script-outside-document */}
      <Script id="umami-before-send" strategy="beforeInteractive">
        {UMAMI_BEFORE_SEND_SCRIPT}
      </Script>
      <Script
        src="https://cloud.umami.is/script.js"
        data-website-id={websiteId}
        data-domains="funksquish.com,www.funksquish.com"
        data-do-not-track="true"
        data-before-send={UMAMI_BEFORE_SEND_NAME}
        strategy="afterInteractive"
      />
    </>
  );
}
