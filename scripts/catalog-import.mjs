#!/usr/bin/env node
// Import the catalog spreadsheet into the site.
//
//   npm run catalog:import                 (reads private/catalog.csv)
//   npm run catalog:import -- path/to.csv
//
// Public columns  -> src/commerce/data/products.json   (ships with the website)
// private_* cols  -> private/catalog-internal.json     (git-ignored, never deployed)
import fs from "node:fs";
import path from "node:path";
import {
  COMPLIANCE_STATUSES, PRIVATE_DIR, PRIVATE_JSON, PUBLIC_JSON, ROOT,
  centsOrNull, list, numOrNull, paletteFromHex, parseCsv, textOrNull,
} from "./catalog-lib.mjs";
import { validateProducts } from "../src/commerce/validate.ts";

const input = path.resolve(ROOT, process.argv[2] ?? "private/catalog.csv");
if (!fs.existsSync(input)) {
  console.error(`No catalog found at ${path.relative(ROOT, input)}.\nCopy templates/catalog-template.csv to private/catalog.csv and fill it in.`);
  process.exitCode = 1;
}

const rows = process.exitCode ? [] : parseCsv(fs.readFileSync(input, "utf8"));
const products = new Map();
const internal = {};

function media(cell, slug) {
  // Each item: src::alt::width::height[::video[::poster]]   (items separated by |)
  return list(cell).map((item) => {
    const [src, alt, width, height, kind, poster] = item.split("::").map((s) => s?.trim());
    if (!src || !alt || !width || !height) throw new Error(`${slug}: media item "${item}" needs src::alt::width::height`);
    const type = kind === "video" ? "video" : "image";
    // Captions: a .vtt file next to the video with the same name (e.g. squeeze.mp4 -> squeeze.vtt).
    const vtt = type === "video" ? src.replace(/\.[a-z0-9]+$/i, ".vtt") : null;
    const captions = vtt && fs.existsSync(path.join(ROOT, "public", vtt)) ? vtt : null;
    return { type, src, alt, width: Number(width), height: Number(height), ...(poster ? { poster } : {}), ...(captions ? { captions } : {}) };
  });
}

/** Optional per-product sales terms (shown before purchase). Empty cells = our standard terms. */
function salesTerms(r, slug) {
  const terms = {};
  const finalSale = (r.final_sale_once_opened ?? "").trim().toLowerCase();
  if (finalSale && !["true", "false"].includes(finalSale)) throw new Error(`${slug}: final_sale_once_opened must be true, false or empty`);
  if (finalSale) terms.finalSaleOnceOpened = finalSale === "true"; // an explicit "false" is a recorded decision too
  const days = numOrNull(r.processing_business_days ?? "");
  if (days !== null) terms.processingBusinessDays = days;
  return Object.keys(terms).length ? { salesTerms: terms } : {};
}

rows.forEach((r, i) => {
  const line = i + 2;
  try {
    const slug = r.product_slug;
    if (!slug) throw new Error("product_slug is required");
    if (!products.has(slug)) {
      products.set(slug, {
        id: slug,
        slug,
        name: r.product_name,
        category: r.category,
        publication: r.publication || "draft",
        shortDescription: r.short_description,
        description: r.description,
        media: media(r.media, slug),
        art: r.art || "slushie",
        variants: [],
        specs: {
          material: textOrNull(r.material),
          fill: textOrNull(r.fill),
          texture: textOrNull(r.texture),
          sizeDescription: textOrNull(r.size_description),
        },
        safety: {
          ageGrade: textOrNull(r.age_grade),
          warnings: list(r.warnings),
          careInstructions: list(r.care_instructions),
          manufacturerOrImporter: textOrNull(r.manufacturer_or_importer),
          countryOfOrigin: textOrNull(r.country_of_origin),
        },
        tags: list(r.tags),
        textures: list(r.texture_types ?? ""),
        ...salesTerms(r, slug),
        featuredRank: numOrNull(r.featured_rank) ?? 100,
        createdAt: new Date().toISOString().slice(0, 10),
      });
    }
    const p = products.get(slug);
    const dims = [r.length_cm, r.width_cm, r.height_cm].map(numOrNull);
    const tracked = r.inventory_tracked.toLowerCase() === "true";
    const palette = paletteFromHex(r.swatch_hex);
    p.variants.push({
      id: `${slug}-${r.variant_sku}`.toLowerCase(),
      sku: r.variant_sku,
      name: r.variant_name,
      swatch: palette.base,
      palette,
      price: centsOrNull(r.price_usd),
      compareAtPrice: centsOrNull(r.compare_at_usd),
      inventory: { tracked, available: tracked ? numOrNull(r.inventory_available) : null },
      weightGrams: numOrNull(r.weight_grams),
      dimensions: dims.every((d) => d !== null) ? { lengthCm: dims[0], widthCm: dims[1], heightCm: dims[2] } : null,
      externalPurchaseUrl: textOrNull(r.external_purchase_url),
    });

    const status = r.private_compliance_status || "missing";
    if (!COMPLIANCE_STATUSES.includes(status)) throw new Error(`private_compliance_status must be one of ${COMPLIANCE_STATUSES.join(", ")}`);
    internal[r.variant_sku] = {
      productSlug: slug,
      costPerUnit: centsOrNull(r.private_cost_per_unit_usd),
      supplierName: textOrNull(r.private_supplier_name),
      supplierSku: textOrNull(r.private_supplier_sku),
      supplierReference: textOrNull(r.private_supplier_reference),
      invoiceRef: textOrNull(r.private_invoice_ref),
      compliance: {
        status,
        cpcFile: textOrNull(r.private_cpc_file),
        testReportFile: textOrNull(r.private_test_report_file),
        testLab: textOrNull(r.private_test_lab),
        testDate: textOrNull(r.private_test_date),
        trackingLabelPhoto: textOrNull(r.private_tracking_label_photo),
      },
      // Evidence that a compare-at ("was") price was a real, recent selling price (16 CFR 233.1).
      compareAtBasis: textOrNull(r.private_compare_at_basis ?? ""),
      notes: textOrNull(r.private_notes),
    };
  } catch (err) {
    console.error(`Row ${line}: ${err.message}`);
    process.exitCode = 1;
  }
});
if (!process.exitCode) {
  // Keep the original createdAt for products that already existed.
  const previous = fs.existsSync(PUBLIC_JSON) ? JSON.parse(fs.readFileSync(PUBLIC_JSON, "utf8")) : [];
  for (const p of products.values()) {
    const old = previous.find((o) => o.slug === p.slug);
    if (old?.createdAt) p.createdAt = old.createdAt;
  }

  const publicProducts = validateProducts([...products.values()]); // throws on bad data or private-looking keys
  fs.writeFileSync(PUBLIC_JSON, JSON.stringify(publicProducts, null, 2) + "\n");
  fs.mkdirSync(PRIVATE_DIR, { recursive: true });
  fs.writeFileSync(PRIVATE_JSON, JSON.stringify(internal, null, 2) + "\n");

  const count = (s) => publicProducts.filter((p) => p.publication === s).length;
  console.log(`Imported ${publicProducts.length} products (${Object.keys(internal).length} variants).`);
  console.log(`  published: ${count("published")}  draft: ${count("draft")}  preview: ${count("preview")}  archived: ${count("archived")}`);
  console.log(`  public  -> ${path.relative(ROOT, PUBLIC_JSON)}`);
  console.log(`  private -> ${path.relative(ROOT, PRIVATE_JSON)} (git-ignored)`);
  console.log("Next: npm run catalog:check");
}
