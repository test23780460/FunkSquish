/**
 * Shipping destinations (policy S2): the 50 states, D.C. and military
 * APO/FPO/DPO (AA/AE/AP) — NOT U.S. territories or freely associated states.
 *
 * Stripe Checkout's "US" country still lists these as "states" in its address
 * form, and hosted Checkout can't hide them, so: (1) a note on Stripe's
 * address form tells shoppers before they pay, and (2) any order that slips
 * through is flagged "restricted_destination" for a refund instead of shipping.
 */
export const RESTRICTED_US_REGIONS = new Set([
  "AS", // American Samoa
  "GU", // Guam
  "MP", // Northern Mariana Islands
  "PR", // Puerto Rico
  "VI", // U.S. Virgin Islands
  "UM", // U.S. Minor Outlying Islands
  "MH", // Marshall Islands
  "FM", // Micronesia
  "PW", // Palau
]);

export const SHIPPING_AREA_NOTE =
  "We ship to the 50 states, Washington D.C. and APO/FPO/DPO addresses. We can't ship to U.S. territories (like Puerto Rico or Guam) yet.";

export function isAllowedDestination(address: { country: string | null; state: string | null } | null): boolean {
  if (!address || address.country !== "US" || !address.state) return false;
  return !RESTRICTED_US_REGIONS.has(address.state.toUpperCase());
}
