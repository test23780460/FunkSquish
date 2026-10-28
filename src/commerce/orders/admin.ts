import type Stripe from "stripe";
import { fulfillCheckoutSession, orderKey, type OrderDeps } from "./fulfill";
import { unsellStock } from "./inventory";
import { updateWithRetry, type KvStore } from "./store";
import type { DelayNoticeRecord, Order } from "./types";
import { addCalendarDays, easternDate, isValidDay, shipByState } from "./ship-by";
import { isOpenDispute } from "./fulfill";
import { delayNoticeEmail, type NotifyConfig } from "./notify";

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
  const before = refundedSoFar(order);
  const remaining = order.amounts.total - before;
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > remaining) return { ok: false, error: `Enter an amount between $0.01 and $${(remaining / 100).toFixed(2)}.` };
  const refund = await stripe.refunds.create(
    { payment_intent: order.stripePaymentIntentId, amount, reason: "requested_by_customer", metadata: { order_id: order.id } },
    // Same order + same already-refunded total + same amount = same request, even if the button is pressed twice.
    { idempotencyKey: `funksquish-refund-${order.id}-${refundedSoFar(order)}-${amount}` },
  );
  const { value } = await updateWithRetry<Order>(store, orderKey(sessionId), (current) => {
    if (!current || current.refunds.some((r) => r.stripeRefundId === refund.id)) return undefined;
    if (refundedSoFar(current) >= before + amount) {
      // Stripe's charge.refunded webhook already recorded this refund (it doesn't know the refund id).
      // Label that record instead of adding a second one, so the refund is counted once.
      const unlabeled = current.refunds.findIndex((r) => r.stripeRefundId === null && r.amount === amount);
      if (unlabeled === -1) return undefined;
      current.refunds[unlabeled] = { ...current.refunds[unlabeled], stripeRefundId: refund.id, reason: "requested_by_customer" };
      current.updatedAt = now.toISOString();
      return current;
    }
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

/* ------------------------------ what needs the owner ------------------------------ */

export interface Attention {
  code: "ship-overdue" | "ship-due-today" | "set-ship-by" | "dispute" | "restricted_destination" | "oversold";
  label: string;
  groupId?: string;
}

const unshipped = (status: string) => !["shipped", "delivered", "canceled"].includes(status);

/**
 * Everything on an order the owner must act on, most urgent first. Shipping
 * deadlines come from the Shipping Policy (and the FTC Mail Order Rule): a
 * package past its ship-by date needs a delay notice or a refund today.
 */
export function orderAttention(order: Order, now = new Date()): Attention[] {
  const out: Attention[] = [];
  const live = order.status !== "canceled" && (order.paymentStatus === "paid" || order.paymentStatus === "partially_refunded");
  for (const d of order.disputes ?? [])
    if (isOpenDispute(d.status))
      out.push({ code: "dispute", label: `Card dispute (${d.reason ?? "no reason given"}) — respond in Stripe${d.evidenceDueBy ? ` by ${d.evidenceDueBy.slice(0, 10)}` : ""}` });
  if (order.flags.includes("restricted_destination")) out.push({ code: "restricted_destination", label: "Territory address — cancel and refund in full" });
  if (order.flags.includes("oversold")) out.push({ code: "oversold", label: "Oversold — contact the customer and refund" });
  if (live)
    for (const g of order.fulfillments) {
      if (!unshipped(g.status)) continue;
      if (!g.shipBy) {
        out.push({ code: "set-ship-by", label: "Set the ship-by date (supplier package)", groupId: g.id });
        continue;
      }
      const state = shipByState(g.shipBy, now);
      if (state === "overdue") out.push({ code: "ship-overdue", label: `Ship-by date ${g.shipBy} has passed — ship, send a delay notice, or refund`, groupId: g.id });
      if (state === "due-today") out.push({ code: "ship-due-today", label: `Ships today (ship-by ${g.shipBy})`, groupId: g.id });
    }
  return out.sort((a, b) => URGENCY.indexOf(a.code) - URGENCY.indexOf(b.code));
}

const URGENCY: Attention["code"][] = ["dispute", "ship-overdue", "restricted_destination", "oversold", "ship-due-today", "set-ship-by"];

/** Owner sets the ship-by date of a supplier package from the product's stated processing time (only if not set yet). */
export async function setShipBy(store: KvStore, sessionId: string, groupId: string, day: string, now = new Date()): Promise<AdminResult> {
  if (!isValidDay(day)) return { ok: false, error: "Enter a valid date." };
  let error: string | null = null;
  const { value } = await updateWithRetry<Order>(store, orderKey(sessionId), (current) => {
    const g = current?.fulfillments.find((f) => f.id === groupId);
    if (!current || !g) return ((error = "Package not found."), undefined);
    if (g.shipBy) return ((error = "This package already has a ship-by date. Send a delay notice to change it."), undefined);
    g.shipBy = day;
    current.updatedAt = now.toISOString();
    current.history.push({ source: "owner", type: `ship-by:${groupId}:${day}`, at: now.toISOString() });
    return current;
  });
  return error ? { ok: false, error } : { ok: true, order: value! };
}

/**
 * Send an FTC Mail Order Rule delay notice (16 CFR 435.2(b)) for one package
 * and record it. `newShipBy` null = we can't give a date. Silence counts as
 * agreement only for a first delay to a date no more than 30 days after the
 * original ship-by date; otherwise the email asks for express consent.
 * The new date becomes the package's ship-by date.
 */
export async function sendDelayNotice(
  store: KvStore,
  sessionId: string,
  groupId: string,
  newShipBy: string | null,
  cfg: NotifyConfig,
  now = new Date(),
): Promise<AdminResult> {
  const order = await getOrder(store, sessionId);
  const g = order?.fulfillments.find((f) => f.id === groupId);
  if (!order || !g) return { ok: false, error: "Package not found." };
  if (!unshipped(g.status) || order.status === "canceled") return { ok: false, error: "This package has shipped or was canceled." };
  if (newShipBy !== null && (!isValidDay(newShipBy) || newShipBy <= easternDate(now) || (g.shipBy && newShipBy <= g.shipBy)))
    return { ok: false, error: "The new date must be a real date after today and after the current ship-by date." };
  const original = g.delayNotices?.[0]?.previousShipBy ?? g.shipBy ?? null;
  const renewed = (g.delayNotices?.length ?? 0) > 0;
  const expressConsentNeeded = renewed || newShipBy === null || !original || newShipBy > addCalendarDays(original, 30);
  const msg = delayNoticeEmail(order, groupId, { newShipBy, originalShipBy: original, expressConsentNeeded, cancelBy: original ? addCalendarDays(original, 30) : null }, cfg);

  let email: DelayNoticeRecord["email"] = "skipped";
  let code: string | undefined = order.mode === "test" && !cfg.sendInTestMode ? "test-mode" : undefined;
  if (!code) {
    if (!cfg.mailer || !order.customer.email) [email, code] = ["failed", !cfg.mailer ? "not-configured" : "no-address"];
    else {
      const r = await cfg.mailer.send({ to: order.customer.email, subject: msg.subject, html: msg.html, tag: "order-delay" });
      [email, code] = r.ok ? ["sent", undefined] : ["failed", r.code];
    }
  }
  const at = now.toISOString();
  const { value } = await updateWithRetry<Order>(store, orderKey(sessionId), (current) => {
    const cg = current?.fulfillments.find((f) => f.id === groupId);
    if (!current || !cg) return undefined;
    (cg.delayNotices ??= []).push({ at, previousShipBy: cg.shipBy ?? null, newShipBy, expressConsentNeeded, email, ...(code ? { code } : {}) });
    if (email !== "failed" && newShipBy) cg.shipBy = newShipBy;
    current.updatedAt = at;
    current.history.push({ source: "owner", type: `delay-notice:${groupId}:${email}`, at });
    return current;
  });
  if (email === "failed") return { ok: false, error: `The delay email couldn't be sent (${code}). Nothing was changed — email the customer yourself or try again.` };
  return { ok: true, order: value ?? order };
}
