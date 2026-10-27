/**
 * Signature confirmation — PROPOSED, ADVISORY ONLY (owner decision, Part 8).
 *
 * The owner page suggests buying signature confirmation for packages in orders
 * at or above this value. It is a recommendation to the owner, nothing more:
 *  - it is never charged to the customer (no fee is added at checkout or later);
 *  - it is not advertised in any policy or on the site.
 * Before enforcing or advertising it: confirm which carrier services offer it,
 * what it costs per package, and how it changes delivery (a missed signature
 * means a trip to the post office). See docs/MIXED-ORDER-SHIPPING.md §7.
 */
export interface SignaturePolicy {
  /** Order total (cents, including shipping and tax) at which the owner page recommends signature confirmation. */
  recommendAtOrAboveCents: number;
  /** Must stay false until the owner approves a disclosed fee. Checkout never reads this. */
  chargeCustomer: false;
  /** Must stay false until the policies mention it. */
  advertised: false;
}

export const SIGNATURE_POLICY: SignaturePolicy = {
  recommendAtOrAboveCents: 150_00,
  chargeCustomer: false,
  advertised: false,
};

export function signatureRecommended(orderTotalCents: number, policy: SignaturePolicy = SIGNATURE_POLICY): boolean {
  return Number.isSafeInteger(orderTotalCents) && orderTotalCents >= policy.recommendAtOrAboveCents;
}
