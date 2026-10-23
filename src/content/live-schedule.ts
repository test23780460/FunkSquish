/**
 * TikTok LIVE schedule.
 *
 * Empty until real streams are planned. Add entries like:
 *   { id: "first-live", title: "First squish test!", startsAt: "2027-01-15T19:00:00-05:00", note: "Unboxing our first samples" }
 * Remove entries once they have happened.
 */
export interface LiveSession {
  id: string;
  title: string;
  /** ISO 8601 with timezone offset. */
  startsAt: string;
  note?: string;
}

export const liveSchedule: LiveSession[] = [];

/** Time zone used when displaying LIVE times. Set this to your local zone. */
export const scheduleTimeZone = "America/New_York";
