import { updateWithRetry, type KvStore } from "../lib/storage/kv-core";
import { ORIGIN_ID, ORIGIN_PROBLEM_TEXT, originProblem, ruleProblem, staticOriginProblem, validateOrigins, type ShippingOrigin, type ShippingRule } from "./origins";
import { shippingTableFingerprint } from "./shipping-approval";
import { quoteShipping, type QuoteLine, type QuoteResult } from "./checkout/shipping-quote";

/**
 * Shipping set-up drafts (owner dashboard, private).
 *
 * The rates customers pay come from src/commerce/data/shipping-origins.json.
 * Changing them is deliberately a reviewed step, because it changes what
 * customers are charged: prepare and check changes here (validation, an
 * example-cart preview, the new approval code), then download the file and
 * replace it in the repository (a small PR — GitHub's web editor is enough),
 * then approve the new code for live checkout (STRIPE_LIVE_SHIPPING_TABLE).
 * Live checkout stays closed for any origin that isn't verified, and for the
 * whole table until its exact approval code is set.
 *
 * Private notes (carrier service, packaging, where the evidence is) stay in
 * the draft and are never written to the public file.
 */
export interface DraftOrigin extends ShippingOrigin {
  /** Private: e.g. "USPS Ground Advantage", "supplier's ePacket". */
  carrierService: string | null;
  /** Private: packaging, restrictions, anything to remember. */
  notes: string | null;
}

export interface ShippingDraft {
  rev: number;
  updatedAt: string;
  origins: DraftOrigin[];
  history: { at: string; summary: string }[];
}

const KEY = "shipping/draft";

export function draftFrom(live: ShippingOrigin[]): ShippingDraft {
  return { rev: 0, updatedAt: new Date(0).toISOString(), origins: live.map((o) => ({ ...structuredClone(o), carrierService: null, notes: null })), history: [] };
}

export async function loadDraft(store: KvStore, live: ShippingOrigin[]): Promise<ShippingDraft> {
  return (await store.get<ShippingDraft>(KEY))?.value ?? draftFrom(live);
}

export async function saveDraft(store: KvStore, rev: number, summary: string, fn: (d: ShippingDraft) => ShippingDraft | string, live: ShippingOrigin[], now = new Date()): Promise<{ ok: true; draft: ShippingDraft } | { ok: false; error: string }> {
  let out: { ok: true; draft: ShippingDraft } | { ok: false; error: string } = { ok: false, error: "Couldn't save." };
  await updateWithRetry<ShippingDraft>(store, KEY, (cur) => {
    const base = cur ?? draftFrom(live);
    if (base.rev !== rev) return ((out = { ok: false, error: "The shipping draft changed somewhere else since you opened it. Reload and try again." }), undefined);
    const next = fn(structuredClone(base));
    if (typeof next === "string") return ((out = { ok: false, error: next }), undefined);
    const at = now.toISOString();
    const saved = { ...next, rev: base.rev + 1, updatedAt: at, history: [{ at, summary }, ...base.history].slice(0, 40) };
    out = { ok: true, draft: saved };
    return saved;
  });
  return out;
}

/* ------------------------------ form parsing ------------------------------ */

type F = Record<string, string>;
const cents = (v: string | undefined): number | null => {
  const s = (v ?? "").replace(/[$,\s]/g, "");
  if (!s) return null;
  return /^\d{1,4}(\.\d{1,2})?$/.test(s) ? Math.round(Number(s) * 100) : NaN;
};
const whole = (v: string | undefined): number | null => {
  const s = (v ?? "").trim();
  if (!s) return null;
  return /^\d{1,6}$/.test(s) ? Number(s) : NaN;
};
const day = (s: string | undefined) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null);

/** Weight tiers typed one per line: "250 = 4.75" means up to 250 g costs $4.75. */
export function parseTiers(text: string): { upToGrams: number; cents: number }[] | string {
  const tiers: { upToGrams: number; cents: number }[] = [];
  for (const raw of text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)) {
    const m = /^(\d{1,5})\s*(?:g)?\s*[=:,]\s*\$?(\d{1,4}(?:\.\d{1,2})?)$/.exec(raw);
    if (!m) return `Weight tier "${raw}": write it like "250 = 4.75" (up to 250 g costs $4.75).`;
    tiers.push({ upToGrams: Number(m[1]), cents: Math.round(Number(m[2]) * 100) });
  }
  return tiers;
}

