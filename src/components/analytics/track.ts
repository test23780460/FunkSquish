/**
 * Fire a custom analytics event (Umami). Safe no-op when analytics is not
 * configured, blocked, or still loading. Never pass personal data.
 */
type Umami = { track: (event: string, data?: Record<string, string | number>) => void };

export function trackEvent(name: string, data?: Record<string, string | number>) {
  if (typeof window === "undefined") return;
  const umami = (window as unknown as { umami?: Umami }).umami;
  try {
    umami?.track(name, data);
  } catch {
    /* analytics must never break the page */
  }
}

/**
 * Shopping events ("add-to-cart", "checkout-start") — OFF. The Privacy Policy
 * lists exactly which actions analytics count, and these aren't on that list
 * yet. Turn this on in the same reviewed change that adds them to the policy
 * (proposed wording: docs/OWNER-GUIDE.md → Analytics). Purchases and revenue
 * never come from analytics: the dashboard counts them from verified orders.
 */
export const COMMERCE_EVENTS_ENABLED = false;

export function trackCommerceEvent(name: "add-to-cart" | "checkout-start") {
  if (COMMERCE_EVENTS_ENABLED) trackEvent(name);
}
