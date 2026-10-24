import { features } from "@/lib/features";
import { brevoConfigured } from "@/lib/newsletter/brevo";

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

/** Analytics: Umami site id present AND this is the production build. */
export function analyticsActive() {
  return !!process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID && context === "production";
}
