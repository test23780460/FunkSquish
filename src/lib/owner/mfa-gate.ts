import "server-only";
import { reviewConfig } from "@/lib/partners/config";
import { activeEnrollment, loadAuthState, ownerSecurityStore } from "./auth";

/**
 * "Two-step sign-in BEFORE customer orders or partner applications" (owner
 * decision, 2026-10-27). Live checkout and the partner application form stay
 * closed until the owner has an active two-step enrollment here — switching
 * them on in code or env isn't enough on its own.
 *
 * Enrolling stays possible at any time: while nothing is switched on it's
 * optional (no lock-out); once something is switched on, a passphrase-only
 * sign-in can still reach the setup page (and the owner is emailed when
 * two-step sign-in is turned on). Safest order: set it up first, then
 * OWNER_MFA_REQUIRED=true, then switch features on (docs/OWNER-SECURITY.md).
 *
 * Fails closed: no owner area configured, no enrollment, an enrollment being
 * reset with OWNER_MFA_RESET_ID, or the security store unreadable → not ready.
 * Answers are reused for up to a minute per server instance.
 */
export type MfaGate = { ready: true } | { ready: false; reason: "owner-area-not-configured" | "no-enrollment" | "store-unavailable" };

const CACHE_MS = 60_000;
const cache = globalThis as { __fsMfaGate?: { at: number; result: MfaGate } };

export async function ownerMfaReady(nowMs = Date.now()): Promise<MfaGate> {
  const hit = cache.__fsMfaGate;
  if (hit && nowMs - hit.at < CACHE_MS) return hit.result;
  let result: MfaGate;
  const cfg = reviewConfig();
  if (!cfg) result = { ready: false, reason: "owner-area-not-configured" };
  else {
    try {
      result = activeEnrollment(await loadAuthState(await ownerSecurityStore(cfg))) ? { ready: true } : { ready: false, reason: "no-enrollment" };
    } catch {
      result = { ready: false, reason: "store-unavailable" };
    }
  }
  cache.__fsMfaGate = { at: nowMs, result };
  return result;
}

/** Owner-facing explanation (logs, setup pages). */
export const MFA_GATE_TEXT: Record<Exclude<MfaGate, { ready: true }>["reason"], string> = {
  "owner-area-not-configured": "the owner area isn't configured (PARTNER_SECRET / passphrase), so two-step sign-in can't exist",
  "no-enrollment": "owner two-step sign-in isn't set up yet (Owner area → Security)",
  "store-unavailable": "the owner security store couldn't be read",
};

/** Tests, and right after the owner changes two-step sign-in on this instance. */
export function forgetMfaGate() {
  cache.__fsMfaGate = undefined;
}
