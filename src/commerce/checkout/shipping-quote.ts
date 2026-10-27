import type { FulfillmentSource } from "../types";
import { ORIGIN_ID, ORIGIN_PROBLEM_TEXT, findOrigin, originProblem, type ShippingOrigin } from "../origins";

/**
 * Cart-dependent shipping, calculated on the server (pure, no I/O).
 *
 * - Every place items ship from ("origin": our studio or a supplier) is ONE
 *   package. Items from the same origin share one base charge.
 * - Each package is priced from that origin's verified rule only. Nothing is
 *   guessed: an origin without verified rates, a recent verification, a
 *   committed processing time (and, for suppliers, a signed agreement) can't
 *   be quoted, and its items are refused with a plain explanation.
 * - The packages add up to ONE shipping charge, shown in the cart and on
 *   Stripe's page before the shopper pays. Nothing is ever charged later.
 */

export const MAX_PACKAGES_PER_ORDER = 5;

export interface QuoteLine {
  variantId: string;
  name: string;
  quantity: number;
  fulfillmentSource: FulfillmentSource;
  fulfillmentOrigin: string | null;
  weightGrams: number | null;
  /** Processing time shown on the product page (catalog), if it states one. */
  statedProcessingDays: number | null;
}

export interface PackageQuote {
  /** Fulfillment group id on the order (= origin id). */
  groupId: string;
  originId: string;
  source: FulfillmentSource;
  /** Public label, e.g. "FunkSquish" or "a FunkSquish supplier partner". */
  label: string;
  variantIds: string[];
  units: number;
  /** Items + packaging, when the rule is weight-based. */
  packedGrams: number | null;
  cents: number;
  /** Ship-by = this many business days after payment (the strictest promise in the package). */
  processingBusinessDays: number;
  militaryAddresses: boolean;
}

export interface ShippingQuote {
  packages: PackageQuote[];
  totalCents: number;
}

export type BlockReason = "shipping-unavailable" | "too-large" | "too-many-origins";

export interface BlockedLine {
  variantId: string;
  name: string;
  reason: BlockReason;
  /** Shopper-facing explanation. */
  message: string;
  /** Owner-facing detail (logs, owner tools). Never shown to shoppers. */
  ownerDetail: string;
}

export type QuoteResult =
  | { ok: true; quote: ShippingQuote }
  | { ok: false; blocked: BlockedLine[]; message: string; partial: ShippingQuote };

const unavailable = (l: QuoteLine, ownerDetail: string): BlockedLine => ({
  variantId: l.variantId,
  name: l.name,
  reason: "shipping-unavailable",
  message: `Shipping for ${l.name} isn't set up yet, so it can't be ordered right now. Please remove it to continue — the rest of your cart can still be ordered.`,
  ownerDetail,
});

function priceRule(origin: ShippingOrigin, lines: QuoteLine[]): { cents: number; packedGrams: number | null } | "too-large" {
  const rule = origin.rule!;
  const units = lines.reduce((n, l) => n + l.quantity, 0);
  if (rule.kind === "per-item") {
    if (units > rule.maxItemsPerPackage) return "too-large";
    return { cents: rule.firstItemCents + rule.additionalItemCents * (units - 1), packedGrams: null };
  }
  const grams = rule.packagingGrams + lines.reduce((g, l) => g + (l.weightGrams ?? 0) * l.quantity, 0);
  const tier = rule.tiers.find((t) => grams <= t.upToGrams);
  return tier ? { cents: tier.cents, packedGrams: grams } : "too-large";
}

