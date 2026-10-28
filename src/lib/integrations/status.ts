import { features } from "@/lib/features";
import { brevoConfigured, dropAlertsConfigured } from "@/lib/newsletter/brevo";
import { partnerSetup } from "@/lib/partners/config";
import { isUmamiWebsiteId } from "@/components/analytics/before-send";

/**
 * Single source of truth for which third-party integrations are ACTIVE in
 * the current build. Used by the features themselves and by the privacy
 * policy, so the policy can never claim a service is (in)active wrongly.
 *
 * Netlify sets CONTEXT at build time: "production", "deploy-preview",
 * "branch-deploy" or undefined locally.
 */
const context = process.env.BUILD_CONTEXT || process.env.CONTEXT; // BUILD_CONTEXT is frozen at build (next.config.ts)

// Build-log diagnostic (no secret values): shows which integrations this build turns on.
if (process.env.NEXT_PHASE === "phase-production-build" && !(globalThis as { __fsIntegrationsLogged?: boolean }).__fsIntegrationsLogged) {
  (globalThis as { __fsIntegrationsLogged?: boolean }).__fsIntegrationsLogged = true;
  console.log(
    `[integrations] CONTEXT=${context ?? "(unset)"} NETLIFY=${process.env.NETLIFY ?? "(unset)"} umamiId=${process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID ? "set" : "unset"}`,
  );
}

/** Email sign-ups: Brevo configured AND switched on (code switch or per-context env var). */
export function newsletterActive() {
  return brevoConfigured() && (features.newsletter || process.env.NEWSLETTER_ENABLED === "true");
}

/** Drop & restock alerts: separate Brevo list configured AND switched on. */
export function dropAlertsActive() {
  return dropAlertsConfigured() && (features.dropAlerts || process.env.DROP_ALERTS_ENABLED === "true");
}

/** Partner applications: storage, notification and review login all configured AND switched on. */
export function partnerApplicationsActive() {
  return partnerSetup().ready;
}

/** Analytics: a valid Umami site id AND this is the production build (same test the loader uses). */
export function analyticsActive() {
  return isUmamiWebsiteId(process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID) && context === "production";
}
