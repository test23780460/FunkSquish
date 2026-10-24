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
const context = process.env.CONTEXT;

/** Email sign-ups: Brevo configured AND switched on (code switch or per-context env var). */
export function newsletterActive() {
  return brevoConfigured() && (features.newsletter || process.env.NEWSLETTER_ENABLED === "true");
}

/** Analytics: Umami site id present AND this is the production build. */
export function analyticsActive() {
  return !!process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID && context === "production";
}