/** Price the cart's shipping, one package per origin. */
export function quoteShipping(lines: QuoteLine[], registry: ShippingOrigin[], now: Date): QuoteResult {
  const blocked: BlockedLine[] = [];
  const byOrigin = new Map<string, QuoteLine[]>();
  for (const l of lines) {
    if (!l.fulfillmentOrigin || !ORIGIN_ID.test(l.fulfillmentOrigin)) {
      blocked.push(unavailable(l, ORIGIN_PROBLEM_TEXT["unknown-origin"]));
      continue;
    }
    byOrigin.set(l.fulfillmentOrigin, [...(byOrigin.get(l.fulfillmentOrigin) ?? []), l]);
  }

  const packages: PackageQuote[] = [];
  for (const [originId, group] of byOrigin) {
    const origin = findOrigin(registry, originId);
    const usable: QuoteLine[] = [];
    for (const l of group) {
      const problem = originProblem(origin, now, l.fulfillmentSource);
      if (problem) {
        blocked.push(unavailable(l, `${originId}: ${ORIGIN_PROBLEM_TEXT[problem]}`));
        continue;
      }
      if (l.statedProcessingDays !== null && l.statedProcessingDays < origin!.processingBusinessDays!) {
        blocked.push(unavailable(l, `${originId}: the product page promises ${l.statedProcessingDays} business days but this origin commits to ${origin!.processingBusinessDays}.`));
        continue;
      }
      if (origin!.rule!.kind === "weight" && (l.weightGrams === null || !Number.isInteger(l.weightGrams) || l.weightGrams <= 0)) {
        blocked.push(unavailable(l, `${originId}: the item's shipping weight is missing (weight-based rates).`));
        continue;
      }
      usable.push(l);
    }
    if (usable.length === 0) continue;

    if (packages.length >= MAX_PACKAGES_PER_ORDER) {
      for (const l of usable)
        blocked.push({
          variantId: l.variantId,
          name: l.name,
          reason: "too-many-origins",
          message: `Your cart has items shipping from more than ${MAX_PACKAGES_PER_ORDER} different places. Please remove ${l.name} and order it separately.`,
          ownerDetail: `more than ${MAX_PACKAGES_PER_ORDER} origins in one cart`,
        });
      continue;
    }

    const priced = priceRule(origin!, usable);
    if (priced === "too-large") {
      for (const l of usable)
        blocked.push({
          variantId: l.variantId,
          name: l.name,
          reason: "too-large",
          message: `The items shipping from ${origin!.publicLabel} won't fit in one package. Please lower the quantity of ${l.name} or place a second order.`,
          ownerDetail: `${originId}: over the largest package in the rule`,
        });
      continue;
    }
    packages.push({
      groupId: originId,
      originId,
      source: origin!.source,
      label: origin!.publicLabel,
      variantIds: usable.map((l) => l.variantId),
      units: usable.reduce((n, l) => n + l.quantity, 0),
      packedGrams: priced.packedGrams,
      cents: priced.cents,
      processingBusinessDays: Math.min(...usable.map((l) => l.statedProcessingDays ?? origin!.processingBusinessDays!)),
      militaryAddresses: origin!.militaryAddresses,
    });
  }

  const quote = { packages, totalCents: packages.reduce((s, p) => s + p.cents, 0) };
  if (blocked.length) return { ok: false, blocked, message: blocked[0].message, partial: quote };
  return { ok: true, quote };
}

/* ------------------------------ what the shopper sees ------------------------------ */

const days = (n: number) => `${n} business day${n === 1 ? "" : "s"}`;

/** Shown on Stripe's page (above the address form), so separate packages are disclosed before paying. */
export function packageNote(quote: ShippingQuote): string {
  const p = quote.packages;
  if (p.length === 0) return "";
  const parts =
    p.length === 1
      ? `Your order ships in one package from ${p[0].label}, within ${days(p[0].processingBusinessDays)} of payment.`
      : `Your order ships in ${p.length} separate packages, each with its own tracking email: ${p
          .map((x) => `from ${x.label} (ships within ${days(x.processingBusinessDays)})`)
          .join("; ")}. The shipping charge below covers all of them.`;
  const noMilitary = p.filter((x) => !x.militaryAddresses);
  const military = noMilitary.length
    ? ` Items from ${[...new Set(noMilitary.map((x) => x.label))].join(" and ")} can't be sent to APO/FPO/DPO addresses.`
    : "";
  return `${parts}${military}`;
}

export function shippingDisplayName(quote: ShippingQuote): string {
  const n = quote.packages.length;
  if (quote.totalCents === 0) return n > 1 ? `Free shipping (${n} packages)` : "Free shipping";
  return n > 1 ? `Shipping (${n} packages)` : "Shipping";
}

/* ------------------------------ stored on the Stripe session ------------------------------ */

/**
 * Compact record of the packages, stored in the Checkout Session's metadata so
 * the order knows each package's shipping charge and ship-by promise.
 * Format: v1;<groupId>:<h|s>:<cents>:<processing days>:<military 1|0>;...
 */
export function encodeShippingPlan(quote: ShippingQuote): string {
  return ["v1", ...quote.packages.map((p) => `${p.groupId}:${p.source === "supplier" ? "s" : "h"}:${p.cents}:${p.processingBusinessDays}:${p.militaryAddresses ? 1 : 0}`)].join(";");
}

export interface PlannedPackage {
  groupId: string;
  source: FulfillmentSource;
  cents: number;
  processingBusinessDays: number;
  militaryAddresses: boolean;
}

/** Parse the session metadata; anything malformed → null (the order is then flagged for review). */
export function decodeShippingPlan(value: unknown): PlannedPackage[] | null {
  if (typeof value !== "string" || value.length > 500) return null;
  const [version, ...items] = value.split(";");
  if (version !== "v1" || items.length === 0 || items.length > MAX_PACKAGES_PER_ORDER) return null;
  const out: PlannedPackage[] = [];
  for (const item of items) {
    const m = /^([a-z][a-z0-9-]{1,30}):([hs]):(\d{1,6}):(\d{1,2}):([01])$/.exec(item);
    if (!m) return null;
    const processing = Number(m[4]);
    if (processing < 1 || processing > 30 || out.some((p) => p.groupId === m[1])) return null;
    out.push({ groupId: m[1], source: m[2] === "s" ? "supplier" : "in_house", cents: Number(m[3]), processingBusinessDays: processing, militaryAddresses: m[5] === "1" });
  }
  return out;
}
