import type Stripe from "stripe";
import type { FulfillmentSource } from "../types";
import type { Customer, ShippingAddress } from "./types";

/**
 * The parts of a Stripe Checkout Session that order processing needs, in a
 * plain shape (easy to unit-test without the network). Always built from a
 * session freshly RETRIEVED from the Stripe API — never from the browser and
 * never from a possibly stale webhook payload alone.
 */
export interface SessionSnapshot {
  id: string;
  livemode: boolean;
  status: "open" | "complete" | "expired" | null;
  paymentStatus: "paid" | "unpaid" | "no_payment_required";
  checkoutId: string | null;
  paymentIntentId: string | null;
  amounts: { subtotal: number; shipping: number; tax: number; discount: number; total: number };
  customer: Customer;
  shippingAddress: ShippingAddress | null;
  shippingRateId: string | null;
  lineItems: {
    variantId: string;
    productId: string;
    sku: string;
    name: string;
    quantity: number;
    unitAmount: number;
    amountTotal: number;
    fulfillmentSource: FulfillmentSource;
  }[];
}

const idOf = (value: string | { id: string } | null | undefined) => (typeof value === "string" ? value : value?.id ?? null);

function sessionStatus(value: string | null): SessionSnapshot["status"] {
  if (value === "open") return "open";
  if (value === "complete") return "complete";
  if (value === "expired") return "expired";
  return null;
}

/** Anything unexpected is treated as unpaid — never as paid. */
function paymentStatus(value: string): SessionSnapshot["paymentStatus"] {
  if (value === "paid") return "paid";
  if (value === "no_payment_required") return "no_payment_required";
  return "unpaid";
}

export function snapshotFromStripeSession(session: Stripe.Checkout.Session): SessionSnapshot {
  const items = session.line_items?.data ?? [];
  const shipping = session.collected_information?.shipping_details ?? null;
  return {
    id: session.id,
    livemode: session.livemode,
    status: sessionStatus(session.status),
    paymentStatus: paymentStatus(session.payment_status),
    checkoutId: session.client_reference_id ?? session.metadata?.checkout_id ?? null,
    paymentIntentId: idOf(session.payment_intent),
    amounts: {
      subtotal: session.amount_subtotal ?? 0,
      shipping: session.total_details?.amount_shipping ?? session.shipping_cost?.amount_total ?? 0,
      tax: session.total_details?.amount_tax ?? 0,
      discount: session.total_details?.amount_discount ?? 0,
      total: session.amount_total ?? 0,
    },
    customer: {
      email: session.customer_details?.email ?? null,
      name: session.customer_details?.name ?? null,
      phone: session.customer_details?.phone ?? null,
    },
    shippingAddress: shipping
      ? {
          name: shipping.name ?? null,
          line1: shipping.address?.line1 ?? null,
          line2: shipping.address?.line2 ?? null,
          city: shipping.address?.city ?? null,
          state: shipping.address?.state ?? null,
          postalCode: shipping.address?.postal_code ?? null,
          country: shipping.address?.country ?? null,
        }
      : null,
    shippingRateId: idOf(session.shipping_cost?.shipping_rate),
    lineItems: items.map((item) => {
      const product = item.price?.product;
      const meta = (product && typeof product === "object" && "metadata" in product ? product.metadata : {}) as Record<string, string>;
      return {
        variantId: meta.variant_id ?? "",
        productId: meta.product_id ?? "",
        sku: meta.sku ?? "",
        name: item.description ?? "",
        quantity: item.quantity ?? 0,
        unitAmount: item.price?.unit_amount ?? 0,
        amountTotal: item.amount_total,
        fulfillmentSource: meta.fulfillment_source === "supplier" ? "supplier" : "in_house",
      };
    }),
  };
}
