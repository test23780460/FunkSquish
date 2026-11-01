import type { FulfillmentGroup, Order } from "../orders/types";
import type { ProductRecord } from "../catalog-admin/record";
import { toCsv } from "../catalog-admin/csv";
import type { Supplier } from "./supplier";

/**
 * Packages a supplier should ship, for placing orders in bulk on their portal.
 * Contains ONLY what a supplier needs to ship (name and address, items,
 * quantities) — never emails, prices, payment details or order totals. The
 * download is refused unless the supplier's signed agreement limits how they
 * use customer data (checked by the caller with mayShareCustomerData).
 */
export interface SupplierPackage {
  order: Order;
  group: FulfillmentGroup;
  lines: { sku: string; supplierSku: string | null; name: string; quantity: number }[];
}

export function packageSupplierId(g: FulfillmentGroup, records: ProductRecord[], suppliers: Supplier[]): string | null {
  if (g.supplierOrder?.supplierId) return g.supplierOrder.supplierId;
  for (const r of records) for (const v of g.variantIds) if (r.private.variants[v]?.supplierId) return r.private.variants[v].supplierId;
  return suppliers.find((s) => s.originId && s.originId === g.origin)?.id ?? null;
}

export function packagesFor(supplier: Supplier, orders: Order[], records: ProductRecord[], suppliers: Supplier[], which: "to-place" | "open" = "to-place"): SupplierPackage[] {
  const out: SupplierPackage[] = [];
  for (const o of orders) {
    if (o.status === "canceled" || !(o.paymentStatus === "paid" || o.paymentStatus === "partially_refunded")) continue;
    for (const g of o.fulfillments) {
      if (g.source !== "supplier" || packageSupplierId(g, records, suppliers) !== supplier.id) continue;
      const toPlace = g.status === "awaiting_supplier" || (g.status === "unfulfilled" && !g.supplierOrder);
      const open = toPlace || g.status === "sent_to_supplier";
      if (which === "to-place" ? !toPlace : !open) continue;
      const lines = o.lineItems
        .filter((l) => g.variantIds.includes(l.variantId))
        .map((l) => {
          let supplierSku: string | null = null;
          for (const r of records) if (r.private.variants[l.variantId]) supplierSku = r.private.variants[l.variantId].supplierSku;
          return { sku: l.sku, supplierSku, name: l.name, quantity: l.quantity };
        });
      out.push({ order: o, group: g, lines });
    }
  }
  return out.sort((a, b) => (a.group.shipBy ?? "9999").localeCompare(b.group.shipBy ?? "9999"));
}

export const EXPORT_COLUMNS = ["our_order", "package", "ship_by", "supplier_sku", "our_sku", "product", "quantity", "ship_to_name", "address_line1", "address_line2", "city", "state", "postal_code", "country"] as const;

export function supplierCsv(pkgs: SupplierPackage[], opts: { includePhone: boolean }): string {
  const rows = pkgs.flatMap(({ order, group, lines }) =>
    lines.map((l) => ({
      our_order: order.id,
      package: group.id,
      ship_by: group.shipBy ?? "",
      supplier_sku: l.supplierSku ?? "",
      our_sku: l.sku,
      product: l.name,
      quantity: l.quantity,
      ship_to_name: order.shippingAddress?.name ?? order.customer.name ?? "",
      address_line1: order.shippingAddress?.line1 ?? "",
      address_line2: order.shippingAddress?.line2 ?? "",
      city: order.shippingAddress?.city ?? "",
      state: order.shippingAddress?.state ?? "",
      postal_code: order.shippingAddress?.postalCode ?? "",
      country: order.shippingAddress?.country ?? "",
      ...(opts.includePhone ? { phone: order.customer.phone ?? "" } : {}),
    })),
  );
  return toCsv(rows, [...EXPORT_COLUMNS, ...(opts.includePhone ? ["phone"] : [])]);
}
