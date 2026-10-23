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
