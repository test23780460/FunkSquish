// Shared helpers for the catalog scripts. Local tooling only — never imported by the website.
import fs from "node:fs";
import path from "node:path";

export const ROOT = path.resolve(import.meta.dirname, "..");
export const PUBLIC_JSON = path.join(ROOT, "src/commerce/data/products.json");
export const PRIVATE_DIR = path.join(ROOT, "private");
export const PRIVATE_JSON = path.join(PRIVATE_DIR, "catalog-internal.json");

/** Minimal RFC-4180 CSV parser (quotes, escaped quotes, newlines in quotes). */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  text = text.replace(/^﻿/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  const [header, ...body] = rows.filter((r) => r.some((v) => v.trim() !== ""));
  if (!header) return [];
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

export function toCsv(rows, columns) {
  const esc = (v) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.join(","), ...rows.map((r) => columns.map((c) => esc(r[c])).join(","))].join("\n") + "\n";
}

export const list = (v) => (v ? v.split("|").map((s) => s.trim()).filter(Boolean) : []);
export const textOrNull = (v) => (v ? v : null);
export const numOrNull = (v) => {
  if (v === "" || v === undefined) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw new Error(`Not a valid non-negative number: "${v}"`);
  return n;
};
export const centsOrNull = (v) => {
  const n = numOrNull(v);
  return n === null ? null : { amount: Math.round(n * 100), currency: "USD" };
};
export const money = (m) => (m ? (m.amount / 100).toFixed(2) : "");

/** Derive illustration colors from a swatch hex so the fallback art matches the variant. */
export function paletteFromHex(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  const base = m ? `#${m[1].toLowerCase()}` : "#4ea8ff";
  const n = parseInt(base.slice(1), 16);
  const mix = (t) => {
    const ch = [16, 8, 0].map((s) => (n >> s) & 255).map((c) => Math.round(t > 0 ? c + (255 - c) * t : c * (1 + t)));
    return `#${ch.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
  };
  return { base, light: mix(0.6), shade: mix(-0.3), accent: "#ffffff" };
}

export const PUBLIC_COLUMNS = [
  "product_slug", "product_name", "category", "publication", "short_description", "description", "tags",
  "featured_rank", "art", "age_grade", "warnings", "care_instructions", "manufacturer_or_importer",
  "country_of_origin", "material", "fill", "texture", "size_description", "media", "variant_sku", "variant_name",
  "swatch_hex", "price_usd", "compare_at_usd", "inventory_tracked", "inventory_available", "weight_grams",
  "length_cm", "width_cm", "height_cm", "external_purchase_url",
];
export const PRIVATE_COLUMNS = [
  "private_cost_per_unit_usd", "private_supplier_name", "private_supplier_sku", "private_supplier_reference",
  "private_invoice_ref", "private_compliance_status", "private_cpc_file", "private_test_report_file",
  "private_test_lab", "private_test_date", "private_tracking_label_photo", "private_notes",
];
export const COMPLIANCE_STATUSES = ["missing", "requested", "received", "verified"];

export function readJson(file, fallback) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : fallback;
}
