import { randomBytes } from "node:crypto";
import type { CategorySlug, FulfillmentSource, Product, ProductMedia, ProductVariant, TextureId } from "../types";
import { paletteFrom } from "./palette";

/**
 * A product as the owner manages it in the dashboard (server-only data).
 *
 *  - `product` holds the PUBLIC fields, in exactly the shape the storefront
 *    uses (src/commerce/types.ts). Only these ever reach a catalog release.
 *  - `private` holds costs, supplier links, compliance documents and notes.
 *    It never leaves the private store (and the public validator refuses
 *    private-looking keys anyway).
 *
 * Every save bumps `rev`; a save made from an older copy of the form is
 * refused, so two tabs (or two people) can't silently overwrite each other.
 */
export type RecordStatus = "draft" | "published" | "archived";
export type ComplianceStatus = "missing" | "requested" | "received" | "verified";
export const COMPLIANCE_STATUSES: ComplianceStatus[] = ["missing", "requested", "received", "verified"];

export interface PrivateVariant {
  /** What one unit costs you from the supplier (invoice or written quote), in cents. */
  costCents: number | null;
  /** Unit cost including inbound freight, duties and fees, if you know it. */
  landedCostCents: number | null;
  /** You checked the cost against the invoice / quote. */
  costVerified: boolean;
  /** You confirmed the selling price (and the basis for any "was" price). */
  priceVerified: boolean;
  supplierId: string | null;
  supplierSku: string | null;
  invoiceRef: string | null;
  /** Evidence that a compare-at ("was") price was a real recent price (16 CFR 233.1). */
  compareAtBasis: string | null;
}

export interface PrivateProduct {
  variants: Record<string, PrivateVariant>;
  compliance: {
    status: ComplianceStatus;
    /** Children's Product Certificate file name / reference (kept privately, e.g. private/compliance/…). */
    cpcFile: string | null;
    testReportFile: string | null;
    testLab: string | null;
    testDate: string | null;
    /** Photo of the permanent tracking label on the product/packaging. */
    trackingLabelPhoto: string | null;
  };
  /** Every photo/video is of the real product (your own, or licensed from the supplier in writing). */
  photosAuthentic: boolean;
  /** Warnings were checked against the real label (an empty list is then a decision, not a gap). */
  warningsReviewed: boolean;
  /** Weights and box sizes were measured on the real packed product. */
  shippingMeasured: boolean;
  notes: string | null;
}

export interface ProductRecord {
  id: string;
  rev: number;
  createdAt: string;
  updatedAt: string;
  status: RecordStatus;
  product: Product;
  private: PrivateProduct;
  /** `rev` that's in the live catalog, or null if it has never been published. */
  publishedRev: number | null;
  publishedAt: string | null;
  history: { at: string; summary: string }[];
}

export const CATEGORY_SLUGS: CategorySlug[] = ["fruity-slushies", "jelly-squishies", "crunchy-squishies", "cute-collectibles"];
export const TEXTURE_IDS: TextureId[] = ["soft", "slow-rise", "jelly", "crunchy", "buttery"];
const ART_FOR: Record<CategorySlug, Product["art"]> = { "fruity-slushies": "slushie", "jelly-squishies": "jelly", "crunchy-squishies": "crunchy", "cute-collectibles": "capsule" };

export const PRODUCT_ID = /^[a-z0-9][a-z0-9_-]{1,63}$/;
export const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const SKU = /^[A-Za-z0-9][A-Za-z0-9._-]{1,39}$/;
const ALPHA = "abcdefghjkmnpqrstuvwxyz23456789";
export const newId = (prefix: string) => `${prefix}${Array.from(randomBytes(10), (b) => ALPHA[b % ALPHA.length]).join("")}`;

export function emptyPrivateVariant(): PrivateVariant {
  return { costCents: null, landedCostCents: null, costVerified: false, priceVerified: false, supplierId: null, supplierSku: null, invoiceRef: null, compareAtBasis: null };
}

export function emptyPrivate(): PrivateProduct {
  return {
    variants: {},
    compliance: { status: "missing", cpcFile: null, testReportFile: null, testLab: null, testDate: null, trackingLabelPhoto: null },
    photosAuthentic: false,
    warningsReviewed: false,
    shippingMeasured: false,
    notes: null,
  };
}

export const publicationFor = (s: RecordStatus): Product["publication"] => (s === "published" ? "published" : s === "archived" ? "archived" : "draft");

