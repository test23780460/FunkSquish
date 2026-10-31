import type { ProductRecord } from "../catalog-admin/record";
import type { Supplier } from "./supplier";

/**
 * Supplier comparison, built ONLY from what the owner entered. Every value
 * is either a fact you recorded or `null` ("Missing"); margins are labeled
 * estimates computed from your own price and cost entries, never guessed.
 */
export interface Offer {
  supplierId: string;
  supplierName: string;
  /** "linked" = a SKU in Products uses this supplier; "quote" = a written quote not linked yet. */
  kind: "linked" | "quote";
  product: string;
  sku: string | null;
  supplierSku: string | null;
  productType: string | null;
  unitCostCents: number | null;
  landedCostCents: number | null;
  costVerified: boolean;
  moq: number | null;
  /** Your selling price (linked SKUs), or the planned price typed on the compare page (quotes). */
  priceCents: number | null;
  priceIsPlanned: boolean;
  source: string | null;
}

export interface SupplierFacts {
  supplier: Supplier;
  linkedSkus: number;
  missing: string[];
}

export function supplierFacts(s: Supplier, records: ProductRecord[]): SupplierFacts {
  const missing: string[] = [];
  const t = s.terms;
  if (t.moq === null) missing.push("minimum order");
  if (t.processingDays === null) missing.push("processing time");
  if (t.dropship === "unknown") missing.push("dropshipping");
  if (t.tracking === "unknown") missing.push("tracking support");
  if (t.firstItemShippingCents === null) missing.push("shipping cost");
  if (!t.returnPolicy) missing.push("return policy");
  if (!t.paymentTerms) missing.push("payment terms");
  if (!t.authorizedChannels.length) missing.push("authorized sales channels");
  if (s.compliance.status !== "verified") missing.push(`compliance (${s.compliance.status})`);
  if (s.agreement.status !== "signed") missing.push(`agreement (${s.agreement.status})`);
  const linkedSkus = records.reduce((n, r) => n + r.product.variants.filter((v) => r.private.variants[v.id]?.supplierId === s.id).length, 0);
  return { supplier: s, linkedSkus, missing };
}

export function offers(suppliers: Supplier[], records: ProductRecord[], plannedPriceCents: number | null): Offer[] {
  const out: Offer[] = [];
  const byId = new Map(suppliers.map((s) => [s.id, s]));
  for (const r of records)
    for (const v of r.product.variants) {
      const x = r.private.variants[v.id];
      const s = x?.supplierId ? byId.get(x.supplierId) : undefined;
      if (!s) continue;
      out.push({
        supplierId: s.id,
        supplierName: s.name,
        kind: "linked",
        product: `${r.product.name} · ${v.name}`,
        sku: v.sku,
        supplierSku: x!.supplierSku,
        productType: r.product.category,
        unitCostCents: x!.costCents,
        landedCostCents: x!.landedCostCents,
        costVerified: x!.costVerified,
        moq: s.terms.moq,
        priceCents: v.price?.amount ?? null,
        priceIsPlanned: false,
        source: x!.invoiceRef,
      });
    }
  for (const s of suppliers)
    for (const q of s.quotes)
      out.push({
        supplierId: s.id,
        supplierName: s.name,
        kind: "quote",
        product: q.product,
        sku: null,
        supplierSku: q.supplierSku,
        productType: q.productType,
        unitCostCents: q.unitCostCents,
        landedCostCents: q.landedCostCents,
        costVerified: false,
        moq: q.moq ?? s.terms.moq,
        priceCents: plannedPriceCents,
        priceIsPlanned: plannedPriceCents !== null,
        source: q.source,
      });
  return out;
}

/** Estimated gross margin (0–1) on your price, from the best cost you entered. Null when either number is missing. */
export function estimatedMargin(o: Pick<Offer, "priceCents" | "unitCostCents" | "landedCostCents">): { margin: number; basis: "landed" | "unit" } | null {
  if (!o.priceCents || o.priceCents <= 0) return null;
  const cost = o.landedCostCents ?? o.unitCostCents;
  if (cost === null) return null;
  return { margin: (o.priceCents - cost) / o.priceCents, basis: o.landedCostCents !== null ? "landed" : "unit" };
}
