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
  /** Sales tax on the shipping charge (part of `tax`). Missing on orders recorded before packages were priced separately. */
  shippingTax?: number;
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
  | "lost" // carrier confirmed it lost (or never arrived after investigation): replace or refund
  | "returned" // came back to us undeliverable: reship or refund (Shipping Policy: refund within 5 business days)
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
  /** Sales tax on this line, from Stripe (0 when tax is off). */
  amountTax?: number;
  fulfillmentSource: FulfillmentSource;
  /** Origin it ships from (src/commerce/origins.ts). Missing on older orders. */
  fulfillmentOrigin?: string | null;
}

/**
 * One package. Each origin in the cart (our studio, each supplier) is one
 * package with its own shipping charge, ship-by date, tracking and emails.
 * (Orders recorded before origins existed have one group per source.)
 */
export interface FulfillmentGroup {
  id: string;
  source: FulfillmentSource;
  /** Origin id (src/commerce/origins.ts). */
  origin?: string;
  /** Shipping charged for this package at checkout, in cents. Null on older orders (one charge for everything). */
  shippingAmount?: number | null;
  /** Business days from payment to ship-by, as promised at checkout. */
  processingBusinessDays?: number;
  /** False when this origin can't ship to APO/FPO/DPO addresses. */
  militaryAddresses?: boolean;
  /** Private reference to the partner, set manually by the owner (never public). */
  supplierRef: string | null;
  variantIds: string[];
  status: FulfillmentStatus;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  /**
   * Ship-by date (YYYY-MM-DD, Eastern Time) promised by the Shipping Policy:
   * 2 business days after payment for our own stock. Null = not known yet
   * (supplier-shipped: the owner sets it from the product's stated time).
   * Moved later only by a delay notice to the customer.
   */
  shipBy?: string | null;
  /** FTC Mail Order Rule delay notices sent for this package (16 CFR 435.2(b)). */
  delayNotices?: DelayNoticeRecord[];
  canceledAt?: string | null;
  /** When the owner recorded the package as lost. */
  lostAt?: string | null;
  /** When an undeliverable package came back to us, and why. */
  returnedAt?: string | null;
  returnCause?: ReturnCause | null;
  /** How a lost/returned package was settled. */
  resolution?: "reshipped" | "refunded" | null;
  /** Earlier shipments of this package (a replacement was sent after a loss or return). */
  previousShipments?: PreviousShipment[];
  /** Supplier-shipped: the order the owner placed with the supplier (manually), its updates and problems. */
  supplierOrder?: SupplierOrderRecord | null;
}

export type SupplierOrderStatus = "placed" | "confirmed" | "processing" | "problem" | "shipped" | "canceled";
export type SupplierExceptionKind = "delay" | "out-of-stock" | "wrong-item" | "damaged" | "address" | "no-tracking" | "other";

export interface SupplierOrderRecord {
  /** Dashboard supplier id (private). */
  supplierId: string;
  /** The supplier's own order number / reference. */
  reference: string;
  placedAt: string;
  status: SupplierOrderStatus;
  /** When the supplier said they'd ship (YYYY-MM-DD), if they did. Separate from the customer's ship-by date. */
  expectedShipBy: string | null;
  exceptions: { id: string; at: string; kind: SupplierExceptionKind; note: string; resolvedAt: string | null }[];
  updates: { at: string; status: SupplierOrderStatus; note: string | null }[];
}

/** Why a package came back undeliverable. "address" = the address given at checkout was wrong. */
export type ReturnCause = "address" | "refused" | "carrier" | "us";

export interface PreviousShipment {
  carrier: string | null;
  trackingNumber: string | null;
  shippedAt: string | null;
  outcome: "lost" | "returned";
  at: string;
}

export interface DelayNoticeRecord {
  at: string;
  /** The ship-by date before this notice. */
  previousShipBy: string | null;
  /** Revised date offered, or null when we couldn't give one. */
  newShipBy: string | null;
  /** True when silence does NOT count as agreement (over 30 days late, no date, or a renewed delay). */
  expressConsentNeeded: boolean;
  email: "sent" | "failed" | "skipped";
  code?: string;
}

/** A card dispute (chargeback or inquiry) reported by Stripe's charge.dispute.* webhooks. */
export interface DisputeRecord {
  stripeDisputeId: string;
  amount: number;
  reason: string | null;
  status: string;
  /** When evidence is due (ISO), if Stripe gave one. */
  evidenceDueBy: string | null;
  /** Latest Stripe event time (ISO, whole seconds) seen for this dispute. */
  eventAt?: string | null;
  /** When these facts were last read from Stripe's Dispute object (ISO); null if only from events. */
  verifiedAt?: string | null;
  /** Conflicting updates Stripe couldn't be asked about: the owner should check the dispute in Stripe. */
  needsCheck?: boolean;
  createdAt: string;
  updatedAt: string;
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
  /** The package this refund was for, when refunded per package. */
  groupId?: string | null;
}

export interface OrderEventRecord {
  /** Stripe event id, or "landing-page" when triggered by the success page. */
  source: string;
  type: string;
  at: string;
}

export interface NotificationRecord {
  /** "sending" is a claim taken just before sending, so two processes can't both send. */
  status: "sending" | "sent" | "failed" | "skipped";
  at: string;
  /** Short reason/code, e.g. "test-mode" or "brevo-401". Never message content. */
  code?: string;
}

export interface OrderNotifications {
  customer?: NotificationRecord;
  owner?: NotificationRecord;
  /** Per fulfillment group id. */
  shipping?: Record<string, NotificationRecord>;
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
  /** Order emails sent (or skipped) — each one at most once. */
  notifications?: OrderNotifications;
  /** Card disputes on this order's payment. */
  disputes?: DisputeRecord[];
  /** Policy versions shown when the customer paid, e.g. "terms=2026-10-27;shipping=2026-10-27;returns=2026-10-27". */
  policyVersions?: string | null;
}
