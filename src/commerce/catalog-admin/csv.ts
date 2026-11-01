import type { Product, ProductMedia } from "../types";
import { paletteFrom } from "./palette";
import { COMPLIANCE_STATUSES, emptyPrivate, emptyPrivateVariant, toPublicProduct, type ComplianceStatus, type ProductRecord } from "./record";

/**
 * The catalog spreadsheet (templates/catalog-template.csv), read and written
 * by the dashboard. Same columns and rules as `npm run catalog:import` /
 * `catalog:export` (scripts/catalog-*.mjs), so either path works and files
 * move between them. Private columns (private_*) map to the record's private
 * fields and never reach a public release.
 */
export const PUBLIC_COLUMNS = [
  "product_slug", "product_name", "category", "publication", "short_description", "description", "tags",
  "featured_rank", "art", "age_grade", "warnings", "care_instructions", "manufacturer_or_importer",
  "country_of_origin", "material", "fill", "texture", "texture_types", "size_description", "media", "variant_sku", "variant_name",
  "swatch_hex", "price_usd", "compare_at_usd", "inventory_tracked", "inventory_available", "weight_grams",
  "length_cm", "width_cm", "height_cm", "external_purchase_url", "final_sale_once_opened", "processing_business_days",
] as const;
export const FULFILLMENT_COLUMNS = ["fulfillment_source", "fulfillment_origin"] as const;
export const PRIVATE_COLUMNS = [
  "private_cost_per_unit_usd", "private_supplier_name", "private_supplier_sku", "private_supplier_reference",
  "private_invoice_ref", "private_compliance_status", "private_cpc_file", "private_test_report_file",
  "private_test_lab", "private_test_date", "private_tracking_label_photo", "private_compare_at_basis", "private_notes",
] as const;
/** Dashboard-only private columns (the scripts ignore them). */
export const DASHBOARD_COLUMNS = ["private_supplier_id", "private_landed_cost_usd"] as const;

/** Minimal RFC-4180 parser (quotes, escaped quotes, newlines in quotes), identical to scripts/catalog-lib.mjs. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  text = text.replace(/^﻿/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const [header, ...body] = rows.filter((r) => r.some((v) => v.trim() !== ""));
  if (!header) return [];
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

/** CSV text; cells starting with = + - @ are prefixed with ' so a spreadsheet never runs them as formulas. */
export function toCsv(rows: Record<string, unknown>[], columns: readonly string[]): string {
  const esc = (v: unknown) => {
    let s = v === null || v === undefined ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.join(","), ...rows.map((r) => columns.map((c) => esc(r[c])).join(","))].join("\n") + "\n";
}

const list = (v: string | undefined) => (v ? v.split("|").map((s) => s.trim()).filter(Boolean) : []);
const textOrNull = (v: string | undefined) => (v ? v : null);
function num(v: string | undefined): number | null {
  if (v === "" || v === undefined) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw new Error(`Not a valid non-negative number: "${v}"`);
  return n;
}
const cents = (v: string | undefined) => {
  const n = num(v);
  return n === null ? null : Math.round(n * 100);
};
const money = (c: number | null | undefined) => (c === null || c === undefined ? "" : (c / 100).toFixed(2));

export interface CsvRowError {
  line: number;
  error: string;
}
export interface ImportedProduct {
  product: Product;
  private: ProductRecord["private"];
  /** Supplier names from the sheet, by variant id (to link to dashboard suppliers by name). */
  supplierNames: Record<string, string>;
}

