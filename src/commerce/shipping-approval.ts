import { createHash } from "node:crypto";
import { originProblem, staticOriginProblem, type ShippingOrigin } from "./origins";

/**
 * Replacement for the old `STRIPE_LIVE_SHIPPING_RATE_IDS` lock (decision
 * D-SHIP-3, proposed in its own PR). Checkout no longer charges Stripe
 * shipping-rate ids — it sends the server's own rate, computed from the
 * verified origin table in origins.ts — so requiring an unused `shr_…` id
 * proved nothing. Live checkout now needs instead:
 *
 *  1. VERIFIED RATES: at least one shipping origin with a rule, a recorded
 *     verification (who, when, evidence) and, for suppliers, a signed agreement.
 *     The lock doesn't read the clock (pages using it are built ahead of time);
 *     verifications past their review date — or dated in the future — are
 *     refused item by item at checkout, every time (origins.ts originProblem).
 *  2. THE OWNER'S APPROVAL OF THIS EXACT TABLE: STRIPE_LIVE_SHIPPING_TABLE must
 *     equal the fingerprint of the rates that will be charged. Any later change
 *     to rates, processing times, APO/FPO support, verification or supplier
 *     agreements changes the fingerprint and closes live checkout until the
 *     owner approves the new table — so rates can never change on customers
 *     without the owner seeing them first.
 *
 * The fingerprint isn't a secret: the owner's Orders page shows it, with
 * whether the Production value matches.
 */
export const SHIPPING_TABLE_PREFIX = "ship_v1_";

/** JSON with sorted keys, so the same table always gives the same fingerprint. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

/** Everything that changes what customers are charged or promised (display labels excluded). */
function pricingFacts(o: ShippingOrigin) {
  return {
    id: o.id,
    source: o.source,
    rule: o.rule,
    verified: o.verified,
    reviewEveryDays: o.reviewEveryDays,
    processingBusinessDays: o.processingBusinessDays,
    agreementOnFile: o.agreementOnFile,
    militaryAddresses: o.militaryAddresses,
    zeroCostConfirmed: !!o.zeroCostConfirmed,
  };
}

export function shippingTableFingerprint(origins: ShippingOrigin[]): string {
  const table = origins.map(pricingFacts).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return SHIPPING_TABLE_PREFIX + createHash("sha256").update(canonical(table)).digest("hex").slice(0, 16);
}

export type ShippingLockProblem = "shipping-not-verified" | "shipping-not-approved";

/** Null when live checkout may use this shipping table. No clock: see note 1 above. */
export function liveShippingProblem(origins: ShippingOrigin[], approved: string | undefined): ShippingLockProblem | null {
  if (!origins.some((o) => staticOriginProblem(o, o.source) === null)) return "shipping-not-verified";
  if ((approved ?? "").trim() !== shippingTableFingerprint(origins)) return "shipping-not-approved";
  return null;
}

export const SHIPPING_LOCK_TEXT: Record<ShippingLockProblem, string> = {
  "shipping-not-verified": "No shipping origin has verified rates yet (src/commerce/origins.ts).",
  "shipping-not-approved": "STRIPE_LIVE_SHIPPING_TABLE doesn't match the current shipping table — check the rates, then set it to the fingerprint shown.",
};

/** What the owner's Orders page shows. */
export function shippingApprovalStatus(
  origins: ShippingOrigin[],
  env: Record<string, string | undefined> = process.env,
  now = new Date(),
): { fingerprint: string; verifiedOrigins: number; approval: "matches" | "different" | "not-set"; problem: ShippingLockProblem | null } {
  const fingerprint = shippingTableFingerprint(origins);
  const set = env.STRIPE_LIVE_SHIPPING_TABLE?.trim();
  return {
    fingerprint,
    verifiedOrigins: origins.filter((o) => originProblem(o, now, o.source) === null).length,
    approval: !set ? "not-set" : set === fingerprint ? "matches" : "different",
    problem: liveShippingProblem(origins, set),
  };
}
