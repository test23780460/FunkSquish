#!/usr/bin/env node
// Launch-readiness gate for the catalog. Local only — reads private data.
//
//   npm run catalog:check
//   npm run catalog:check -- --fee-pct=8 --fee-fixed=0.30 --ship=4.50
//     (optional, YOUR assumed per-order selling fees and shipping cost, used
//      only for the margin estimate; nothing is assumed by default)
//
// Exits with code 1 if any PUBLISHED product is missing something required
// before it may be sold (photos, age grading, price, weight, inventory,
// verified CPC/test report/tracking label, purchase invoice, unit cost).
import { PRIVATE_JSON, PUBLIC_JSON, readJson } from "./catalog-lib.mjs";
import { validateProducts } from "../src/commerce/validate.ts";

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")));
const feePct = Number(args["fee-pct"] ?? 0);
const feeFixed = Number(args["fee-fixed"] ?? 0);
const ship = Number(args.ship ?? 0);

const products = validateProducts(readJson(PUBLIC_JSON, []));
const internal = readJson(PRIVATE_JSON, {});
const DAY = 86_400_000;
let blocking = 0;

if (products.length === 0) {
  console.log("Catalog is empty — the site is showing illustrated preview samples.");
  console.log("Add real products: copy templates/catalog-template.csv to private/catalog.csv, then npm run catalog:import.");
}

for (const p of products) {
  const problems = [];
  const warn = [];
  const live = p.publication === "published";
  if (p.media.filter((m) => m.type === "image").length === 0) problems.push("no product photos");
  if (!p.safety.ageGrade) problems.push("age grading not entered (copy it from the product label/CPC)");
  if (!p.safety.manufacturerOrImporter) problems.push("manufacturer/importer not entered");
  if (!p.safety.countryOfOrigin) warn.push("country of origin not entered");
  if (p.safety.warnings.length === 0) warn.push("no warnings listed — confirm none are required by the label/CPC");
  if (!p.specs.material) warn.push("material not entered");
  const mystery = p.tags.some((t) => /mystery|blind/i.test(t)) || /mystery|blind/i.test(p.name);
  if (mystery && p.salesTerms?.finalSaleOnceOpened === undefined)
    (live ? problems : warn).push("looks like a mystery/blind-bag item: set final_sale_once_opened to true (opened ones are final sale — shown before purchase) or false");
  if (p.salesTerms?.processingBusinessDays && p.salesTerms.processingBusinessDays !== 2)
    warn.push(`ships within ${p.salesTerms.processingBusinessDays} business days (shown on the product page) — keep proof you can meet it (FTC Mail Order Rule)`);

  for (const v of p.variants) {
    const x = internal[v.sku];
    const tag = `[${v.sku}]`;
    if (!v.price) problems.push(`${tag} no price`);
    if (!v.weightGrams) problems.push(`${tag} no shipping weight`);
    if (!v.dimensions) warn.push(`${tag} no package dimensions`);
    if (!v.inventory.tracked) problems.push(`${tag} inventory not tracked (set inventory_tracked to true)`);
    else if (v.inventory.available === null) problems.push(`${tag} inventory count missing`);
    if (v.compareAtPrice && v.price && v.compareAtPrice.amount <= v.price.amount) problems.push(`${tag} compare-at price must be higher than price`);
    if (v.compareAtPrice && !x?.compareAtBasis)
      problems.push(`${tag} compare-at ("was") price needs private_compare_at_basis: when and where it was really offered at that price (FTC 16 CFR 233.1)`);
    if (!x) {
      problems.push(`${tag} no private record (cost, supplier, compliance)`);
      continue;
    }
    if (!x.costPerUnit) problems.push(`${tag} unit cost missing`);
    if (!x.invoiceRef) problems.push(`${tag} purchase invoice reference missing`);
    const c = x.compliance ?? {};
    if (c.status !== "verified") problems.push(`${tag} compliance status is "${c.status ?? "missing"}" (needs "verified")`);
    for (const [k, label] of [["cpcFile", "Children's Product Certificate"], ["testReportFile", "CPSC-accepted lab test report"], ["testLab", "test lab name"], ["trackingLabelPhoto", "tracking label photo"]])
      if (!c[k]) problems.push(`${tag} ${label} missing`);
    if (c.testDate) {
      const age = (Date.now() - Date.parse(c.testDate)) / DAY;
      if (Number.isNaN(age)) problems.push(`${tag} test date "${c.testDate}" is not a date (use YYYY-MM-DD)`);
      else if (age > 365) warn.push(`${tag} test report is ${Math.round(age)} days old — TikTok Shop asks for documents issued within 365 days`);
    } else problems.push(`${tag} test date missing`);

    if (v.price && x.costPerUnit) {
      const price = v.price.amount / 100;
      const cost = x.costPerUnit.amount / 100;
      const fees = price * (feePct / 100) + feeFixed;
      const profit = price - cost - fees - ship;
      console.log(`  ${tag} price $${price.toFixed(2)}  cost $${cost.toFixed(2)}  est. profit $${profit.toFixed(2)} (${((profit / price) * 100).toFixed(0)}% margin)`);
    }
  }

  const header = `${live ? "PUBLISHED" : p.publication.toUpperCase()}  ${p.slug}`;
  if (problems.length === 0 && warn.length === 0) console.log(`✓ ${header} — ready`);
  else {
    console.log(`${live && problems.length ? "✗" : "•"} ${header}`);
    problems.forEach((m) => console.log(`    ${live ? "BLOCKER" : "todo   "} ${m}`));
    warn.forEach((m) => console.log(`    check   ${m}`));
  }
  if (live) blocking += problems.length;
}

if (products.length && !feePct && !feeFixed && !ship) console.log("\nMargins exclude selling fees and shipping. Pass --fee-pct, --fee-fixed and --ship with YOUR real numbers.");
if (blocking) {
  console.log(`\n${blocking} blocker(s) on published products. Fix them or set those products back to "draft".`);
  process.exitCode = 1;
} else if (products.length) console.log("\nNo blockers on published products.");