export function parseOrigin(f: F, opts: { supplierNames: string[]; existing: DraftOrigin | null; now?: Date }): DraftOrigin | string {
  const errors: string[] = [];
  const now = opts.now ?? new Date();
  const id = (opts.existing?.id ?? (f.id ?? "").trim().toLowerCase()) as string;
  if (!ORIGIN_ID.test(id)) errors.push("Origin id: lowercase letters, digits and dashes, e.g. supplier-a (it's public, so never the supplier's name).");
  const source = (opts.existing?.source ?? f.source) as ShippingOrigin["source"];
  if (source !== "in_house" && source !== "supplier") errors.push("Who ships from here: you or a supplier.");
  const publicLabel = (f.publicLabel ?? "").trim().slice(0, 60);
  if (!publicLabel) errors.push("Public label is required (customers see it).");
  const lower = publicLabel.toLowerCase();
  if (opts.supplierNames.some((n) => n && lower.includes(n.toLowerCase()))) errors.push("The public label can't contain a supplier's name — customers only see e.g. \"a FunkSquish supplier partner\".");
  if (ORIGIN_ID.test(id) && opts.supplierNames.some((n) => id.includes(n.toLowerCase().replace(/[^a-z0-9]+/g, "-")))) errors.push("The origin id can't contain a supplier's name.");

  let rule: ShippingRule | null = null;
  if (f.ruleKind === "per-item") {
    const first = cents(f.firstItem);
    const extra = cents(f.additionalItem);
    const max = whole(f.maxItems);
    if ([first, extra, max].some((v) => v === null || Number.isNaN(v))) errors.push("Per-item rates: first item, each extra item (dollars) and the most items per package.");
    else rule = { kind: "per-item", firstItemCents: first!, additionalItemCents: extra!, maxItemsPerPackage: max! };
  } else if (f.ruleKind === "weight") {
    const packaging = whole(f.packagingGrams);
    const tiers = parseTiers(f.tiers ?? "");
    if (packaging === null || Number.isNaN(packaging)) errors.push("Packaging weight (grams) is needed for weight-based rates.");
    if (typeof tiers === "string") errors.push(tiers);
    else if (!tiers.length) errors.push("Add at least one weight tier.");
    if (packaging !== null && !Number.isNaN(packaging) && typeof tiers !== "string" && tiers.length) rule = { kind: "weight", packagingGrams: packaging, tiers };
  }
  const zeroCostConfirmed = f.zeroCostConfirmed === "on";
  if (rule) {
    const p = ruleProblem({ rule, zeroCostConfirmed });
    if (p) errors.push(ORIGIN_PROBLEM_TEXT[p]);
  }

  const verifiedOn = day(f.verifiedOn);
  const verifiedBy = (f.verifiedBy ?? "").trim().slice(0, 60);
  const evidence = (f.evidence ?? "").trim().slice(0, 200);
  let verified: ShippingOrigin["verified"] = null;
  if (verifiedOn || verifiedBy || evidence) {
    if (!rule) errors.push("Rates can only be marked verified once they're entered.");
    if (!verifiedOn || !verifiedBy || !evidence) errors.push("Verification needs the date, who checked, and where the evidence is (a carrier quote, the supplier's written rate card…).");
    else if (Date.parse(`${verifiedOn}T00:00:00Z`) > now.getTime() + 86_400_000) errors.push("The verification date can't be in the future.");
    else verified = { on: verifiedOn, by: verifiedBy, evidence };
  }
  const review = whole(f.reviewEveryDays) ?? 90;
  if (Number.isNaN(review) || review < 7 || review > 366) errors.push("Re-check rates every 7–366 days.");
  const processing = whole(f.processingBusinessDays);
  if (processing !== null && (Number.isNaN(processing) || processing < 1 || processing > 30)) errors.push("Processing time: 1–30 business days.");
  const agreementOnFile = source === "in_house" ? true : f.agreementOnFile === "on";
  if (errors.length) return errors.join(" ");
  return {
    id,
    source,
    publicLabel,
    rule,
    verified,
    reviewEveryDays: review,
    processingBusinessDays: processing,
    agreementOnFile,
    militaryAddresses: f.militaryAddresses === "on",
    ...(zeroCostConfirmed ? { zeroCostConfirmed: true } : {}),
    carrierService: (f.carrierService ?? "").trim().slice(0, 100) || null,
    notes: (f.notes ?? "").trim().slice(0, 1000) || null,
  };
}

