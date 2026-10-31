import { updateWithRetry, type KvStore } from "../../lib/storage/kv-core";
import { newId } from "../catalog-admin/record";

/**
 * Private supplier records (owner dashboard only — never public, never in
 * GitHub). Every fact is what the owner entered from the supplier's own
 * documents or messages; anything not entered is `null` and shown as
 * "Missing", never estimated.
 *
 *  supplier/<id>                 the supplier
 *  supplier-doc/<id>/<docId>     a private document's details (file in owner-media under s/<id>/…)
 */
export const SUPPLIER_STATUSES = ["prospect", "sampling", "negotiating", "approved", "paused", "ended"] as const;
export type SupplierStatus = (typeof SUPPLIER_STATUSES)[number];
export const AGREEMENT_STATUSES = ["none", "draft", "sent", "signed", "expired"] as const;
export type AgreementStatus = (typeof AGREEMENT_STATUSES)[number];
export type TriState = "yes" | "no" | "unknown";
export const CHANNELS = ["website", "tiktok-shop", "tiktok-live", "wholesale", "markets"] as const;

export interface SupplierContact {
  name: string | null;
  role: string | null;
  email: string | null;
  phone: string | null;
  /** e.g. WhatsApp, WeChat, Alibaba messages. */
  channel: string | null;
}

export interface ContactLogEntry {
  id: string;
  at: string;
  channel: "email" | "call" | "message" | "meeting" | "other";
  summary: string;
  followUpOn: string | null;
  done: boolean;
}

/** A written price for one product, before (or instead of) linking it to a SKU. */
export interface SupplierQuote {
  id: string;
  product: string;
  supplierSku: string | null;
  productType: string | null;
  unitCostCents: number | null;
  /** Landed cost per unit if the quote or your own calculation gives one (freight, duties, fees). */
  landedCostCents: number | null;
  moq: number | null;
  receivedOn: string | null;
  /** Where the number came from: "price list PDF 2026-10-20", "email from Amy"… */
  source: string | null;
}

