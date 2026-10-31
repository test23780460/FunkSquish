import "server-only";

/**
 * Read-only Umami Cloud statistics for the owner's Analytics page — OPTIONAL
 * and OFF until the owner adds an API key. Visitor counts stay in Umami;
 * this only fetches the totals already shown on the Umami dashboard.
 *
 * Needs (Netlify, Production, "contains secret values"):
 *   UMAMI_API_KEY                 Umami Cloud → Settings → API keys (read access)
 *   NEXT_PUBLIC_UMAMI_WEBSITE_ID  already set for the tracker
 * Written from Umami's documented API (https://umami.is/docs/cloud/api-key);
 * not yet tried against this account.
 */
export interface UmamiStats {
  pageviews: number;
  visitors: number;
  visits: number;
  events: { name: string; count: number }[];
}

export function umamiApiConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return !!env.UMAMI_API_KEY && /^[0-9a-f-]{36}$/i.test(env.NEXT_PUBLIC_UMAMI_WEBSITE_ID ?? "");
}

export async function umamiStats(from: Date, to: Date, env: Record<string, string | undefined> = process.env, fetchImpl: typeof fetch = fetch): Promise<UmamiStats | { error: string }> {
  if (!umamiApiConfigured(env)) return { error: "not-configured" };
  const id = env.NEXT_PUBLIC_UMAMI_WEBSITE_ID!;
  const q = `startAt=${from.getTime()}&endAt=${to.getTime()}`;
  const headers = { "x-umami-api-key": env.UMAMI_API_KEY!, Accept: "application/json" };
  try {
    const [s, e] = await Promise.all([
      fetchImpl(`https://api.umami.is/v1/websites/${id}/stats?${q}`, { headers, signal: AbortSignal.timeout(8000), cache: "no-store" }),
      fetchImpl(`https://api.umami.is/v1/websites/${id}/metrics?${q}&type=event`, { headers, signal: AbortSignal.timeout(8000), cache: "no-store" }),
    ]);
    if (!s.ok) return { error: `umami-${s.status}` };
    const stats = (await s.json()) as Record<string, number | { value?: number }>;
    const n = (k: string) => {
      const v = stats[k];
      return typeof v === "number" ? v : typeof v === "object" && v ? (v.value ?? 0) : 0;
    };
    const events = e.ok ? ((await e.json()) as { x: string; y: number }[]).map((r) => ({ name: String(r.x), count: Number(r.y) || 0 })) : [];
    return { pageviews: n("pageviews"), visitors: n("visitors"), visits: n("visits"), events };
  } catch {
    return { error: "unreachable" };
  }
}

/** What each tracked event means (names as sent by the site). */
export const EVENT_MEANING: Record<string, string> = {
  "tiktok-click": "Clicked a link to TikTok",
  "quiz-start": "Started the personality quiz",
  "quiz-complete": "Finished the quiz",
  "box-start": "Started a Squish Box",
  "wishlist-add": "Added to the wishlist",
  "wishlist-share": "Shared a wishlist",
  "squish-lab-squish": "Used the Squish Lab",
  "newsletter-signup": "Completed a launch-list sign-up",
  "drop-alert-signup": "Completed a drop-alert sign-up",
  "partner-application": "Sent a partner application",
  "add-to-cart": "Added to cart (off until the Privacy Policy lists it)",
  "checkout-start": "Started checkout (off until the Privacy Policy lists it)",
};