/** The public table (what shipping-origins.json will contain): private notes removed, validated. */
export function publicTable(d: ShippingDraft): ShippingOrigin[] {
  return validateOrigins(
    d.origins.map((o) => {
      const pub: ShippingOrigin = { id: o.id, source: o.source, publicLabel: o.publicLabel, rule: o.rule, verified: o.verified, reviewEveryDays: o.reviewEveryDays, processingBusinessDays: o.processingBusinessDays, agreementOnFile: o.agreementOnFile, militaryAddresses: o.militaryAddresses };
      return o.zeroCostConfirmed ? { ...pub, zeroCostConfirmed: true } : pub;
    }),
  );
}

export const exportJson = (d: ShippingDraft) => JSON.stringify(publicTable(d), null, 2) + "\n";

export interface OriginStatus {
  origin: DraftOrigin;
  problem: string | null;
  changed: string[];
}

const LABELS: Record<string, string> = { publicLabel: "label", rule: "rates", verified: "verification", reviewEveryDays: "re-check interval", processingBusinessDays: "processing time", agreementOnFile: "agreement", militaryAddresses: "APO/FPO/DPO", zeroCostConfirmed: "free-shipping confirmation", source: "who ships" };

/** Each draft origin: what blocks checkout, and what's different from the live table. */
export function draftStatus(d: ShippingDraft, live: ShippingOrigin[], now = new Date()): { origins: OriginStatus[]; removed: string[]; draftFingerprint: string; liveFingerprint: string; unchanged: boolean } {
  const table = publicTable(d);
  const origins = d.origins.map((o, i) => {
    const l = live.find((x) => x.id === o.id);
    const pub = table[i] as unknown as Record<string, unknown>;
    const changed = !l ? ["new origin"] : Object.keys(LABELS).filter((k) => JSON.stringify(pub[k] ?? null) !== JSON.stringify((l as unknown as Record<string, unknown>)[k] ?? null)).map((k) => LABELS[k]);
    const p = originProblem(table[i], now, o.source) ?? staticOriginProblem(table[i], o.source);
    return { origin: o, problem: p ? ORIGIN_PROBLEM_TEXT[p] : null, changed };
  });
  const draftFingerprint = shippingTableFingerprint(table);
  const liveFingerprint = shippingTableFingerprint(live);
  return { origins, removed: live.filter((l) => !d.origins.some((o) => o.id === l.id)).map((l) => l.id), draftFingerprint, liveFingerprint, unchanged: draftFingerprint === liveFingerprint };
}

/* ------------------------------ example-cart preview ------------------------------ */

/**
 * Price an EXAMPLE cart against the draft. Example items are typed on the
 * page (weight and quantity) and labeled as examples everywhere they appear.
 */
export function previewQuote(d: ShippingDraft, items: { originId: string; grams: number | null; quantity: number }[], now = new Date()): QuoteResult & { unverified: string[] } {
  const live = publicTable(d);
  // Price draft rates even before they're verified (the preview is for checking them): the page
  // lists those origins as "not verified", and real checkout still refuses them.
  const unverified = live.filter((o) => o.rule && originProblem(o, now, o.source) !== null).map((o) => o.id);
  const table = live.map((o) => (o.rule && unverified.includes(o.id) ? { ...o, verified: { on: now.toISOString().slice(0, 10), by: "preview", evidence: "preview" }, agreementOnFile: true, processingBusinessDays: o.processingBusinessDays ?? 1 } : o));
  const lines: QuoteLine[] = items.map((it, i) => {
    const o = table.find((x) => x.id === it.originId);
    return { variantId: `example-${i + 1}`, name: `Example item ${i + 1}`, quantity: it.quantity, fulfillmentSource: o?.source ?? "in_house", fulfillmentOrigin: it.originId, weightGrams: it.grams, statedProcessingDays: null };
  });
  return { ...quoteShipping(lines, table, now), unverified };
}
