import type { PartnerApplication } from "./types";

/**
 * Owner-approved retention schedule (2026-10-26). Pure rules, no storage, so
 * the review pages, the scheduled cleanup and the tests all agree.
 *
 * The clock is the LAST MEANINGFUL ACTIVITY: the submission, a stage change,
 * an owner note, or the owner confirming an approved relationship is still
 * active. Re-sending the notification email, legal holds, retention runs and
 * other bookkeeping never move it (they only touch `updatedAt`, which these
 * rules ignore).
 */
export const RETENTION = {
  declinedMonths: 12,
  openMonths: 24, // New, Under review, Need more info
  interestMonths: 24, // Future reseller / distributor interest
  approvedReviewMonths: 12, // Approved: never auto-deleted, review due after this
  rateLimitHours: 48,
  deletionRequestDays: 30,
  deletionRecordMonths: 24, // minimal deletion-request records, after completion
  runHistory: 30,
} as const;

export type RetentionDecision =
  | { action: "delete"; rule: string; dueAt: Date }
  | { action: "keep"; rule: string; dueAt: Date }
  | { action: "review"; rule: string; dueAt: Date; overdue: boolean }
  | { action: "hold"; rule: string };

/** Adds calendar months in UTC, clamping to the last day (Jan 31 + 1 month = Feb 28/29). */
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d;
}

export const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86_400_000);

const valid = (iso: string | undefined) => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? t : null;
};

/** Latest meaningful activity (never `updatedAt`). */
export function lastActivity(app: Pick<PartnerApplication, "createdAt" | "history" | "notes" | "relationshipConfirmedAt">): Date {
  const times = [app.createdAt, ...app.history.map((h) => h.at), ...app.notes.map((n) => n.at), app.relationshipConfirmedAt].map(valid).filter((t): t is number => t !== null);
  // A record with no readable dates is treated as brand new rather than deleted by mistake.
  return new Date(times.length ? Math.max(...times) : Date.now());
}

export function retentionDecision(app: PartnerApplication, now = new Date()): RetentionDecision {
  if (app.legalHold) return { action: "hold", rule: `Legal hold: ${app.legalHold.reason}` };
  const from = lastActivity(app);
  if (app.status === "approved") {
    const dueAt = addMonths(from, RETENTION.approvedReviewMonths);
    return { action: "review", rule: "Approved for follow-up: kept while the relationship is active; review yearly", dueAt, overdue: now >= dueAt };
  }
  const [months, rule] =
    app.status === "declined"
      ? [RETENTION.declinedMonths, "Declined: 12 months after the last activity"]
      : app.type === "reseller"
        ? [RETENTION.interestMonths, "Future reseller interest: 24 months after the last activity"]
        : [RETENTION.openMonths, "Open application: 24 months after the last activity"];
  const dueAt = addMonths(from, months);
  return now >= dueAt ? { action: "delete", rule, dueAt } : { action: "keep", rule, dueAt };
}

/* ------------------------------ rate limits ------------------------------ */

/** Windows of the limits used before the window was part of the key (kept so old counters still get cleaned up). */
const LEGACY_WINDOWS: Record<string, number> = { "ip-hour": 3600, "ip-day": 86400, "email-day": 86400, "global-day": 86400, "login-ip": 900, "login-global": 3600 };

/** Key for one fixed-window counter: `<name>[/<hash>]/w<seconds>/<window index>`. */
export function rateLimitKey(name: string, windowSeconds: number, nowMs: number) {
  return `${name}/w${windowSeconds}/${Math.floor(nowMs / 1000 / windowSeconds)}`;
}

/** When the counter's window started, or null if the key isn't a rate-limit key we recognise. */
export function rateLimitWindowStart(key: string): Date | null {
  const parts = key.split("/");
  const index = Number(parts.at(-1));
  if (!Number.isInteger(index) || index < 0) return null;
  const w = parts.at(-2)?.match(/^w(\d+)$/);
  const seconds = w ? Number(w[1]) : LEGACY_WINDOWS[parts[0]];
  if (!seconds) return null;
  return new Date(index * seconds * 1000);
}

/** Rate-limit counters are deleted 2 days after their window started (unrecognised keys too: they only hold counts). */
export function rateLimitExpired(key: string, now = new Date()) {
  const start = rateLimitWindowStart(key);
  return !start || now.getTime() - start.getTime() >= RETENTION.rateLimitHours * 3_600_000;
}