/** The public product for a release: only public fields, publication taken from the record's status. */
export function toPublicProduct(r: ProductRecord): Product {
  const p = r.product;
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    category: p.category,
    publication: publicationFor(r.status),
    shortDescription: p.shortDescription,
    description: p.description,
    media: p.media.map((m) => ({ type: m.type, src: m.src, alt: m.alt, width: m.width, height: m.height, ...(m.poster ? { poster: m.poster } : {}), ...(m.captions ? { captions: m.captions } : {}) })),
    art: p.art,
    variants: p.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      name: v.name,
      swatch: v.swatch,
      palette: v.palette,
      price: v.price,
      compareAtPrice: v.compareAtPrice,
      inventory: { tracked: v.inventory.tracked, available: v.inventory.available },
      weightGrams: v.weightGrams,
      dimensions: v.dimensions,
      externalPurchaseUrl: v.externalPurchaseUrl,
      ...(v.fulfillmentSource ? { fulfillmentSource: v.fulfillmentSource } : {}),
      ...(v.fulfillmentOrigin ? { fulfillmentOrigin: v.fulfillmentOrigin } : {}),
    })),
    specs: { ...p.specs },
    safety: { ...p.safety, warnings: [...p.safety.warnings], careInstructions: [...p.safety.careInstructions] },
    tags: [...p.tags],
    ...(p.textures?.length ? { textures: [...p.textures] } : {}),
    ...(p.salesTerms && Object.keys(p.salesTerms).length ? { salesTerms: { ...p.salesTerms } } : {}),
    featuredRank: p.featuredRank,
    createdAt: p.createdAt,
  };
}

/* ------------------------------ form parsing ------------------------------ */

export type Fields = Record<string, string>;
export type Parsed<T> = { ok: true; value: T } | { ok: false; errors: string[] };

const text = (f: Fields, k: string, max: number) => (f[k] ?? "").replace(/\r\n/g, "\n").trim().slice(0, max);
const nullable = (f: Fields, k: string, max = 200) => text(f, k, max) || null;
const lines = (f: Fields, k: string, maxItems = 20, maxLen = 300) =>
  text(f, k, maxItems * (maxLen + 2))
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, maxItems)
    .map((s) => s.slice(0, maxLen));
const checked = (f: Fields, k: string) => f[k] === "on" || f[k] === "true" || f[k] === "yes";

/** "$12.50" / "12.5" / "12" → 1250 cents. Empty → null. Anything else → NaN (an error). */
export function dollarsToCents(v: string | undefined): number | null {
  const s = (v ?? "").replace(/[$,\s]/g, "");
  if (!s) return null;
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(s)) return NaN;
  return Math.round(Number(s) * 100);
}
function wholeNumber(v: string | undefined, max: number): number | null {
  const s = (v ?? "").trim();
  if (!s) return null;
  if (!/^\d+$/.test(s) || Number(s) > max) return NaN;
  return Number(s);
}
function decimal(v: string | undefined, max: number): number | null {
  const s = (v ?? "").trim();
  if (!s) return null;
  if (!/^\d{1,5}(\.\d{1,2})?$/.test(s) || Number(s) > max) return NaN;
  return Number(s);
}

export interface BasicsInput {
  name: string;
  slug: string;
  category: CategorySlug;
  shortDescription: string;
  description: string;
  tags: string[];
  textures: TextureId[];
  featuredRank: number;
  material: string | null;
  fill: string | null;
  texture: string | null;
  sizeDescription: string | null;
  finalSaleOnceOpened: boolean | null;
  processingBusinessDays: number | null;
}

