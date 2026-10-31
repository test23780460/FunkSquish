/**
 * Card dispute statuses and how conflicting reports about one dispute are settled.
 *
 * Statuses: Stripe's Dispute object (https://docs.stripe.com/api/disputes/object,
 * checked 2026-10-31) lists warning_needs_response, warning_under_review,
 * warning_closed, needs_response, under_review, appeal_needs_response,
 * appeal_under_review, won, lost and prevented. The lifecycle isn't a straight
 * line: an inquiry can escalate to a chargeback, a "lost" dispute can later
 * become "won" (Stripe's "late win"), and an appeal can follow a decision. So
 * nothing here assumes an order of statuses.
 *
 * Ordering: Stripe doesn't deliver events in order, and event `created` times
 * are whole seconds, so two events can share one and Stripe says not to order
 * events by it (https://docs.stripe.com/webhooks#event-ordering). When an event
 * disagrees with what we stored, the order code re-reads the Dispute from
 * Stripe and stores that. Only if Stripe can't be reached does it fall back to
 * event times, and when those can't decide it keeps whatever needs the owner
 * most and marks the dispute "check in Stripe". Nothing actionable is hidden.
 */

const NEEDS_RESPONSE = new Set(["warning_needs_response", "needs_response", "appeal_needs_response"]);
const UNDER_REVIEW = new Set(["warning_under_review", "under_review", "appeal_under_review"]);
const CLOSED = new Set(["won", "lost", "warning_closed", "prevented"]);

export type DisputeState = "needs_response" | "under_review" | "closed" | "unknown";

export function disputeState(status: string): DisputeState {
  if (NEEDS_RESPONSE.has(status)) return "needs_response";
  if (UNDER_REVIEW.has(status)) return "under_review";
  if (CLOSED.has(status)) return "closed";
  return "unknown"; // a status Stripe added later: never assume it's over
}

/** Open with the card network (including appeals). */
export const isOpenDispute = (status: string) => {
  const s = disputeState(status);
  return s === "needs_response" || s === "under_review";
};

/** The facts about a dispute we keep in sync with Stripe. */
export interface DisputeFacts {
  status: string;
  amount: number;
  evidenceDueBy: string | null;
}

export interface StoredDispute extends DisputeFacts {
  /** Latest Stripe event time (ISO, whole seconds) seen for this dispute. */
  eventAt?: string | null;
  /** When the stored facts were last read from Stripe's Dispute object (ISO). */
  verifiedAt?: string | null;
  /** Conflicting reports that Stripe couldn't be asked about: the owner should check it in Stripe. */
  needsCheck?: boolean;
}

/** Shown to the owner until settled: open (incl. appeals), a status we don't recognize, or unconfirmed. */
export const disputeNeedsOwner = (d: Pick<StoredDispute, "status" | "needsCheck">) => !!d.needsCheck || disputeState(d.status) !== "closed";

/** The owner's to-do line for a dispute that needs them, or null. */
export function disputeAttentionLabel(d: Pick<StoredDispute, "status" | "needsCheck" | "evidenceDueBy"> & { reason: string | null }): string | null {
  if (!disputeNeedsOwner(d)) return null;
  const due = d.evidenceDueBy ? ` by ${d.evidenceDueBy.slice(0, 10)}` : "";
  const what = d.status.startsWith("appeal_") ? "Card dispute appeal" : "Card dispute";
  if (d.needsCheck) return `${what} (${d.reason ?? "no reason given"}) — Stripe sent conflicting updates; check its status in Stripe`;
  switch (disputeState(d.status)) {
    case "needs_response":
      return `${what} (${d.reason ?? "no reason given"}) — respond in Stripe${due}`;
    case "under_review":
      return `${what} (${d.reason ?? "no reason given"}) — evidence submitted, waiting for the bank's decision`;
    default:
      return `${what} has a status FunkSquish doesn't recognize ("${d.status}") — check it in Stripe`;
  }
}

export const sameDisputeFacts = (a: DisputeFacts, b: DisputeFacts) =>
  a.status === b.status && a.amount === b.amount && a.evidenceDueBy === b.evidenceDueBy;

const facts = (d: DisputeFacts): DisputeFacts => ({ status: d.status, amount: d.amount, evidenceDueBy: d.evidenceDueBy });
const later = (a?: string | null, b?: string | null) => (a && b ? (a > b ? a : b) : (a ?? b ?? null));

// Only for ties we can't settle with Stripe: keep what asks the most of the owner.
const URGENCY: Record<DisputeState, number> = { needs_response: 3, unknown: 2, under_review: 1, closed: 0 };
function moreUrgent(a: DisputeFacts, b: DisputeFacts): DisputeFacts {
  const ua = URGENCY[disputeState(a.status)];
  const ub = URGENCY[disputeState(b.status)];
  if (ua !== ub) return ua > ub ? a : b;
  // Same urgency: the earlier evidence deadline is the safer one to show.
  if (a.evidenceDueBy && b.evidenceDueBy) return a.evidenceDueBy <= b.evidenceDueBy ? a : b;
  return a.evidenceDueBy ? a : b;
}

/**
 * What to store for one dispute after an event, or null to leave it as it is. Pure.
 *
 * - `stripe`: the Dispute object read from Stripe after the event arrived (null if
 *   not read or Stripe failed). It wins, unless a Stripe read that started later is
 *   already stored.
 * - Otherwise the event alone: the first report is stored; a report with a later
 *   whole-second event time replaces an earlier one, an earlier one is ignored; a
 *   tie (or missing time) can't be ordered, so the more urgent report is kept and
 *   the dispute is marked for the owner to check in Stripe.
 */
export function resolveDispute(
  known: StoredDispute | undefined,
  incoming: DisputeFacts & { eventAt?: string | null },
  stripe: { facts: DisputeFacts; at: string } | null,
): StoredDispute | null {
  const eventAt = later(known?.eventAt, incoming.eventAt);
  if (stripe) {
    if (known?.verifiedAt && known.verifiedAt > stripe.at) return null;
    const next: StoredDispute = { ...facts(stripe.facts), eventAt, verifiedAt: stripe.at, needsCheck: false };
    if (known && sameDisputeFacts(known, next) && !known.needsCheck && known.eventAt === eventAt && known.verifiedAt === stripe.at) return null;
    return next;
  }
  if (!known) return { ...facts(incoming), eventAt: incoming.eventAt ?? null, verifiedAt: null, needsCheck: false };
  if (sameDisputeFacts(known, incoming)) return known.eventAt === eventAt ? null : { ...known, eventAt };
  const a = incoming.eventAt;
  const b = known.eventAt;
  if (a && b && a !== b) return a > b ? { ...facts(incoming), eventAt: a, verifiedAt: known.verifiedAt ?? null, needsCheck: false } : null;
  const keep = moreUrgent(incoming, known);
  return { ...facts(keep), eventAt, verifiedAt: known.verifiedAt ?? null, needsCheck: true };
}