/** Spreadsheet rows → products with their private fields. Throws nothing; returns per-row errors. */
export function rowsToProducts(rows: Record<string, string>[], today = new Date().toISOString().slice(0, 10)): { products: ImportedProduct[]; errors: CsvRowError[] } {
  const bySlug = new Map<string, ImportedProduct>();
  const errors: CsvRowError[] = [];
  rows.forEach((r, i) => {
    const line = i + 2;
    try {
      const slug = r.product_slug;
      if (!slug) throw new Error("product_slug is required");
      if (!bySlug.has(slug)) {
        const media: ProductMedia[] = list(r.media).map((item) => {
          const [src, alt, width, height, kind, poster] = item.split("::").map((s) => s?.trim());
          if (!src || !alt || !width || !height) throw new Error(`media item "${item}" needs src::alt::width::height`);
          return { type: kind === "video" ? "video" : "image", src, alt, width: Number(width), height: Number(height), ...(poster ? { poster } : {}) };
        });
        const finalSale = (r.final_sale_once_opened ?? "").trim().toLowerCase();
        if (finalSale && !["true", "false"].includes(finalSale)) throw new Error("final_sale_once_opened must be true, false or empty");
        const days = num(r.processing_business_days);
        const terms: NonNullable<Product["salesTerms"]> = {};
        if (finalSale) terms.finalSaleOnceOpened = finalSale === "true";
        if (days !== null) terms.processingBusinessDays = days;
        const status = (r.private_compliance_status || "missing") as ComplianceStatus;
        if (!COMPLIANCE_STATUSES.includes(status)) throw new Error(`private_compliance_status must be one of ${COMPLIANCE_STATUSES.join(", ")}`);
        const priv = emptyPrivate();
        priv.compliance = {
          status,
          cpcFile: textOrNull(r.private_cpc_file),
          testReportFile: textOrNull(r.private_test_report_file),
          testLab: textOrNull(r.private_test_lab),
          testDate: textOrNull(r.private_test_date),
          trackingLabelPhoto: textOrNull(r.private_tracking_label_photo),
        };
        priv.notes = textOrNull(r.private_notes);
        bySlug.set(slug, {
          product: {
            id: slug,
            slug,
            name: r.product_name,
            category: r.category as Product["category"],
            publication: (r.publication || "draft") as Product["publication"],
            shortDescription: r.short_description ?? "",
            description: r.description ?? "",
            media,
            art: (r.art || "slushie") as Product["art"],
            variants: [],
            specs: { material: textOrNull(r.material), fill: textOrNull(r.fill), texture: textOrNull(r.texture), sizeDescription: textOrNull(r.size_description) },
            safety: {
              ageGrade: textOrNull(r.age_grade),
              warnings: list(r.warnings),
              careInstructions: list(r.care_instructions),
              manufacturerOrImporter: textOrNull(r.manufacturer_or_importer),
              countryOfOrigin: textOrNull(r.country_of_origin),
            },
            tags: list(r.tags),
            textures: list(r.texture_types) as Product["textures"],
            ...(Object.keys(terms).length ? { salesTerms: terms } : {}),
            featuredRank: num(r.featured_rank) ?? 100,
            createdAt: today,
          },
          private: priv,
          supplierNames: {},
        });
      }
      const p = bySlug.get(slug)!;
      const dims = [r.length_cm, r.width_cm, r.height_cm].map(num);
      const tracked = (r.inventory_tracked ?? "").toLowerCase() === "true";
      const palette = paletteFrom(r.swatch_hex);
      const source = (r.fulfillment_source ?? "").trim().toLowerCase();
      const origin = (r.fulfillment_origin ?? "").trim().toLowerCase();
      if (source && !["in_house", "supplier"].includes(source)) throw new Error(`${r.variant_sku}: fulfillment_source must be in_house, supplier or empty`);
      if (origin && !/^[a-z][a-z0-9-]{1,30}$/.test(origin)) throw new Error(`${r.variant_sku}: fulfillment_origin must be lowercase letters, digits and dashes`);
      if (source === "supplier" && !origin) throw new Error(`${r.variant_sku}: supplier-shipped items need a fulfillment_origin`);
      const id = `${slug}-${r.variant_sku}`.toLowerCase();
      const price = cents(r.price_usd);
      const compareAt = cents(r.compare_at_usd);
      p.product.variants.push({
        id,
        sku: r.variant_sku,
        name: r.variant_name,
        swatch: palette.base,
        palette,
        price: price === null ? null : { amount: price, currency: "USD" },
        compareAtPrice: compareAt === null ? null : { amount: compareAt, currency: "USD" },
        inventory: { tracked, available: tracked ? num(r.inventory_available) : null },
        weightGrams: num(r.weight_grams),
        dimensions: dims.every((d) => d !== null) ? { lengthCm: dims[0]!, widthCm: dims[1]!, heightCm: dims[2]! } : null,
        externalPurchaseUrl: textOrNull(r.external_purchase_url),
        ...(source ? { fulfillmentSource: source as "in_house" | "supplier" } : {}),
        ...(origin ? { fulfillmentOrigin: origin } : {}),
      });
      // Costs and prices from a spreadsheet still need your check in the dashboard (verified flags start off).
      p.private.variants[id] = {
        ...emptyPrivateVariant(),
        costCents: cents(r.private_cost_per_unit_usd),
        landedCostCents: cents(r.private_landed_cost_usd),
        supplierId: textOrNull(r.private_supplier_id),
        supplierSku: textOrNull(r.private_supplier_sku),
        invoiceRef: textOrNull(r.private_invoice_ref),
        compareAtBasis: textOrNull(r.private_compare_at_basis),
      };
      if (r.private_supplier_name) p.supplierNames[id] = r.private_supplier_name;
    } catch (e) {
      errors.push({ line, error: e instanceof Error ? e.message : String(e) });
    }
  });
  return { products: [...bySlug.values()], errors };
}

