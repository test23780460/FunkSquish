import type { FulfillmentGroup, Order, OrderLineItem } from "./types";

/**
 * Sort every package (fulfillment group) of every order into what has to
 * happen next. Pure: derived from stored orders only.
 *  - ours:     our own stock, paid, not shipped yet (pack it)
 *  - supplier: a supplier ships it and we haven't placed it with them yet
 *  - sent:     placed with the supplier, waiting for their tracking
 *  - transit:  shipped, not marked delivered
 *  - problems: lost or came back, not settled yet
 *  - done:     delivered, or settled (reshipped/refunded), or canceled
 * Packages on unpaid or canceled orders never land in a "to do" queue.
 */
export const QUEUES = ["ours", "supplier", "sent", "transit", "problems", "done"] as const;
export type QueueId = (typeof QUEUES)[number];

export const QUEUE_LABEL: Record<QueueId, string> = {
  ours: "To pack (ours)",
  supplier: "Place with supplier",
  sent: "With supplier",
  transit: "In transit",
  problems: "Problems",
  done: "Done",
};

export interface QueueRow {
  order: Order;
  group: FulfillmentGroup;
  items: OrderLineItem[];
}

const payable = (o: Order) => o.status !== "canceled" && (o.paymentStatus === "paid" || o.paymentStatus === "partially_refunded");

export function queueFor(order: Order, g: FulfillmentGroup): QueueId {
  if (g.status === "canceled" || order.status === "canceled") return "done";
  if ((g.status === "lost" || g.status === "returned") && !g.resolution) return "problems";
  if (g.resolution || g.status === "delivered") return "done";
  if (g.status === "shipped") return "transit";
  if (!payable(order)) return "done";
  if (g.status === "sent_to_supplier") return "sent";
  if (g.source === "supplier" && (g.status === "awaiting_supplier" || g.status === "unfulfilled")) return "supplier";
  return "ours"; // unfulfilled / packed
}

export function fulfillmentQueue(orders: Order[], now = new Date()): Record<QueueId, QueueRow[]> {
  void now;
  const out = Object.fromEntries(QUEUES.map((q) => [q, [] as QueueRow[]])) as Record<QueueId, QueueRow[]>;
  for (const order of orders)
    for (const group of order.fulfillments) {
      const items = order.lineItems.filter((l) => group.variantIds.includes(l.variantId));
      out[queueFor(order, group)].push({ order, group, items });
    }
  // Soonest deadline first in the to-do queues; newest first elsewhere.
  for (const q of ["ours", "supplier", "sent"] as const) out[q].sort((a, b) => (a.group.shipBy ?? "9999").localeCompare(b.group.shipBy ?? "9999"));
  for (const q of ["transit", "problems", "done"] as const) out[q].sort((a, b) => b.order.createdAt.localeCompare(a.order.createdAt));
  return out;
}
