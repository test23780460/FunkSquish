import type Stripe from "stripe";
import { fulfillCheckoutSession, orderKey, type OrderDeps } from "./fulfill";
import { unsellStock } from "./inventory";
import { updateWithRetry, type KvStore } from "./store";
import type { Order } from "./types";

/**
 * Owner-only order operations (called from signed-in server actions only).
 * Every money movement goes through Stripe with an idempotency key, and is
 * recorded on the order immediately; Stripe's charge.refunded webhook then
 * finds nothing new to add, so a refund is never counted twice.
 */

export async function listOrders(store: KvStore): Promise<Order[]> {
  const keys = await store.list("order/session/");
  const orders = await Promise.all(keys.map(async (k) => (await store.get<Order>(k))?.value));
  return orders.filter((o): o is Order => !!o).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getOrder(store: KvStore, sessionId: string): Promise<Order | null> {
  if (!/^cs_(test|live)_[A-Za-z0-9]{10,200}$/.test(sessionId)) return null;
  return (await store.get<Order>(orderKey(sessionId)))?.value ?? null;
}

export const refundedSoFar = (order: Order) => order.refunds.reduce((n, r) => n + r.amount, 0);

export type AdminResult = { ok: true; order: Order } | { ok: false; error: string };

/** Record that one package shipped. Tracking URL must be https. */
export async function markShipped(
  store: KvStore,
  sessionId: string,
  groupId: string,
  input: { carrier: string; trackingNumber: string; trackingUrl: string },
  now = new Date(),
): Promise<AdminResult> {
  const carrier = input.carrier.trim().slice(0, 40);
  const trackingNumber = input.trackingNumber.trim().replace(/\s+/g, "").slice(0, 60);
  let trackingUrl: string | null = input.trackingUrl.trim() || null;
  if (!carrier || !/^[A-Za-z0-9-]{6,60}$/.test(trackingNumber)) return { ok: false, error: "Enter the carrier and a valid tracking number." };
  if (trackingUrl) {
    try {
      const u = new URL(trackingUrl);
      if (u.protocol !== "https:") throw new Error();
      trackingUrl = u.toString();
    } catch {
      return { ok: false, error: "The tracking link must start with https://" };
    }
  }
  let error: string | null = null;
  const { value } = await updateWithRetry<Order>(store, orderKey(sessionId), (current) => {
    if (!current) return ((error = "Order not found."), undefined);
    if (current.paymentStatus !== "paid" && current.paymentStatus !== "partially_refunded") return ((error = "Only paid orders can be shipped."), undefined);
    if (current.status === "canceled") return ((error = "This order was canceled."), undefined);
    const group = current.fulfillments.find((f) => f.id === groupId);
    if (!group) return ((error = "Package not found."), undefined);
    Object.assign(group, { status: "shipped", carrier, trackingNumber, trackingUrl, shippedAt: group.shippedAt ?? now.toISOString() });
    current.status = current.fulfillments.every((f) => f.status === "shipped" || f.status === "delivered") ? "fulfilled" : "partially_fulfilled";
    current.updatedAt = now.toISOString();
    current.history.push({ source: "owner", type: `shipped:${groupId}`, at: now.toISOString() });
    return current;
  });
  return error ? { ok: false, error } : { ok: true, order: value! };
}

/** Refund part or all of what's left. Amount in cents. */
export async function refundOrder(stripe: Stripe, store: KvStore, sessionId: string, amount: number, now = new Date()): Promise<AdminResult> {
  const order = await getOrder(store, sessionId);
  if (!order || !order.stripePaymentIntentId) return { ok: false, error: "Order not found." };
  const remaining = order.amounts.total - refundedSoFar(order);
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > remaining) return { ok: false, error: `Enter an amount between $0.01 and $${(remaining / 100).toFixed(2)}.` };
  const refund = await stripe.refunds.create(
    { payment_intent: order.stripePaymentIntentId, amount, reason: "requested_by_customer", metadata: { order_id: order.id } },
    // Same order + same already-refunded total + same amount = same request, even if the button is pressed twice.
    { idempotencyKey: `funksquish-refund-${order.id}-${refundedSoFar(order)}-${amount}` },
  );
  const { value } = await updateWithRetry<Order>(store, orderKey(sessionId), (current) => {
    if (!current || current.refunds.some((r) => r.stripeRefundId === refund.id)) return undefined;
    current.refunds.push({ stripeRefundId: refund.id, amount, reason: "requested_by_customer", createdAt: now.toISOString() });
    const total = refundedSoFar(current);
    current.paymentStatus = total >= current.amounts.total ? "refunded" : "partially_refunded";
    current.updatedAt = now.toISOString();
    current.history.push({ source: "owner", type: "refund", at: now.toISOString() });
    return current;
  });
  return { ok: true, order: value ?? order };
}

/** Cancel before anything ships: refund whatever is left and put the units back in stock. */
export async function cancelOrder(stripe: Stripe, store: KvStore, sessionId: string, now = new Date()): Promise<AdminResult> {
  const order = await getOrder(store, sessionId);
  if (!order) return { ok: false, error: "Order not found." };
  if (order.fulfillments.some((f) => f.shippedAt)) return { ok: false, error: "Part of this order has shipped — refund it instead of canceling." };
  const remaining = order.amounts.total - refundedSoFar(order);
  if (remaining > 0 && order.paymentStatus !== "processing") {
    const r = await refundOrder(stripe, store, sessionId, remaining, now);
    if (!r.ok) return r;
  }
  if (order.inventoryCommitted) await unsellStock(store, order.checkoutId, order.lineItems.map((l) => l.variantId));
  const { value } = await updateWithRetry<Order>(store, orderKey(sessionId), (current) => {
    if (!current || current.status === "canceled") return undefined;
    current.status = "canceled";
    for (const f of current.fulfillments) f.status = "canceled";
    current.updatedAt = now.toISOString();
    current.history.push({ source: "owner", type: "canceled", at: now.toISOString() });
    return current;
  });
  return { ok: true, order: value ?? order };
}

/**
 * Recovery: find paid Checkout Sessions from the last `hours` and make sure
 * each has an order (e.g. if webhooks were down). Idempotent — existing
 * orders are left as they are.
 */
export async function reconcileRecentSessions(stripe: Stripe, deps: OrderDeps, hours = 72): Promise<{ checked: number; recorded: number }> {
  const since = Math.floor(deps.now().getTime() / 1000) - hours * 3600;
  let checked = 0;
  let recorded = 0;
  for await (const session of stripe.checkout.sessions.list({ created: { gte: since }, status: "complete", limit: 100 })) {
    checked++;
    const existed = await deps.store.get(orderKey(session.id));
    const outcome = await fulfillCheckoutSession(session.id, deps, "reconcile", "reconcile");
    if (!existed && (outcome.state === "paid" || outcome.state === "processing")) recorded++;
    if (checked >= 500) break;
  }
  return { checked, recorded };
}
