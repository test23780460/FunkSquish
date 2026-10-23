/**
 * Launch switches. Everything here is OFF during pre-launch.
 *
 * Flip a flag only after the matching integration is actually connected
 * (see docs/ECOMMERCE-ROADMAP.md). UI that depends on a flag stays visible
 * but disabled, so turning it on later needs no redesign.
 */
export const features = {
  /** Real products + checkout via a payment provider (e.g. Shopify / Stripe). */
  commerce: false,
  /** Email sign-up form connected to a real email service. */
  newsletter: false,
  /** Customer accounts (only if they turn out to be genuinely useful). */
  accounts: false,
} as const;
