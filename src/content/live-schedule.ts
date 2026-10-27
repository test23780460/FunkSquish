/**
 * TikTok LIVE schedule, clips and approved links — owner-maintained.
 *
 * Only add REAL, planned streams. The site never claims we're live: during a
 * scheduled window it says the LIVE is "scheduled for now" and links to TikTok.
 * Remove entries once they've happened (or leave them; past ones are hidden).
 *
 * Example:
 *   {
 *     id: "first-live",
 *     title: "First squish test!",
 *     startsAt: "2027-01-15T19:00:00-05:00",
 *     endsAt: "2027-01-15T20:00:00-05:00",
 *     note: "Unboxing our first samples",
 *     featuredSlugs: ["grape-jelly-bear"],
 *   }
 */
export interface LiveSession {
  id: string;
  title: string;
  /** ISO 8601 with timezone offset. */
  startsAt: string;
  /** ISO 8601 with offset. Defaults to 60 minutes after the start. */
  endsAt?: string;
  note?: string;
  /** Catalog products we plan to show. Unknown slugs are ignored. */
  featuredSlugs?: string[];
}

export const liveSchedule: LiveSession[] = [];

/** Time zone used when displaying LIVE times. Set this to your local zone. */
export const scheduleTimeZone = "America/New_York";

/**
 * Clips from our own TikTok account. `videoId` is the number at the end of the
 * TikTok video URL (tiktok.com/@funksquish/video/<videoId>). Clips only load
 * from TikTok after a visitor taps "Play", so TikTok isn't contacted otherwise.
 */
export interface LiveClip {
  id: string;
  title: string;
  videoId: string;
  /** ISO date posted. */
  postedAt: string;
}

export const liveClips: LiveClip[] = [];

/**
 * External links the owner has approved for the LIVE room. Only our own
 * official accounts — never resellers or third-party shops.
 */
export const approvedLiveLinks: { label: string; href: string }[] = [
  { label: "FunkSquish on TikTok", href: "https://www.tiktok.com/@funksquish" },
];