export function parseBasics(f: Fields): Parsed<BasicsInput> {
  const errors: string[] = [];
  const name = text(f, "name", 80);
  const slug = text(f, "slug", 60).toLowerCase();
  const category = text(f, "category", 40) as CategorySlug;
  const shortDescription = text(f, "shortDescription", 160);
  const description = text(f, "description", 4000);
  if (!name) errors.push("Name is required.");
  if (!SLUG.test(slug)) errors.push("Web address (slug): lowercase letters, numbers and dashes, e.g. berry-burst-slushie.");
  if (!CATEGORY_SLUGS.includes(category)) errors.push("Pick a category.");
  const tags = text(f, "tags", 400)
    .split(",")
    .map((t) => t.trim().toLowerCase().replace(/\s+/g, "-"))
    .filter((t) => /^[a-z0-9-]{1,30}$/.test(t))
    .slice(0, 12);
  const textures = TEXTURE_IDS.filter((t) => checked(f, `texture-${t}`));
  const rank = wholeNumber(f.featuredRank, 999);
  if (Number.isNaN(rank)) errors.push("Featured order: a whole number from 0 to 999.");
  const days = wholeNumber(f.processingBusinessDays, 30);
  if (Number.isNaN(days) || days === 0) errors.push("Processing time: a whole number of business days from 1 to 30, or empty for the standard 2.");
  const fs = f.finalSaleOnceOpened;
  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      name,
      slug,
      category,
      shortDescription,
      description,
      tags,
      textures,
      featuredRank: rank ?? 100,
      material: nullable(f, "material"),
      fill: nullable(f, "fill"),
      texture: nullable(f, "texture"),
      sizeDescription: nullable(f, "sizeDescription"),
      finalSaleOnceOpened: fs === "yes" ? true : fs === "no" ? false : null,
      processingBusinessDays: days,
    },
  };
}

export function applyBasics(r: ProductRecord, b: BasicsInput): ProductRecord {
  const product: Product = {
    ...r.product,
    name: b.name,
    slug: b.slug,
    category: b.category,
    art: ART_FOR[b.category],
    shortDescription: b.shortDescription,
    description: b.description,
    tags: b.tags,
    textures: b.textures,
    featuredRank: b.featuredRank,
    specs: { material: b.material, fill: b.fill, texture: b.texture, sizeDescription: b.sizeDescription },
  };
  const terms: NonNullable<Product["salesTerms"]> = {};
  if (b.finalSaleOnceOpened !== null) terms.finalSaleOnceOpened = b.finalSaleOnceOpened;
  if (b.processingBusinessDays !== null) terms.processingBusinessDays = b.processingBusinessDays;
  product.salesTerms = Object.keys(terms).length ? terms : undefined;
  return { ...r, product };
}

export interface SafetyInput {
  ageGrade: string | null;
  warnings: string[];
  careInstructions: string[];
  manufacturerOrImporter: string | null;
  countryOfOrigin: string | null;
  warningsReviewed: boolean;
  compliance: PrivateProduct["compliance"];
  photosAuthentic: boolean;
  shippingMeasured: boolean;
  notes: string | null;
}

export function parseSafety(f: Fields): Parsed<SafetyInput> {
  const errors: string[] = [];
  const status = text(f, "complianceStatus", 20) as ComplianceStatus;
  if (!COMPLIANCE_STATUSES.includes(status)) errors.push("Pick a compliance status.");
  const testDate = nullable(f, "testDate", 10);
  if (testDate && !/^\d{4}-\d{2}-\d{2}$/.test(testDate)) errors.push("Test date: YYYY-MM-DD.");
  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      ageGrade: nullable(f, "ageGrade", 40),
      warnings: lines(f, "warnings"),
      careInstructions: lines(f, "careInstructions"),
      manufacturerOrImporter: nullable(f, "manufacturerOrImporter", 160),
      countryOfOrigin: nullable(f, "countryOfOrigin", 60),
      warningsReviewed: checked(f, "warningsReviewed"),
      photosAuthentic: checked(f, "photosAuthentic"),
      shippingMeasured: checked(f, "shippingMeasured"),
      compliance: {
        status,
        cpcFile: nullable(f, "cpcFile"),
        testReportFile: nullable(f, "testReportFile"),
        testLab: nullable(f, "testLab", 120),
        testDate,
        trackingLabelPhoto: nullable(f, "trackingLabelPhoto"),
      },
      notes: nullable(f, "notes", 2000),
    },
  };
}

export function applySafety(r: ProductRecord, s: SafetyInput): ProductRecord {
  return {
    ...r,
    product: {
      ...r.product,
      safety: { ageGrade: s.ageGrade, warnings: s.warnings, careInstructions: s.careInstructions, manufacturerOrImporter: s.manufacturerOrImporter, countryOfOrigin: s.countryOfOrigin },
    },
    private: { ...r.private, warningsReviewed: s.warningsReviewed, photosAuthentic: s.photosAuthentic, shippingMeasured: s.shippingMeasured, compliance: s.compliance, notes: s.notes },
  };
}

export interface VariantInput {
  id: string | null;
  sku: string;
  name: string;
  swatch: string;
  priceCents: number | null;
  compareAtCents: number | null;
  tracked: boolean;
  available: number | null;
  weightGrams: number | null;
  dimensions: ProductVariant["dimensions"];
  externalPurchaseUrl: string | null;
  fulfillmentSource: FulfillmentSource;
  fulfillmentOrigin: string | null;
  private: PrivateVariant;
}

