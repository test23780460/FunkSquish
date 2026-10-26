import type { Drop } from "@/content/drops";

/**
 * What the page may say about a drop at a given moment. A countdown is only
 * allowed for an announced drop with a confirmed, valid, future date.
 */
export type DropView =
  | { kind: "countdown"; startsAt: Date }
  | { kind: "date-passed"; startsAt: Date } // announced date has passed but owner hasn't updated the status
  | { kind: "out-now" }
  | { kind: "ended" }
  | { kind: "tba"; label: string };

export function dropView(drop: Drop, now: Date): DropView {
  if (drop.status === "ended") return { kind: "ended" };
  if (drop.status === "out-now") return { kind: "out-now" };
  const start = drop.startsAt ? new Date(drop.startsAt) : null;
  if (drop.status === "announced" && start && !Number.isNaN(start.getTime())) {
    return start.getTime() > now.getTime() ? { kind: "countdown", startsAt: start } : { kind: "date-passed", startsAt: start };
  }
  return { kind: "tba", label: drop.dateLabel || "Date to be announced" };
}

export function countdownParts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { days: Math.floor(s / 86400), hours: Math.floor((s % 86400) / 3600), minutes: Math.floor((s % 3600) / 60), seconds: s % 60 };
}

/** Upcoming first (by date, undated planned after dated), then out-now, then ended. */
export function sortDrops(list: Drop[]): Drop[] {
  const rank = { "out-now": 0, announced: 1, planned: 2, ended: 3 } as const;
  return [...list].sort((a, b) => rank[a.status] - rank[b.status] || (a.startsAt ?? "9999").localeCompare(b.startsAt ?? "9999"));
}
