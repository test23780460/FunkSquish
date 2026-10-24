import type { FulfillmentSource } from "../types";

/**
 * Order data model (server-only). See docs/ORDER-MANAGEMENT.md.
 *
 * An order is created ONLY from a verified Stripe Checkout Session whose
 * payment_status is "paid" (or later from async_payment_succeeded) — never
 * from the browser redirect. Records contain personal data, so they live in
 * private server storage only: never in GitHub, never in browser bundles,
 * never in ordinary logs.
 */

export type OrderMode = "test" | "live";

/** Money in integer minor units (cents). */
export interface Amounts {
  currency: "usd";
  subtotal: number;
  shipping: number;
  tax: number;
  discount: number;
  total: number;
}

export type PaymentStatus =
  | "paid" // money captured (card) or async payment succeeded
  | "processing" // delayed payment method still pending
  | "failed" // async payment failed
  | "partially_refunded"
  | "refunded";

export type OrderStatus =
  | "awaiting_payment" // checkout completed with a delayed payment method
  | "open" // paid, needs fulfillment
  | "partially_fulfilled"
  | "fulfilled"
  | "canceled"; // canceled before shipping (refund issued separately)

export type FulfillmentStatus =
  | "unfulfilled"
  | "awaiting_supplier" // supplier-shipped: we still have to place the order with the partner (manually)
  | "sent_to_supplier"
  | "packed"
  | "shipped" // tracking number known
  | "delivered"
  | "canceled";

export interface OrderLineItem {
  variantId: string;
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  unitAmount: number;
  /** Amount actually charged for this line after discounts, from Stripe. */
  amountTotal: number;
  fulfillmentSource: FulfillmentSource;
}

/**
 * One shipment. Orders mixing our stock and supplier stock are split into
 * one group per source, each with its own tracking.
 */
export interface FulfillmentGroup {
  id: string;
  source: FulfillmentSource;
  /** Private reference to the partner, set manually by the owner (never public). */
  supplierRef: string | null;
  variantIds: string[];
  status: FulfillmentStatus;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
}

export interface ShippingAddress {
  name: string | null;
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
}

export interface Customer {
  email: string | null;
  name: string | null;
  phone: string | null;
}

export interface RefundRecord {
  stripeRefundId: string | null;
  amount: number;
  reason: string | null;
  createdAt: string;
}

export interface OrderEventRecord {
  /** Stripe event id, or "landing-page" when triggered by the success page. */
  source: string;
  type: string;
  at: string;
}

export interface Order {
  /** Our order number, e.g. FS-T-20261024-7K3QX (T = test mode). */
  id: string;
  mode: OrderMode;
  checkoutId: string;
  stripeCheckoutSessionId: string;
  stripePaymentIntentId: string | null;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  amounts: Amounts;
  lineItems: OrderLineItem[];
  fulfillments: FulfillmentGroup[];
  customer: Customer;
  shippingAddress: ShippingAddress | null;
  shippingRateId: string | null;
  refunds: RefundRecord[];
  /** True once stock for this order has been committed (sold) exactly once. */
  inventoryCommitted: boolean;
  /** Problems needing a human, e.g. "oversold" (a hold expired and stock ran out). */
  flags: string[];
  createdAt: string;
  updatedAt: string;
  history: OrderEventRecord[];
}
