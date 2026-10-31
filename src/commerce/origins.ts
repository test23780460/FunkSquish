import originsData from "./data/shipping-origins.json";
import type { FulfillmentSource, ProductVariant } from "./types";

/**
 * Where items ship from ("origins") and the shipping each one charges.
 *
 * PUBLIC-SAFE. Customers see these amounts at checkout, so they may appear in
 * the code. What must NEVER be added here: supplier names, contacts, private
 * costs or contract terms. Each origin has an opaque id; the evidence for its
 * rates (carrier quote, supplier rate card, signed agreement) is kept in the
 * private catalog folder and only referenced by name.
 *
 * Nothing is guessed. An origin can be bought from only when:
 *  - its shipping rule is filled in from real, verified costs;
 *  - the verification is recent (re-checked every `reviewEveryDays`);
 *  - it has a committed processing time (business days from payment to the carrier);
 *  - for suppliers: a signed agreement is on file (ship times, rates, and that
 *    customer addresses are used only to fulfill our orders).
 * Otherwise checkout refuses those items with a plain explanation, and the
 * rest of the cart can still be bought.
 * See docs/MIXED-ORDER-SHIPPING.md.
 */

/**
 * How one package from an origin is priced. Items from the same origin always
 * ship together in ONE package, so they share one base charge.
 *  - "per-item": first item + each additional item (a typical supplier rate card).
 *  - "weight":   packed weight (items + packaging) looked up in a table of tiers.
 */
export type ShippingRule =
  | { kind: "per-item"; firstItemCents: number; additionalItemCents: number; maxItemsPerPackage: number }
  | { kind: "weight"; packagingGrams: number; tiers: { upToGrams: number; cents: number }[] };

export interface ShippingOrigin {
  /** Opaque id, e.g. "funksquish" or "supplier-a". Lowercase letters, digits and dashes. */
  id: string;
  source: FulfillmentSource;
  /** What customers see. Never a supplier's name. */
  publicLabel: string;
  /** Verified rule, or null until real costs are confirmed. */
  rule: ShippingRule | null;
  /** Who verified the rule, when (YYYY-MM-DD), and a private reference to the evidence. */
  verified: { on: string; by: string; evidence: string } | null;
  /** Re-verify the rates at least this often; older verifications stop checkout for this origin. */
  reviewEveryDays: number;
  /** Business days from payment to handing the package to the carrier (supplier: committed in writing). */
  processingBusinessDays: number | null;
  /** Supplier only: signed agreement covering ship times, rates and limited use of customer addresses. */
  agreementOnFile: boolean;
  /** Can ship to APO/FPO/DPO military addresses (our Shipping Policy covers them). */
  militaryAddresses: boolean;
  /** Required before any 0-cent charge is accepted: free shipping is never assumed. */
  zeroCostConfirmed?: boolean;
}

/** Our own stock. Standard processing time is the Shipping Policy's 2 business days. */
export const FUNKSQUISH_ORIGIN_ID = "funksquish";

/**
 * Every field an origin entry may have (anything else in the data file is refused,
 * so a supplier name or cost can't slip into this public table by accident).
 */
const ORIGIN_KEYS = new Set(["id", "source", "publicLabel", "rule", "verified", "reviewEveryDays", "processingBusinessDays", "agreementOnFile", "militaryAddresses", "zeroCostConfirmed"]);

