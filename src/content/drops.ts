import type { CategorySlug } from "@/commerce/types";

/**
 * New drops & restocks — owner-maintained.
 *
 * Rules (enforced by tests/lib/drops.test.ts):
 * - Only give `startsAt` once the date AND time are actually confirmed. A
 *   countdown is shown only then. Never invent dates.
 * - Without a confirmed date, use `dateLabel` (e.g. "Date to be announced").
 * - `productSlugs` must be products in the catalog. Preview samples are
 *   always labelled as samples on the page.
 *
 * Example of an announced drop:
 *   {
 *     id: "jelly-week",
 *     title: "Jelly Week",
 *     kind: "new",
 *     status: "announced",
 *     startsAt: "2027-02-06T19:00:00-05:00",
 *     summary: "Three new jelly squishies, revealed LIVE.",
 *     collections: ["jelly-squishies"],
 *     productSlugs: ["grape-jelly-bear"],
 *   }
 */
export type DropStatus = "planned" | "announced" | "out-now" | "ended";

export interface Drop {
  id: string;
  title: string;
  kind: "new" | "restock";
  status: DropStatus;
  summary: string;
  /** ISO 8601 with timezone offset — ONLY when confirmed. */
  startsAt?: string;
  /** Shown when there's no confirmed date. */
  dateLabel?: string;
  collections: CategorySlug[];
  productSlugs: string[];
}

export const drops: Drop[] = [
  {
    id: "first-collection",
    title: "Our first collection",
    kind: "new",
    status: "planned",
    summary:
      "The very first FunkSquish squishies. We're still sampling and choosing designs, so there's no date yet — we'll announce it here and on TikTok as soon as it's confirmed.",
    dateLabel: "Date to be announced",
    collections: ["fruity-slushies", "jelly-squishies", "crunchy-squishies", "cute-collectibles"],
    productSlugs: [],
  },
];

/** Time zone used for drop dates. */
export const dropTimeZone = "America/New_York";
