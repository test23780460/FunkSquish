import type { Order } from "../orders/types";
import type { ProductRecord } from "../catalog-admin/record";

/**
 * Sales report from verified order records only (never from analytics, never
 * estimated). Two clearly separated parts:
 *  - FACTS: what orders and refunds actually recorded.
 *  - ESTIMATES: product cost and gross profit, using the unit costs YOU
 *    entered on each variant. Any line without a cost makes the estimate
 *    incomplete, and the report says how much of it is missing.
 * No customer details are used or shown.
 */
export interface SalesReport {
  from: string;
  to: string;
  facts: {
    orders: number;
    unitsSold: number;
    /** Paid totals incl. shipping and tax, before refunds (cents). */
    gross: number;
    itemsRevenue: number;
    shippingCollected: number;
    taxCollected: number;
    refunded: number;
    refundsCount: number;
    /** gross − refunded − tax (tax isn't your money). */
    netRevenue: number;
    canceledOrders: number;
    disputes: number;
  };
  estimates: {
    /** Units × your entered unit cost (landed cost when you entered one). */
    productCost: number;
    /** Lines (by units) with no cost entered. */
    unitsWithoutCost: number;
    /** netRevenue − shippingCollected − productCost: what's left before shipping labels, fees and packaging. */
    grossProfitBeforeShipping: number | null;
    complete: boolean;
  };
  products: { productId: string; name: string; sku: string; units: number; revenue: number; refundedUnits: number }[];
  /** Published products with no sales in the period (slow movers). */
  noSales: { productId: string; name: string }[];
}

const paidStatuses = new Set(["paid", "partially_refunded", "refunded"]);

export function salesReport(orders: Order[], records: ProductRecord[], range: { from: Date; to: Date }): SalesReport {
  const inRange = (iso: string) => {
    const t = Date.parse(iso);
    return t >= range.from.getTime() && t < range.to.getTime();
  };
  const paid = orders.filter((o) => paidStatuses.has(o.paymentStatus) && inRange(o.createdAt));
  const refunds = orders.flatMap((o) => o.refunds.filter((r) => inRange(r.createdAt)));
  const costOf = new Map<string, number | null>();
  for (const r of records) for (const v of r.product.variants) costOf.set(v.id, r.private.variants[v.id]?.landedCostCents ?? r.private.variants[v.id]?.costCents ?? null);

  const byVariant = new Map<string, SalesReport["products"][number]>();
  let units = 0;
  let productCost = 0;
  let withoutCost = 0;
  for (const o of paid)
    for (const l of o.lineItems) {
      units += l.quantity;
      const row = byVariant.get(l.variantId) ?? { productId: l.productId, name: l.name, sku: l.sku, units: 0, revenue: 0, refundedUnits: 0 };
      row.units += l.quantity;
      row.revenue += l.amountTotal;
      byVariant.set(l.variantId, row);
      const c = costOf.get(l.variantId);
      if (c === null || c === undefined) withoutCost += l.quantity;
      else productCost += c * l.quantity;
    }
  const gross = paid.reduce((n, o) => n + o.amounts.total, 0);
  const tax = paid.reduce((n, o) => n + o.amounts.tax, 0);
  const shipping = paid.reduce((n, o) => n + o.amounts.shipping, 0);
  const refunded = refunds.reduce((n, r) => n + r.amount, 0);
  const net = gross - refunded - tax;
  const sold = new Set(paid.flatMap((o) => o.lineItems.map((l) => l.productId)));
  return {
    from: range.from.toISOString(),
    to: range.to.toISOString(),
    facts: {
      orders: paid.length,
      unitsSold: units,
      gross,
      itemsRevenue: paid.reduce((n, o) => n + o.amounts.subtotal - o.amounts.discount, 0),
      shippingCollected: shipping,
      taxCollected: tax,
      refunded,
      refundsCount: refunds.length,
      netRevenue: net,
      canceledOrders: orders.filter((o) => o.status === "canceled" && inRange(o.updatedAt)).length,
      disputes: orders.reduce((n, o) => n + (o.disputes ?? []).filter((d) => inRange(d.createdAt)).length, 0),
    },
    estimates: {
      productCost,
      unitsWithoutCost: withoutCost,
      grossProfitBeforeShipping: units ? net - shipping - productCost : null,
      complete: withoutCost === 0,
    },
    products: [...byVariant.values()].sort((a, b) => b.units - a.units || b.revenue - a.revenue),
    noSales: records.filter((r) => r.status === "published" && !sold.has(r.id)).map((r) => ({ productId: r.id, name: r.product.name })),
  };
}

/** Order lines for a spreadsheet: no names, emails or addresses. */
export function salesCsvRows(orders: Order[]) {
  return orders.flatMap((o) =>
    o.lineItems.map((l) => ({
      order: o.id,
      mode: o.mode,
      created: o.createdAt,
      status: o.status,
      payment: o.paymentStatus,
      sku: l.sku,
      product: l.name,
      quantity: l.quantity,
      line_total_usd: (l.amountTotal / 100).toFixed(2),
      order_shipping_usd: (o.amounts.shipping / 100).toFixed(2),
      order_tax_usd: (o.amounts.tax / 100).toFixed(2),
      order_total_usd: (o.amounts.total / 100).toFixed(2),
      order_refunded_usd: (o.refunds.reduce((n, r) => n + r.amount, 0) / 100).toFixed(2),
      ships_from: l.fulfillmentSource,
    })),
  );
}