/** Dashboard records → spreadsheet (public + private columns). Private columns are for YOUR files only. */
export function recordsToCsv(records: ProductRecord[], opts: { includePrivate: boolean; supplierName?: (id: string) => string | null }): string {
  const rows = records.flatMap((rec) => {
    const p = toPublicProduct(rec);
    const v0 = p.variants.length ? p.variants : [null];
    return v0.map((v) => {
      const x = v ? rec.private.variants[v.id] : undefined;
      const row: Record<string, unknown> = {
        product_slug: p.slug,
        product_name: p.name,
        category: p.category,
        publication: p.publication,
        short_description: p.shortDescription,
        description: p.description,
        tags: p.tags.join("|"),
        featured_rank: p.featuredRank,
        art: p.art,
        age_grade: p.safety.ageGrade ?? "",
        warnings: p.safety.warnings.join("|"),
        care_instructions: p.safety.careInstructions.join("|"),
        manufacturer_or_importer: p.safety.manufacturerOrImporter ?? "",
        country_of_origin: p.safety.countryOfOrigin ?? "",
        material: p.specs.material ?? "",
        fill: p.specs.fill ?? "",
        texture: p.specs.texture ?? "",
        texture_types: (p.textures ?? []).join("|"),
        size_description: p.specs.sizeDescription ?? "",
        media: p.media.map((m) => [m.src, m.alt, m.width, m.height, ...(m.type === "video" ? ["video", ...(m.poster ? [m.poster] : [])] : [])].join("::")).join("|"),
        variant_sku: v?.sku ?? "",
        variant_name: v?.name ?? "",
        swatch_hex: v?.swatch ?? "",
        price_usd: money(v?.price?.amount),
        compare_at_usd: money(v?.compareAtPrice?.amount),
        inventory_tracked: v ? String(v.inventory.tracked) : "",
        inventory_available: v?.inventory.available ?? "",
        weight_grams: v?.weightGrams ?? "",
        length_cm: v?.dimensions?.lengthCm ?? "",
        width_cm: v?.dimensions?.widthCm ?? "",
        height_cm: v?.dimensions?.heightCm ?? "",
        external_purchase_url: v?.externalPurchaseUrl ?? "",
        final_sale_once_opened: p.salesTerms?.finalSaleOnceOpened === undefined ? "" : String(p.salesTerms.finalSaleOnceOpened),
        processing_business_days: p.salesTerms?.processingBusinessDays ?? "",
        fulfillment_source: v?.fulfillmentSource ?? "",
        fulfillment_origin: v?.fulfillmentOrigin ?? "",
      };
      if (opts.includePrivate) {
        const c = rec.private.compliance;
        Object.assign(row, {
          private_cost_per_unit_usd: money(x?.costCents),
          private_supplier_name: x?.supplierId ? (opts.supplierName?.(x.supplierId) ?? "") : "",
          private_supplier_sku: x?.supplierSku ?? "",
          private_supplier_reference: "",
          private_invoice_ref: x?.invoiceRef ?? "",
          private_compliance_status: c.status,
          private_cpc_file: c.cpcFile ?? "",
          private_test_report_file: c.testReportFile ?? "",
          private_test_lab: c.testLab ?? "",
          private_test_date: c.testDate ?? "",
          private_tracking_label_photo: c.trackingLabelPhoto ?? "",
          private_compare_at_basis: x?.compareAtBasis ?? "",
          private_notes: rec.private.notes ?? "",
          private_supplier_id: x?.supplierId ?? "",
          private_landed_cost_usd: money(x?.landedCostCents),
        });
      }
      return row;
    });
  });
  const cols = [...PUBLIC_COLUMNS, ...FULFILLMENT_COLUMNS, ...(opts.includePrivate ? [...PRIVATE_COLUMNS, ...DASHBOARD_COLUMNS] : [])];
  return toCsv(rows, cols);
}
