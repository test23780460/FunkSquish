/**
 * One record of each customer policy's current version.
 *
 * - The pages show `lastUpdated` from here, so the date can't drift.
 * - `version` is what a future order record should store (which Terms,
 *   Shipping and Returns applied to that purchase) — see
 *   docs/COMPLIANCE-LAUNCH-GATES.md, gate "Policy version recorded on orders".
 * - Earlier versions stay retrievable from git history; the Terms promise to
 *   provide the version that applied to an order on request.
 *
 * Bump `version` and `lastUpdated` together whenever a policy's wording changes,
 * and set them to the date the change actually takes effect (the merge date).
 */
export type PolicyId = "privacy" | "terms" | "shipping" | "returns";

export interface PolicyVersion {
  title: string;
  path: string;
  /** YYYY-MM-DD of the wording below. */
  version: string;
  /** Human date shown on the page. */
  lastUpdated: string;
  /** "draft" pages show the Draft banner and stay noindex; "owner-approved" pages are in effect once merged. */
  status: "draft" | "owner-approved";
}

export const POLICIES: Record<PolicyId, PolicyVersion> = {
  privacy: { title: "Privacy Policy", path: "/privacy", version: "2026-10-27", lastUpdated: "October 27, 2026", status: "draft" },
  terms: { title: "Terms of Service", path: "/terms", version: "2026-10-27", lastUpdated: "October 27, 2026", status: "draft" },
  // Shipping: owner-approved directions (2026-10-24, and Phase 2 on 2026-10-27: mixed-origin orders,
  // per-package shipping); the exact wording needs the owner's sign-off before merge.
  shipping: { title: "Shipping Policy", path: "/shipping", version: "2026-10-27", lastUpdated: "October 27, 2026", status: "owner-approved" },
  // Returns: owner direction 2026-10-27 (no automatic disposal); kept DRAFT until legal review (owner instruction).
  returns: { title: "Returns & Refunds Policy", path: "/returns", version: "2026-10-27", lastUpdated: "October 27, 2026", status: "draft" },
};
