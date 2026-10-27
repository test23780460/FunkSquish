#!/usr/bin/env node
// Export the current catalog (public + private data) back to the spreadsheet format.
//
//   npm run catalog:export      -> private/catalog-export.csv  (git-ignored)
import fs from "node:fs";
import path from "node:path";
import { PRIVATE_COLUMNS, PRIVATE_DIR, PRIVATE_JSON, PUBLIC_COLUMNS, PUBLIC_JSON, ROOT, money, readJson, toCsv } from "./catalog-lib.mjs";

const products = readJson(PUBLIC_JSON, []);
const internal = readJson(PRIVATE_JSON, {});
const join = (arr) => (arr ?? []).join("|");

const rows = products.flatMap((p) =>
  p.variants.map((v) => {
    const x = internal[v.sku] ?? {};
    return {
      product_slug: p.slug,
      product_name: p.name,
      category: p.category,
      publication: p.publication,
      short_description: p.shortDescription,
      description: p.description,
      tags: join(p.tags),
      featured_rank: p.featuredRank,
      art: p.art,
      age_grade: p.safety.ageGrade,
      warnings: join(p.safety.warnings),
      care_instructions: join(p.safety.careInstructions),
      manufacturer_or_importer: p.safety.manufacturerOrImporter,
      country_of_origin: p.safety.countryOfOrigin,
      material: p.specs.material,
      fill: p.specs.fill,
      texture: p.specs.texture,
      texture_types: join(p.textures ?? []),
      size_description: p.specs.sizeDescription,
      media: p.media
        .map((m) => [m.src, m.alt, m.width, m.height, m.type === "video" ? "video" : "", m.poster ?? ""].join("::").replace(/(::)+$/, ""))
        .join("|"),
      variant_sku: v.sku,
      variant_name: v.name,
      swatch_hex: v.swatch,
      price_usd: money(v.price),
      compare_at_usd: money(v.compareAtPrice),
      inventory_tracked: String(v.inventory.tracked),
      inventory_available: v.inventory.available ?? "",
      weight_grams: v.weightGrams ?? "",
      length_cm: v.dimensions?.lengthCm ?? "",
      width_cm: v.dimensions?.widthCm ?? "",
      height_cm: v.dimensions?.heightCm ?? "",
      external_purchase_url: v.externalPurchaseUrl,
      private_cost_per_unit_usd: money(x.costPerUnit),
      private_supplier_name: x.supplierName,
      private_supplier_sku: x.supplierSku,
      private_supplier_reference: x.supplierReference,
      private_invoice_ref: x.invoiceRef,
      private_compliance_status: x.compliance?.status ?? "missing",
      private_cpc_file: x.compliance?.cpcFile,
      private_test_report_file: x.compliance?.testReportFile,
      private_test_lab: x.compliance?.testLab,
      private_test_date: x.compliance?.testDate,
      private_tracking_label_photo: x.compliance?.trackingLabelPhoto,
      private_notes: x.notes,
    };
  }),
);

fs.mkdirSync(PRIVATE_DIR, { recursive: true });
const out = path.join(PRIVATE_DIR, "catalog-export.csv");
fs.writeFileSync(out, toCsv(rows, [...PUBLIC_COLUMNS, ...PRIVATE_COLUMNS]));
console.log(`Exported ${rows.length} variant rows -> ${path.relative(ROOT, out)} (git-ignored)`);