/** Structural check of the data file. Throws (failing the build) on anything malformed. */
export function validateOrigins(input: unknown): ShippingOrigin[] {
  if (!Array.isArray(input)) throw new Error("shipping-origins.json must be a list of origins.");
  const ids = new Set<string>();
  return input.map((o, i) => {
    const at = `shipping-origins.json[${i}]`;
    if (!o || typeof o !== "object") throw new Error(`${at}: must be an object`);
    const x = o as Record<string, unknown>;
    for (const k of Object.keys(x)) if (!ORIGIN_KEYS.has(k)) throw new Error(`${at}.${k}: not an allowed field (keep private details out of this public table)`);
    if (typeof x.id !== "string" || !ORIGIN_ID.test(x.id) || ids.has(x.id)) throw new Error(`${at}.id: unique lowercase id`);
    ids.add(x.id);
    if (x.source !== "in_house" && x.source !== "supplier") throw new Error(`${at}.source: in_house or supplier`);
    if (typeof x.publicLabel !== "string" || !x.publicLabel.trim()) throw new Error(`${at}.publicLabel: required`);
    if (!Number.isInteger(x.reviewEveryDays) || (x.reviewEveryDays as number) < 1 || (x.reviewEveryDays as number) > 366) throw new Error(`${at}.reviewEveryDays: 1–366`);
    if (x.processingBusinessDays !== null && !Number.isInteger(x.processingBusinessDays)) throw new Error(`${at}.processingBusinessDays: whole number or null`);
    if (typeof x.agreementOnFile !== "boolean" || typeof x.militaryAddresses !== "boolean") throw new Error(`${at}: agreementOnFile and militaryAddresses are true/false`);
    if (x.rule !== null && ruleProblem(x as unknown as ShippingOrigin) === "invalid-rule") throw new Error(`${at}.rule: incomplete or inconsistent`);
    if (x.verified !== null) {
      const v = x.verified as Record<string, unknown>;
      if (!v || typeof v.on !== "string" || typeof v.by !== "string" || typeof v.evidence !== "string") throw new Error(`${at}.verified: { on, by, evidence } or null`);
    }
    return x as unknown as ShippingOrigin;
  });
}

export const ORIGIN_ID = /^[a-z][a-z0-9-]{1,30}$/;
/** Ids that would collide with fulfillment groups recorded before origins existed. */
const RESERVED_IDS = new Set(["in_house-1", "supplier-1"]);

/** Which origin a variant ships from. Our own stock defaults to FunkSquish; supplier items must name theirs. */
export function originIdFor(variant: Pick<ProductVariant, "fulfillmentSource" | "fulfillmentOrigin">): string | null {
  if (variant.fulfillmentOrigin) return variant.fulfillmentOrigin;
  return (variant.fulfillmentSource ?? "in_house") === "in_house" ? FUNKSQUISH_ORIGIN_ID : null;
}

export type OriginProblem =
  | "unknown-origin"
  | "source-mismatch"
  | "no-rates"
  | "invalid-rule"
  | "not-verified"
  | "verification-expired"
  | "no-processing-time"
  | "no-supplier-agreement"
  | "zero-cost-unconfirmed";

/** Owner-facing explanations (the shopper gets a simpler message). */
export const ORIGIN_PROBLEM_TEXT: Record<OriginProblem, string> = {
  "unknown-origin": "No shipping origin is set for this item (supplier items must name their origin).",
  "source-mismatch": "The item's fulfillment source doesn't match its origin.",
  "no-rates": "No verified shipping rates have been entered for this origin.",
  "invalid-rule": "The shipping rule for this origin is incomplete or inconsistent.",
  "not-verified": "The shipping rates haven't been marked as verified (who, when, evidence).",
  "verification-expired": "The shipping rates are due for re-verification.",
  "no-processing-time": "No committed processing time for this origin.",
  "no-supplier-agreement": "No signed supplier agreement is on file for this origin.",
  "zero-cost-unconfirmed": "A $0 shipping charge needs explicit written confirmation that it's free.",
};

const isCents = (n: unknown) => typeof n === "number" && Number.isSafeInteger(n) && n >= 0 && n <= 100_000;
const isDay = (s: unknown) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

