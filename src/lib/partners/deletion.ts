import { RETENTION, addDays, addMonths } from "./retention";

/**
 * A request from someone to delete their partner application. The record
 * keeps only what's needed to show the request was handled on time: dates,
 * a keyed hash of the requester's email (never the address), the references
 * that were deleted and the outcome. It's deleted 24 months after completion.
 */
export interface DeletionRequest {
  id: string;
  receivedAt: string;
  dueAt: string;
  status: "open" | "completed" | "exception";
  /** Keyed hash of the requester's email, used only to find matching applications. */
  requesterHash: string;
  /** Application references found for this requester. */
  matchedIds: string[];
  outcome?: string;
  /** Documented legal reason, when a record can't be deleted yet. */
  exceptionReason?: string;
  completedAt?: string;
  /** Short owner log, e.g. "Deleted FS-P-…". Must not contain personal details. */
  log: { at: string; text: string }[];
}

export const DELETION_ID = /^FS-D-\d{8}-[A-Z2-9]{6}$/;
export const deletionKey = (id: string) => `deletion/${id}`;

export const deletionDueAt = (receivedAt: Date) => addDays(receivedAt, RETENTION.deletionRequestDays);

export type DeletionState = "open" | "due-soon" | "overdue" | "completed" | "exception";

export function deletionState(req: DeletionRequest, now = new Date()): DeletionState {
  if (req.status !== "open") return req.status;
  const due = Date.parse(req.dueAt);
  if (now.getTime() >= due) return "overdue";
  return due - now.getTime() <= 7 * 86_400_000 ? "due-soon" : "open";
}

/** Closed requests are kept as a minimal record for 24 months, then deleted. Exceptions stay until the owner closes them. */
export function deletionRecordExpired(req: DeletionRequest, now = new Date()) {
  if (req.status !== "completed" || !req.completedAt) return false;
  return now >= addMonths(new Date(req.completedAt), RETENTION.deletionRecordMonths);
}