export function parseVariant(f: Fields): Parsed<VariantInput> {
  const errors: string[] = [];
  const id = text(f, "variantId", 64) || null;
  if (id && !PRODUCT_ID.test(id)) errors.push("That variant id isn't valid.");
  const sku = text(f, "sku", 40).toUpperCase();
  if (!SKU.test(sku)) errors.push("SKU: 2–40 letters, numbers, dots, dashes or underscores (e.g. FS-BERRY-PINK).");
  const name = text(f, "variantName", 60);
  if (!name) errors.push("Variant name is required (e.g. Pink, Large, Default).");
  const swatch = text(f, "swatch", 7).toLowerCase() || "#4ea8ff";
  if (!/^#[0-9a-f]{6}$/.test(swatch)) errors.push("Color: a hex color like #ff7ab8.");
  const price = dollarsToCents(f.price);
  const compareAt = dollarsToCents(f.compareAt);
  const cost = dollarsToCents(f.cost);
  const landed = dollarsToCents(f.landedCost);
  for (const [v, l] of [[price, "Price"], [compareAt, "Was-price"], [cost, "Unit cost"], [landed, "Landed cost"]] as const) if (Number.isNaN(v)) errors.push(`${l}: dollars and cents, e.g. 12.99.`);
  if (compareAt !== null && price !== null && !Number.isNaN(compareAt) && compareAt <= price) errors.push("A was-price must be higher than the price (or leave it empty).");
  if (compareAt !== null && !text(f, "compareAtBasis", 300)) errors.push("A was-price needs its basis (when and where it really sold at that price).");
  const tracked = checked(f, "tracked");
  const available = wholeNumber(f.available, 100_000);
  if (Number.isNaN(available)) errors.push("Stock count: a whole number.");
  const weight = wholeNumber(f.weightGrams, 30_000);
  if (Number.isNaN(weight)) errors.push("Weight: whole grams.");
  const dims = ["lengthCm", "widthCm", "heightCm"].map((k) => decimal(f[k], 200));
  if (dims.some((d) => Number.isNaN(d))) errors.push("Box size: centimeters, up to 2 decimals.");
  const allDims = dims.every((d) => d !== null && !Number.isNaN(d) && d > 0);
  if (!allDims && dims.some((d) => d !== null)) errors.push("Box size: fill in all three sides, or none.");
  const url = text(f, "externalPurchaseUrl", 300) || null;
  if (url && !/^https:\/\/[^\s]+$/.test(url)) errors.push("Outside purchase link must start with https://");
  const source = (text(f, "fulfillmentSource", 20) || "in_house") as FulfillmentSource;
  if (!["in_house", "supplier"].includes(source)) errors.push("Who ships it: your stock or a supplier.");
  const origin = text(f, "fulfillmentOrigin", 32).toLowerCase() || null;
  if (origin && !/^[a-z][a-z0-9-]{1,30}$/.test(origin)) errors.push("Shipping origin id: lowercase letters, digits and dashes.");
  if (source === "supplier" && !origin) errors.push("Supplier-shipped items need the supplier's shipping origin.");
  const supplierId = text(f, "supplierId", 64) || null;
  if (supplierId && !PRODUCT_ID.test(supplierId)) errors.push("Pick a supplier from the list.");
  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      id,
      sku,
      name,
      swatch,
      priceCents: price,
      compareAtCents: compareAt,
      tracked,
      available: tracked ? available : null,
      weightGrams: weight,
      dimensions: allDims ? { lengthCm: dims[0]!, widthCm: dims[1]!, heightCm: dims[2]! } : null,
      externalPurchaseUrl: url,
      fulfillmentSource: source,
      fulfillmentOrigin: source === "supplier" ? origin : origin && origin !== "funksquish" ? origin : null,
      private: {
        costCents: cost,
        landedCostCents: landed,
        costVerified: checked(f, "costVerified") && cost !== null,
        priceVerified: checked(f, "priceVerified") && price !== null,
        supplierId,
        supplierSku: text(f, "supplierSku", 60) || null,
        invoiceRef: text(f, "invoiceRef", 120) || null,
        compareAtBasis: text(f, "compareAtBasis", 300) || null,
      },
    },
  };
}

