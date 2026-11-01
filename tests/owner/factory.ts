import type { FulfillmentGroup, Order } from "@/commerce/orders/types";

/** A fictional, test-mode order (made-up customer). Override any field. */
export function order(over: Partial<Order> = {}, groups: Partial<FulfillmentGroup>[] = [{}]): Order {
  const id = over.id ?? "FS-T-20261101-TEST1";
  const fulfillments: FulfillmentGroup[] = groups.map((g, i) => ({
    id: g.id ?? `g${i + 1}`,
    source: "in_house",
    origin: "funksquish",
    shippingAmount: 500,
    processingBusinessDays: 2,
    supplierRef: null,
    variantIds: [`v${i + 1}`],
    status: "unfulfilled",
    carrier: null,
    trackingNumber: null,
    trackingUrl: null,
    shippedAt: null,
    deliveredAt: null,
    shipBy: "2026-11-04",
    ...g,
  }));
  return {
    id,
    mode: "test",
    checkoutId: `chk-${id}`,
    stripeCheckoutSessionId: over.stripeCheckoutSessionId ?? `cs_test_${id.replace(/[^A-Za-z0-9]/g, "")}abcdefgh`,
    stripePaymentIntentId: "pi_test_1",
    status: "open",
    paymentStatus: "paid",
    amounts: { currency: "usd", subtotal: 2000, shipping: 500, tax: 0, discount: 0, total: 2500 },
    lineItems: fulfillments.map((g, i) => ({
      variantId: g.variantIds[0],
      productId: `p${i + 1}`,
      sku: `TEST-SKU-${i + 1}`,
      name: `Test item ${i + 1}`,
      quantity: 1,
      unitAmount: 1000,
      amountTotal: 1000,
      fulfillmentSource: g.source,
      fulfillmentOrigin: g.origin ?? null,
    })),
    fulfillments,
    customer: { email: "fictional.buyer@example.com", name: "Fictional Buyer", phone: null },
    shippingAddress: { name: "Fictional Buyer", line1: "1 Example Way", line2: null, city: "Testville", state: "KY", postalCode: "40000", country: "US" },
    shippingRateId: null,
    refunds: [],
    inventoryCommitted: true,
    flags: [],
    createdAt: "2026-11-01T15:00:00.000Z",
    updatedAt: "2026-11-01T15:00:00.000Z",
    history: [],
    ...over,
  };
}
