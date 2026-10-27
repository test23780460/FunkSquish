/**
 * Launch switches. Everything here is OFF during pre-launch.
 *
 * Flip a switch only after the matching integration is actually connected
 * and tested on a deploy preview (see docs/ECOMMERCE-ROADMAP.md and
 * docs/LAUNCH-RUNBOOK.md). UI that depends on a switch stays visible but
 * disabled, so turning it on later needs no redesign.
 */

/**
 * How shoppers would buy, once `commerce` is on:
 * - "disabled":        nothing can be bought (pre-launch)
 * - "external-links":  each variant links to its listing on an external channel
 *                      (e.g. TikTok Shop). No cart, no payments on this site.
 * - "hosted-checkout": cart on this site, payment on the provider's hosted
 *                      checkout (e.g. Shopify). Requires server env vars.
 */
export type CheckoutMode = "disabled" | "external-links" | "hosted-checkout";

export const features: {
  commerce: boolean;
  checkoutMode: CheckoutMode;
  newsletter: boolean;
  dropAlerts: boolean;
  partnerApplications: boolean;
  accounts: boolean;
} = {
  /** Master switch for any purchasing. */
  commerce: false,
  checkoutMode: "disabled",
  /** Launch-email sign-up. Also requires the provider env vars (see .env.example). */
  newsletter: false,
  /** New-drop & restock email alerts (separate Brevo list). Also requires env vars. */
  dropAlerts: false,
  /** Partner/distributor application form. Also requires storage, notification and review env vars. */
  partnerApplications: false,
  /** Customer accounts — not planned unless genuinely useful. */
  accounts: false,
};

/** True only when a real purchase path is switched on. */
export const purchasingEnabled = features.commerce && features.checkoutMode !== "disabled";
