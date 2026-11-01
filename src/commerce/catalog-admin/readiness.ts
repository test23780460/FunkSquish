import { findOrigin, originIdFor, ORIGIN_PROBLEM_TEXT, staticOriginProblem, type ShippingOrigin } from "../origins";
import type { ProductRecord } from "./record";

/**
 * Launch-readiness checklist. A product can only be published (put in the
 * public catalog) when EVERY item passes. Drafts can be saved at any stage.
 * Each item names exactly what's missing; nothing is filled in for you.
 *
 * Publishing still isn't selling: purchasing stays off until the launch
 * switches are turned on in an approved launch PR, and checkout re-checks
 * price, stock and shipping on the server every time.
 */
export interface ReadinessItem {
  id: "basics" | "variants" | "prices" | "costs" | "photos" | "age" | "warnings" | "maker" | "compliance" | "inventory" | "fulfillment" | "shipping";
  label: string;
  ok: boolean;
  /** What's missing, in plain words (empty when ok). */
  missing: string[];
}

export interface ReadinessContext {
  origins: ShippingOrigin[];
  /** SKU → product name, for every OTHER product in the dashboard and the build-time catalog. */
  otherSkus: Map<string, string>;
  /** Supplier ids that exist in the dashboard (unknown ids fail the fulfillment check). */
  supplierIds?: Set<string>;
}

export function productReadiness(r: ProductRecord, ctx: ReadinessContext): { ready: boolean; items: ReadinessItem[] } {
  const p = r.product;
  const pv = r.private;
  const items: ReadinessItem[] = [];
  const add = (id: ReadinessItem["id"], label: string, missing: string[]) => items.push({ id, label, ok: missing.length === 0, missing });
  const each = (fn: (v: (typeof p.variants)[number]) => string | null) => p.variants.map(fn).filter((x): x is string => !!x);

  add("basics", "Name, web address and descriptions", [
    ...(p.name.trim() ? [] : ["product name"]),
    ...(p.slug ? [] : ["web address"]),
    ...(p.shortDescription.trim().length >= 10 ? [] : ["a one-line summary (10+ characters)"]),
    ...(p.description.trim().length >= 40 ? [] : ["a full description (40+ characters)"]),
  ]);

  add("variants", "Variants and SKUs", [
    ...(p.variants.length ? [] : ["at least one variant (even a single 'Default')"]),
    ...each((v) => (ctx.otherSkus.has(v.sku) ? `SKU ${v.sku} is already used by ${ctx.otherSkus.get(v.sku)}` : null)),
  ]);

  add(
    "prices",
    "Verified selling prices",
    each((v) => {
      const x = pv.variants[v.id];
      if (!v.price) return `${v.name}: no price`;
      if (!x?.priceVerified) return `${v.name}: price not marked verified`;
      if (v.compareAtPrice && !x.compareAtBasis) return `${v.name}: was-price has no recorded basis`;
      return null;
    }),
  );

  add(
    "costs",
    "Verified product costs",
    each((v) => {
      const x = pv.variants[v.id];
      if (x?.costCents === null || x?.costCents === undefined) return `${v.name}: no unit cost`;
      if (!x.costVerified) return `${v.name}: cost not checked against an invoice or quote`;
      return null;
    }),
  );

  const images = p.media.filter((m) => m.type === "image");
  add("photos", "Authentic product photos", [
    ...(images.length ? [] : ["at least one photo of the real product"]),
    ...p.media.filter((m) => m.alt.trim().length < 5).map((_, i) => `alt text for item ${i + 1}`),
    ...(pv.photosAuthentic ? [] : ["confirm every photo/video shows the real product (yours, or licensed in writing)"]),
  ]);

  add("age", "Age guidance", p.safety.ageGrade?.trim() ? [] : ["age grade exactly as on the label (e.g. Ages 3+)"]);
  add("warnings", "Product warnings", pv.warningsReviewed ? [] : ["check the warnings against the real label and tick 'reviewed'"]);
  add("maker", "Manufacturer / importer", [
    ...(p.safety.manufacturerOrImporter?.trim() ? [] : ["manufacturer or importer name from the label"]),
    ...(p.safety.countryOfOrigin?.trim() ? [] : ["country of origin"]),
  ]);

  const c = pv.compliance;
  add("compliance", "Compliance documents", [
    ...(c.status === "verified" ? [] : [`compliance status is "${c.status}" (needs "verified")`]),
    ...(c.cpcFile ? [] : ["Children's Product Certificate reference"]),
    ...(c.testReportFile ? [] : ["third-party test report reference"]),
    ...(c.testLab ? [] : ["CPSC-accepted test lab"]),
    ...(c.testDate ? [] : ["test date"]),
    ...(c.trackingLabelPhoto ? [] : ["photo of the permanent tracking label"]),
  ]);

  add(
    "inventory",
    "Inventory availability",
    each((v) => {
      if ((v.fulfillmentSource ?? "in_house") === "supplier") return pv.variants[v.id]?.supplierId ? null : `${v.name}: supplier-shipped, but no supplier linked`;
      if (!v.inventory.tracked || v.inventory.available === null) return `${v.name}: no starting stock count`;
      return null;
    }),
  );

  add(
    "fulfillment",
    "Fulfillment set-up",
    each((v) => {
      if ((v.fulfillmentSource ?? "in_house") !== "supplier") return null;
      const x = pv.variants[v.id];
      if (!v.fulfillmentOrigin) return `${v.name}: no shipping origin`;
      if (!x?.supplierId) return `${v.name}: no supplier linked`;
      if (ctx.supplierIds && !ctx.supplierIds.has(x.supplierId)) return `${v.name}: linked supplier no longer exists`;
      if (!x.supplierSku) return `${v.name}: no supplier SKU`;
      return null;
    }),
  );

  add("shipping", "Verified shipping information", [
    ...each((v) => (v.weightGrams ? null : `${v.name}: packed weight`)),
    ...each((v) => (v.dimensions ? null : `${v.name}: box size`)),
    ...(pv.shippingMeasured ? [] : ["confirm weights and sizes were measured on the real packed product"]),
    ...[
      ...new Set(
        each((v) => {
          const problem = staticOriginProblem(findOrigin(ctx.origins, originIdFor(v)), v.fulfillmentSource ?? "in_house");
          return problem ? `${originIdFor(v) ?? "no origin"}: ${ORIGIN_PROBLEM_TEXT[problem]}` : null;
        }),
      ),
    ],
  ]);

  return { ready: items.every((i) => i.ok), items };
}