/** Structural checks on a rule (no clock): every number sane, tiers strictly increasing. */
export function ruleProblem(origin: Pick<ShippingOrigin, "rule" | "zeroCostConfirmed">): OriginProblem | null {
  const r = origin.rule;
  if (!r) return "no-rates";
  let zero = false;
  if (r.kind === "per-item") {
    if (!isCents(r.firstItemCents) || !isCents(r.additionalItemCents)) return "invalid-rule";
    if (!Number.isInteger(r.maxItemsPerPackage) || r.maxItemsPerPackage < 1 || r.maxItemsPerPackage > 200) return "invalid-rule";
    zero = r.firstItemCents === 0;
  } else if (r.kind === "weight") {
    if (!Number.isInteger(r.packagingGrams) || r.packagingGrams < 0 || r.packagingGrams > 5000) return "invalid-rule";
    if (!Array.isArray(r.tiers) || r.tiers.length === 0 || r.tiers.length > 20) return "invalid-rule";
    let last = 0;
    for (const t of r.tiers) {
      if (!Number.isInteger(t.upToGrams) || t.upToGrams <= last || t.upToGrams > 30_000 || !isCents(t.cents)) return "invalid-rule";
      last = t.upToGrams;
    }
    zero = r.tiers.some((t) => t.cents === 0);
  } else return "invalid-rule";
  if (zero && origin.zeroCostConfirmed !== true) return "zero-cost-unconfirmed";
  return null;
}

/** Everything that doesn't depend on today's date (safe while pages are prerendered). */
export function staticOriginProblem(origin: ShippingOrigin | undefined, source?: FulfillmentSource): OriginProblem | null {
  if (!origin || !ORIGIN_ID.test(origin.id) || RESERVED_IDS.has(origin.id)) return "unknown-origin";
  if (source && origin.source !== source) return "source-mismatch";
  const rule = ruleProblem(origin);
  if (rule) return rule;
  if (!origin.verified || !isDay(origin.verified.on) || !origin.verified.by.trim() || !origin.verified.evidence.trim()) return "not-verified";
  const days = origin.processingBusinessDays;
  if (days === null || !Number.isInteger(days) || days < 1 || days > 30) return "no-processing-time";
  if (origin.source === "supplier" && !origin.agreementOnFile) return "no-supplier-agreement";
  return null;
}

/** Full readiness check at checkout time, including how old the verification is. */
export function originProblem(origin: ShippingOrigin | undefined, now: Date, source?: FulfillmentSource): OriginProblem | null {
  const p = staticOriginProblem(origin, source);
  if (p) return p;
  const verifiedAt = Date.parse(`${origin!.verified!.on}T00:00:00Z`);
  if (verifiedAt > now.getTime() + 86_400_000) return "not-verified"; // dated in the future: not a real verification
  if (now.getTime() - verifiedAt > origin!.reviewEveryDays * 86_400_000) return "verification-expired";
  return null;
}

export function findOrigin(registry: ShippingOrigin[], id: string | null): ShippingOrigin | undefined {
  return id ? registry.find((o) => o.id === id) : undefined;
}

/** For product pages: can this variant's shipping be quoted at all? (No clock — see originProblem for checkout.) */
export function variantShippingReady(variant: Pick<ProductVariant, "fulfillmentSource" | "fulfillmentOrigin">, registry = SHIPPING_ORIGINS): boolean {
  const source = variant.fulfillmentSource ?? "in_house";
  return staticOriginProblem(findOrigin(registry, originIdFor(variant)), source) === null;
}

/**
 * REAL origins, from src/commerce/data/shipping-origins.json (owner-managed:
 * prepare changes on the dashboard's Shipping page, which exports this file).
 * The rule is null until the owner enters verified rates (packed weights +
 * carrier costs for our own stock; each supplier's written rate card). Until
 * then, real products can't be checked out — by design. Any change gives a
 * new approval code, and live checkout stays closed until the owner approves
 * it (shipping-approval.ts).
 */
// (Last in the file: validation uses the helpers above.)
export const SHIPPING_ORIGINS: ShippingOrigin[] = validateOrigins(originsData);