export function upsertVariant(r: ProductRecord, v: VariantInput): { ok: true; record: ProductRecord } | { ok: false; error: string } {
  const existing = v.id ? r.product.variants.find((x) => x.id === v.id) : undefined;
  if (v.id && !existing) return { ok: false, error: "That variant no longer exists. Reload the page." };
  if (r.product.variants.some((x) => x.sku === v.sku && x.id !== v.id)) return { ok: false, error: `SKU ${v.sku} is already used by another variant of this product.` };
  if (!existing && r.product.variants.length >= 30) return { ok: false, error: "A product can have up to 30 variants." };
  const id = existing?.id ?? `${r.product.id}-${newId("v")}`.slice(0, 63);
  const variant: ProductVariant = {
    id,
    sku: v.sku,
    name: v.name,
    swatch: v.swatch,
    palette: paletteFrom(v.swatch),
    price: v.priceCents === null ? null : { amount: v.priceCents, currency: "USD" },
    compareAtPrice: v.compareAtCents === null ? null : { amount: v.compareAtCents, currency: "USD" },
    inventory: { tracked: v.tracked, available: v.available },
    weightGrams: v.weightGrams,
    dimensions: v.dimensions,
    externalPurchaseUrl: v.externalPurchaseUrl,
    fulfillmentSource: v.fulfillmentSource,
    ...(v.fulfillmentOrigin ? { fulfillmentOrigin: v.fulfillmentOrigin } : {}),
  };
  const variants = existing ? r.product.variants.map((x) => (x.id === id ? variant : x)) : [...r.product.variants, variant];
  return { ok: true, record: { ...r, product: { ...r.product, variants }, private: { ...r.private, variants: { ...r.private.variants, [id]: v.private } } } };
}

export function removeVariant(r: ProductRecord, variantId: string): ProductRecord {
  const rest = { ...r.private.variants };
  delete rest[variantId];
  return { ...r, product: { ...r.product, variants: r.product.variants.filter((v) => v.id !== variantId) }, private: { ...r.private, variants: rest } };
}

export function newRecord(input: { name: string; slug: string; category: CategorySlug }, now = new Date()): ProductRecord {
  const id = newId("p_");
  const at = now.toISOString();
  return {
    id,
    rev: 1,
    createdAt: at,
    updatedAt: at,
    status: "draft",
    publishedRev: null,
    publishedAt: null,
    history: [{ at, summary: "Created" }],
    private: emptyPrivate(),
    product: {
      id,
      slug: input.slug,
      name: input.name,
      category: input.category,
      publication: "draft",
      shortDescription: "",
      description: "",
      media: [],
      art: ART_FOR[input.category],
      variants: [],
      specs: { material: null, fill: null, texture: null, sizeDescription: null },
      safety: { ageGrade: null, warnings: [], careInstructions: [], manufacturerOrImporter: null, countryOfOrigin: null },
      tags: [],
      textures: [],
      featuredRank: 100,
      createdAt: at.slice(0, 10),
    },
  };
}

/* ------------------------------ media list ------------------------------ */

export function addMedia(r: ProductRecord, m: ProductMedia): { ok: true; record: ProductRecord } | { ok: false; error: string } {
  if (r.product.media.length >= 12) return { ok: false, error: "A product can have up to 12 photos and videos." };
  if (r.product.media.some((x) => x.src === m.src)) return { ok: false, error: "That exact file is already on this product." };
  return { ok: true, record: { ...r, product: { ...r.product, media: [...r.product.media, m] } } };
}

export function moveMedia(r: ProductRecord, src: string, to: "up" | "down" | "first"): ProductRecord {
  const list = [...r.product.media];
  const i = list.findIndex((m) => m.src === src);
  if (i < 0) return r;
  const [item] = list.splice(i, 1);
  const j = to === "first" ? 0 : to === "up" ? Math.max(0, i - 1) : Math.min(list.length, i + 1);
  list.splice(j, 0, item);
  return { ...r, product: { ...r.product, media: list } };
}

export function setMediaText(r: ProductRecord, src: string, alt: string): ProductRecord {
  return { ...r, product: { ...r.product, media: r.product.media.map((m) => (m.src === src ? { ...m, alt: alt.trim().slice(0, 200) } : m)) } };
}

export function removeMedia(r: ProductRecord, src: string): ProductRecord {
  return { ...r, product: { ...r.product, media: r.product.media.filter((m) => m.src !== src && m.poster !== src) } };
}

export const unpublishedChanges = (r: ProductRecord) => r.status === "published" && r.publishedRev !== r.rev;