export interface Supplier {
  id: string;
  rev: number;
  name: string;
  website: string | null;
  country: string | null;
  status: SupplierStatus;
  contacts: SupplierContact[];
  agreement: {
    status: AgreementStatus;
    signedOn: string | null;
    renewOn: string | null;
    /** Private file name / reference of the signed agreement. */
    reference: string | null;
    /** The agreement limits how they may use customer names and addresses (needed before sharing any). */
    coversCustomerData: boolean;
    coversShipTimes: boolean;
    coversRates: boolean;
  };
  terms: {
    moq: number | null;
    samplePriceCents: number | null;
    samplePolicy: string | null;
    dropship: TriState;
    /** Business days from order to handing to the carrier, as they committed. */
    processingDays: number | null;
    shipsFrom: string | null;
    firstItemShippingCents: number | null;
    additionalItemShippingCents: number | null;
    shippingNote: string | null;
    tracking: TriState;
    returnPolicy: string | null;
    paymentTerms: string | null;
    productTypes: string[];
    authorizedChannels: (typeof CHANNELS)[number][];
    /** Where these terms came from. */
    source: string | null;
  };
  compliance: { status: "missing" | "requested" | "received" | "verified"; notes: string | null };
  /** Shipping origin id (Shipping page) this supplier ships from, once set up. */
  originId: string | null;
  quotes: SupplierQuote[];
  log: ContactLogEntry[];
  notes: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export const supplierKey = (id: string) => `supplier/${id}`;
export const SUPPLIER_ID = /^s_[a-z0-9]{6,20}$/;

export function newSupplier(name: string, now = new Date()): Supplier {
  const at = now.toISOString();
  return {
    id: newId("s_"),
    rev: 1,
    name: name.trim().slice(0, 100),
    website: null,
    country: null,
    status: "prospect",
    contacts: [],
    agreement: { status: "none", signedOn: null, renewOn: null, reference: null, coversCustomerData: false, coversShipTimes: false, coversRates: false },
    terms: { moq: null, samplePriceCents: null, samplePolicy: null, dropship: "unknown", processingDays: null, shipsFrom: null, firstItemShippingCents: null, additionalItemShippingCents: null, shippingNote: null, tracking: "unknown", returnPolicy: null, paymentTerms: null, productTypes: [], authorizedChannels: [], source: null },
    compliance: { status: "missing", notes: null },
    originId: null,
    quotes: [],
    log: [],
    notes: null,
    archived: false,
    createdAt: at,
    updatedAt: at,
  };
}

export async function listSuppliers(store: KvStore): Promise<Supplier[]> {
  const keys = (await store.list("supplier/")).filter((k) => !k.slice(9).includes("/"));
  const rows = await Promise.all(keys.map(async (k) => ((await (store.getListed ?? store.get).call(store, k)) as { value: Supplier } | null)?.value));
  return rows.filter((s): s is Supplier => !!s).sort((a, b) => a.name.localeCompare(b.name));
}

export async function getSupplier(store: KvStore, id: string): Promise<Supplier | null> {
  return SUPPLIER_ID.test(id) ? ((await store.get<Supplier>(supplierKey(id)))?.value ?? null) : null;
}

export async function createSupplier(store: KvStore, name: string, now = new Date()): Promise<{ ok: true; supplier: Supplier } | { ok: false; error: string }> {
  if (!name.trim()) return { ok: false, error: "Give the supplier a name." };
  const existing = await listSuppliers(store);
  if (existing.some((s) => s.name.toLowerCase() === name.trim().toLowerCase())) return { ok: false, error: "A supplier with that name already exists." };
  const s = newSupplier(name, now);
  return (await store.create(supplierKey(s.id), s)) ? { ok: true, supplier: s } : { ok: false, error: "Couldn't save. Try again." };
}

/** Change a supplier only if nobody saved it since `rev` (same rule as products). */
export async function saveSupplier(store: KvStore, id: string, rev: number, fn: (s: Supplier) => Supplier | string, now = new Date()): Promise<{ ok: true; supplier: Supplier } | { ok: false; error: string }> {
  let out: { ok: true; supplier: Supplier } | { ok: false; error: string } = { ok: false, error: "That supplier no longer exists." };
  await updateWithRetry<Supplier>(store, supplierKey(id), (cur) => {
    if (!cur) return undefined;
    if (cur.rev !== rev) return ((out = { ok: false, error: "This supplier was changed somewhere else since you opened it. Reload and try again." }), undefined);
    const next = fn(structuredClone(cur));
    if (typeof next === "string") return ((out = { ok: false, error: next }), undefined);
    const saved = { ...next, rev: cur.rev + 1, updatedAt: now.toISOString() };
    out = { ok: true, supplier: saved };
    return saved;
  });
  return out;
}

/* ------------------------------ form parsing ------------------------------ */

type F = Record<string, string>;
const t = (f: F, k: string, max = 200) => (f[k] ?? "").replace(/\r\n/g, "\n").trim().slice(0, max) || null;
const tri = (v: string | undefined): TriState => (v === "yes" || v === "no" ? v : "unknown");
const day = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
function cents(v: string | undefined): number | null | typeof NaN {
  const s = (v ?? "").replace(/[$,\s]/g, "");
  if (!s) return null;
  return /^\d{1,6}(\.\d{1,2})?$/.test(s) ? Math.round(Number(s) * 100) : NaN;
}
function whole(v: string | undefined, max: number): number | null | typeof NaN {
  const s = (v ?? "").trim();
  if (!s) return null;
  return /^\d+$/.test(s) && Number(s) <= max ? Number(s) : NaN;
}
const isEmail = (s: string | null) => !s || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
const isUrl = (s: string | null) => {
  if (!s) return true;
  try {
    return ["https:", "http:"].includes(new URL(s).protocol);
  } catch {
    return false;
  }
};

export function applySupplierForm(s: Supplier, f: F): Supplier | string {
  const errors: string[] = [];
  const name = t(f, "name", 100);
  if (!name) errors.push("Name is required.");
  const website = t(f, "website", 300);
  if (!isUrl(website)) errors.push("Website must be a web address (https://…).");
  const status = (f.status ?? s.status) as SupplierStatus;
  if (!SUPPLIER_STATUSES.includes(status)) errors.push("Pick a status.");
  const agreementStatus = (f.agreementStatus ?? s.agreement.status) as AgreementStatus;
  if (!AGREEMENT_STATUSES.includes(agreementStatus)) errors.push("Pick an agreement status.");
  const nums = {
    moq: whole(f.moq, 1_000_000),
    samplePriceCents: cents(f.samplePrice),
    processingDays: whole(f.processingDays, 60),
    firstItemShippingCents: cents(f.firstItemShipping),
    additionalItemShippingCents: cents(f.additionalItemShipping),
  };
  for (const [k, v] of Object.entries(nums)) if (Number.isNaN(v)) errors.push(`${k}: enter a number (money as 12.50).`);
  const contacts: SupplierContact[] = [0, 1, 2]
    .map((i) => ({ name: t(f, `c${i}name`, 100), role: t(f, `c${i}role`, 60), email: t(f, `c${i}email`, 160), phone: t(f, `c${i}phone`, 40), channel: t(f, `c${i}channel`, 60) }))
    .filter((c) => c.name || c.email || c.phone || c.channel);
  for (const c of contacts) if (!isEmail(c.email)) errors.push(`Contact email "${c.email}" doesn't look right.`);
  const signedOn = day(t(f, "signedOn", 10));
  if (agreementStatus === "signed" && !signedOn) errors.push("A signed agreement needs its signing date.");
  if (errors.length) return errors.join(" ");
  return {
    ...s,
    name: name!,
    website,
    country: t(f, "country", 60),
    status,
    contacts,
    agreement: {
      status: agreementStatus,
      signedOn,
      renewOn: day(t(f, "renewOn", 10)),
      reference: t(f, "agreementReference", 200),
      coversCustomerData: agreementStatus === "signed" && f.coversCustomerData === "on",
      coversShipTimes: agreementStatus === "signed" && f.coversShipTimes === "on",
      coversRates: agreementStatus === "signed" && f.coversRates === "on",
    },
    terms: {
      moq: nums.moq as number | null,
      samplePriceCents: nums.samplePriceCents as number | null,
      samplePolicy: t(f, "samplePolicy", 300),
      dropship: tri(f.dropship),
      processingDays: nums.processingDays as number | null,
      shipsFrom: t(f, "shipsFrom", 100),
      firstItemShippingCents: nums.firstItemShippingCents as number | null,
      additionalItemShippingCents: nums.additionalItemShippingCents as number | null,
      shippingNote: t(f, "shippingNote", 300),
      tracking: tri(f.tracking),
      returnPolicy: t(f, "returnPolicy", 500),
      paymentTerms: t(f, "paymentTerms", 300),
      productTypes: (t(f, "productTypes", 300) ?? "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean).slice(0, 12),
      authorizedChannels: CHANNELS.filter((c) => f[`ch-${c}`] === "on"),
      source: t(f, "termsSource", 300),
    },
    compliance: { status: (["missing", "requested", "received", "verified"].includes(f.complianceStatus) ? f.complianceStatus : s.compliance.status) as Supplier["compliance"]["status"], notes: t(f, "complianceNotes", 500) },
    originId: t(f, "originId", 32)?.toLowerCase().match(/^[a-z][a-z0-9-]{1,30}$/)?.[0] ?? null,
    notes: t(f, "notes", 2000),
  };
}

export function parseQuote(f: F): SupplierQuote | string {
  const product = t(f, "qProduct", 120);
  if (!product) return "Name the product the quote is for.";
  const unit = cents(f.qUnitCost);
  const landed = cents(f.qLandedCost);
  const moq = whole(f.qMoq, 1_000_000);
  if ([unit, landed, moq].some((v) => Number.isNaN(v))) return "Quote numbers: money as 2.40, MOQ as a whole number.";
  return { id: newId("q_"), product, supplierSku: t(f, "qSku", 60), productType: t(f, "qType", 60)?.toLowerCase() ?? null, unitCostCents: unit as number | null, landedCostCents: landed as number | null, moq: moq as number | null, receivedOn: day(t(f, "qReceived", 10)), source: t(f, "qSource", 200) };
}

export function parseLogEntry(f: F, now = new Date()): ContactLogEntry | string {
  const summary = t(f, "summary", 1000);
  if (!summary) return "Write what was said or agreed.";
  const channel = (["email", "call", "message", "meeting", "other"].includes(f.channel) ? f.channel : "other") as ContactLogEntry["channel"];
  return { id: newId("l_"), at: now.toISOString(), channel, summary, followUpOn: day(t(f, "followUpOn", 10)), done: false };
}

/** Can customer names/addresses be shared with this supplier at all? Only under a signed agreement that limits their use. */
export function mayShareCustomerData(s: Supplier, now = new Date()): { ok: true } | { ok: false; reason: string } {
  if (s.agreement.status !== "signed") return { ok: false, reason: "There's no signed agreement with this supplier." };
  if (!s.agreement.coversCustomerData) return { ok: false, reason: "The agreement isn't marked as limiting how they use customer details." };
  if (s.agreement.renewOn && s.agreement.renewOn < now.toISOString().slice(0, 10)) return { ok: false, reason: `The agreement was due for renewal on ${s.agreement.renewOn}.` };
  if (s.status === "ended" || s.status === "paused" || s.archived) return { ok: false, reason: `This supplier is ${s.archived ? "archived" : s.status}.` };
  return { ok: true };
}
