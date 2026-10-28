import type Stripe from "stripe";
import { fulfillCheckoutSession, orderKey, type OrderDeps } from "./fulfill";
import { unsellStock } from "./inventory";
import { updateWithRetry, type KvStore } from "./store";
import type { DelayNoticeRecord, FulfillmentGroup, Order, ReturnCause } from "./types";
import { addBusinessDays, addCalendarDays, easternDate, isValidDay, shipByFor, shipByState } from "./ship-by";
import { isOpenDispute } from "./fulfill";
import { delayNoticeEmail, shippingSlotId, type NotifyConfig } from "./notify";
import { deductWebsiteShipment } from "./stock-admin";

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

export type AdminResult = { ok: true; order: Order; warning?: string } | { ok: false; error: string };

/**
 * Record that one package shipped. Tracking URL must be https. With
 * `catalogOnHand`, the package's units also come off the stock count (once per
 * shipment — see stock-admin.ts `deductWebsiteShipment`).
 */
export async function markShipped(
  store: KvStore,
  sessionId: string,
  groupId: string,
  input: { carrier: string; trackingNumber: string; trackingUrl: string },
  now = new Date(),
  catalogOnHand?: (variantId: string) => number | null,
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
    if (group.status === "canceled") return ((error = "This package was canceled."), undefined);
    if (group.status === "lost" || group.status === "returned") return ((error = "This package was lost or came back. Send a replacement (or refund it) first."), undefined);
    Object.assign(group, { status: "shipped", carrier, trackingNumber, trackingUrl, shippedAt: group.shippedAt ?? now.toISOString() });
    recomputeStatus(current);
    current.updatedAt = now.toISOString();
    current.history.push({ source: "owner", type: `shipped:${groupId}`, at: now.toISOString() });
    return current;
  });
  if (error) return { ok: false, error };
  if (!catalogOnHand) return { ok: true, order: value! };
  const { shortfall } = await deductWebsiteShipment(store, value!, groupId, shippingSlotId(value!, groupId), catalogOnHand, now);
  return shortfall.length
    ? { ok: true, order: value!, warning: `Your stock count was lower than what this package holds (${shortfall.map((x) => `${x.units} × ${x.variantId}`).join(", ")}). It's now 0 — recount the shelf.` }
    : { ok: true, order: value! };
}

/** Refund part or all of what's left. Amount in cents. `groupId` ties the refund to one package. */
export async function refundOrder(stripe: Stripe, store: KvStore, sessionId: string, amount: number, now = new Date(), groupId: string | null = null): Promise<AdminResult> {
  const order = await getOrder(store, sessionId);
  if (!order || !order.stripePaymentIntentId) return { ok: false, error: "Order not found." };
  const before = refundedSoFar(order);
  const remaining = order.amounts.total - before;
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > remaining) return { ok: false, error: `Enter an amount between $0.01 and $${(remaining / 100).toFixed(2)}.` };
  const refund = await stripe.refunds.create(
    { payment_intent: order.stripePaymentIntentId, amount, reason: "requested_by_customer", metadata: { order_id: order.id, ...(groupId ? { package: groupId } : {}) } },
    // Same order + same already-refunded total + same amount (+ package) = same request, even if the button is pressed twice.
    { idempotencyKey: `funksquish-refund-${order.id}-${refundedSoFar(order)}-${amount}${groupId ? `-${groupId}` : ""}` },
  );
  const { value } = await updateWithRetry<Order>(store, orderKey(sessionId), (current) => {
    if (!current || current.refunds.some((r) => r.stripeRefundId === refund.id)) return undefined;
    if (refundedSoFar(current) >= before + amount) {
      // Stripe's charge.refunded webhook already recorded this refund (it doesn't know the refund id).
      // Label that record instead of adding a second one, so the refund is counted once.
      const unlabeled = current.refunds.findIndex((r) => r.stripeRefundId === null && r.amount === amount);
      if (unlabeled === -1) return undefined;
      current.refunds[unlabeled] = { ...current.refunds[unlabeled], stripeRefundId: refund.id, reason: "requested_by_customer", groupId };
      current.updatedAt = now.toISOString();
      return current;
    }
    current.refunds.push({ stripeRefundId: refund.id, amount, reason: "requested_by_customer", createdAt: now.toISOString(), groupId });
    const total = refundedSoFar(current);
    current.paymentStatus = total >= current.amounts.total ? "refunded" : "partially_refunded";
    current.updatedAt = now.toISOString();
    current.history.push({ source: "owner", type: groupId ? `refund:${groupId}` : "refund", at: now.toISOString() });
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
    for (const f of current.fulfillments) Object.assign(f, { status: "canceled", canceledAt: f.canceledAt ?? now.toISOString() });
    current.updatedAt = now.toISOString();
    current.history.push({ source: "owner", type: "canceled", at: now.toISOString() });
    return current;
  });
  return { ok: true, order: value ?? order };
}

/* ------------------------------ packages ------------------------------ */

const PAID = new Set(["paid", "partially_refunded", "refunded"]);
const settledPackage = (g: FulfillmentGroup) =>
  g.status === "canceled" || ((g.status === "lost" || g.status === "returned") && g.resolution === "refunded");

/** Order status from its packages (only for orders that were paid). */
export function recomputeStatus(order: Order): void {
  if (!PAID.has(order.paymentStatus)) return;
  const active = order.fulfillments.filter((g) => !settledPackage(g));
  if (active.length === 0) order.status = order.fulfillments.some((g) => g.shippedAt || g.previousShipments?.length) ? "fulfilled" : "canceled";
  else if (active.every((g) => g.status === "shipped" || g.status === "delivered")) order.status = "fulfilled";
  else if (order.fulfillments.some((g) => g.shippedAt)) order.status = "partially_fulfilled";
  else order.status = "open";
}

/** Split `total` across keys in proportion to `weights`, to the cent (largest remainder). */
export function allocate(total: number, weights: Record<string, number>): Record<string, number> {
  const keys = Object.keys(weights);
  const sum = keys.reduce((n, k) => n + weights[k], 0);
  const out: Record<string, number> = Object.fromEntries(keys.map((k) => [k, 0]));
  if (total <= 0 || sum <= 0) return out;
  const exact = keys.map((k) => ({ k, v: (total * weights[k]) / sum }));
  for (const e of exact) out[e.k] = Math.floor(e.v);
  let left = total - keys.reduce((n, k) => n + out[k], 0);
  for (const e of [...exact].sort((a, b) => b.v - Math.floor(b.v) - (a.v - Math.floor(a.v)) || a.k.localeCompare(b.k))) {
    if (left-- <= 0) break;
    out[e.k]++;
  }
  return out;
}

export interface PackageAmounts {
  /** Items in this package, after discounts and including their tax (Stripe's line totals). */
  items: number;
  shipping: number;
  /** This package's share of the tax on shipping. */
  shippingTax: number;
  total: number;
  refunded: number;
  /** What a package refund would send now (never more than is left on the order). */
  refundable: number;
}

/**
 * What one package cost the customer. Null for orders recorded before
 * per-package pricing (one shipping charge for everything) — refund those by amount.
 */
export function packageAmounts(order: Order, groupId: string): PackageAmounts | null {
  const g = order.fulfillments.find((f) => f.id === groupId);
  if (!g || typeof g.shippingAmount !== "number") return null;
  const weights = Object.fromEntries(order.fulfillments.map((f) => [f.id, typeof f.shippingAmount === "number" ? f.shippingAmount : 0]));
  const shippingTax = allocate(order.amounts.shippingTax ?? 0, weights)[groupId] ?? 0;
  const items = order.lineItems.filter((l) => g.variantIds.includes(l.variantId)).reduce((n, l) => n + l.amountTotal, 0);
  const total = items + g.shippingAmount + shippingTax;
  const refunded = order.refunds.filter((r) => r.groupId === groupId).reduce((n, r) => n + r.amount, 0);
  const orderLeft = order.amounts.total - refundedSoFar(order);
  return { items, shipping: g.shippingAmount, shippingTax, total, refunded, refundable: Math.max(0, Math.min(total - refunded, orderLeft)) };
}

const findGroup = (order: Order | null, groupId: string) => order?.fulfillments.find((f) => f.id === groupId) ?? null;

/**
 * Refund one package in full: its items, its shipping charge and the tax on
 * both. Used when a package is lost or came back (and isn't being reshipped),
 * or when the customer cancels one delayed package.
 */
export async function refundPackage(stripe: Stripe, store: KvStore, sessionId: string, groupId: string, now = new Date()): Promise<AdminResult> {
  const order = await getOrder(store, sessionId);
  const g = findGroup(order, groupId);
  if (!order || !g) return { ok: false, error: "Package not found." };
  const amounts = packageAmounts(order, groupId);
  if (!amounts) return { ok: false, error: "This order was placed before packages were priced separately — refund an amount instead." };
  if (amounts.refundable <= 0) return { ok: false, error: "Nothing is left to refund for this package." };
  const r = await refundOrder(stripe, store, sessionId, amounts.refundable, now, groupId);
  if (!r.ok) return r;
  const { value } = await updateWithRetry<Order>(store, orderKey(sessionId), (current) => {
    const cg = findGroup(current, groupId);
    if (!current || !cg) return undefined;
    if (cg.status === "lost" || cg.status === "returned") cg.resolution = "refunded";
    recomputeStatus(current);
    current.updatedAt = now.toISOString();
    return current;
  });
  return { ok: true, order: value ?? r.order };
}

/**
 * Cancel ONE package before it ships (e.g. the customer declined a delay):
 * refund that package in full and put its units back in stock. The rest of
 * the order carries on. A supplier package already placed with the supplier
 * must be canceled with them first.
 */
export async function cancelPackage(
  stripe: Stripe,
  store: KvStore,
  sessionId: string,
  groupId: string,
  opts: { supplierCanceled?: boolean } = {},
  now = new Date(),
): Promise<AdminResult> {
  const order = await getOrder(store, sessionId);
  const g = findGroup(order, groupId);
  if (!order || !g) return { ok: false, error: "Package not found." };
  if (g.shippedAt || !unshipped(g.status)) return { ok: false, error: "This package has shipped or was canceled. Refund it instead." };
  if (g.status === "sent_to_supplier" && !opts.supplierCanceled)
    return { ok: false, error: "This package was placed with the supplier. Cancel it with them first, then tick the box to confirm." };
  const amounts = packageAmounts(order, groupId);
  if (!amounts) return { ok: false, error: "This order was placed before packages were priced separately — cancel the whole order or refund an amount." };
  if (amounts.refundable > 0 && order.paymentStatus !== "processing") {
    const r = await refundOrder(stripe, store, sessionId, amounts.refundable, now, groupId);
    if (!r.ok) return r;
  }
  if (order.inventoryCommitted) await unsellStock(store, order.checkoutId, g.variantIds);
  const { value } = await updateWithRetry<Order>(store, orderKey(sessionId), (current) => {
    const cg = findGroup(current, groupId);
    if (!current || !cg || cg.status === "canceled") return undefined;
    Object.assign(cg, { status: "canceled", canceledAt: now.toISOString() });
    recomputeStatus(current);
    current.updatedAt = now.toISOString();
    current.history.push({ source: "owner", type: `canceled:${groupId}`, at: now.toISOString() });
    return current;
  });
  return { ok: true, order: value ?? order };
}

/** The carrier confirmed a package lost: the customer gets a replacement or a refund (owner chooses next). */
export async function markLost(store: KvStore, sessionId: string, groupId: string, now = new Date()): Promise<AdminResult> {
  let error: string | null = null;
  const { value } = await updateWithRetry<Order>(store, orderKey(sessionId), (current) => {
    const g = findGroup(current, groupId);
    if (!current || !g) return ((error = "Package not found."), undefined);
    if (g.status !== "shipped") return ((error = "Only a shipped package can be marked lost."), undefined);
    Object.assign(g, { status: "lost", lostAt: now.toISOString(), resolution: null });
    recomputeStatus(current);
    current.updatedAt = now.toISOString();
    current.history.push({ source: "owner", type: `lost:${groupId}`, at: now.toISOString() });
    return current;
  });
  return error ? { ok: false, error } : { ok: true, order: value! };
}

export const RETURN_CAUSES: Record<ReturnCause, string> = {
  address: "Address was wrong or incomplete (as given at checkout)",
  refused: "Customer refused it or didn't collect it",
  carrier: "Carrier error",
  us: "Our mistake (label, packing)",
};

/**
 * An undeliverable package came back to us. Shipping Policy: if we or the
 * carrier caused it, reship free or refund; otherwise refund the items within
 * 5 business days of it arriving back (the order page shows the deadline).
 */
export async function markReturned(store: KvStore, sessionId: string, groupId: string, cause: ReturnCause, now = new Date()): Promise<AdminResult> {
  if (!(cause in RETURN_CAUSES)) return { ok: false, error: "Choose why it came back." };
  let error: string | null = null;
  const { value } = await updateWithRetry<Order>(store, orderKey(sessionId), (current) => {
    const g = findGroup(current, groupId);
    if (!current || !g) return ((error = "Package not found."), undefined);
    if (g.status !== "shipped" && g.status !== "lost") return ((error = "Only a shipped package can come back."), undefined);
    Object.assign(g, { status: "returned", returnedAt: now.toISOString(), returnCause: cause, resolution: null });
    recomputeStatus(current);
    current.updatedAt = now.toISOString();
    current.history.push({ source: "owner", type: `returned:${groupId}:${cause}`, at: now.toISOString() });
    return current;
  });
  return error ? { ok: false, error } : { ok: true, order: value! };
}

/**
 * Send a replacement for a lost or returned package, at no charge to the
 * customer. The old tracking is kept in the package's history and a new
 * ship-by date starts from today (the package's committed processing time).
 */
export async function reshipPackage(store: KvStore, sessionId: string, groupId: string, now = new Date()): Promise<AdminResult> {
  let error: string | null = null;
  const { value } = await updateWithRetry<Order>(store, orderKey(sessionId), (current) => {
    const g = findGroup(current, groupId);
    if (!current || !g) return ((error = "Package not found."), undefined);
    if ((g.status !== "lost" && g.status !== "returned") || g.resolution) return ((error = "Only a lost or returned package that hasn't been refunded can be reshipped."), undefined);
    (g.previousShipments ??= []).push({ carrier: g.carrier, trackingNumber: g.trackingNumber, shippedAt: g.shippedAt, outcome: g.status, at: now.toISOString() });
    Object.assign(g, {
      status: g.source === "supplier" ? "awaiting_supplier" : "unfulfilled",
      resolution: "reshipped",
      carrier: null,
      trackingNumber: null,
      trackingUrl: null,
      shippedAt: null,
      deliveredAt: null,
      shipBy: shipByFor(now, g.processingBusinessDays),
    });
    recomputeStatus(current);
    current.updatedAt = now.toISOString();
    current.history.push({ source: "owner", type: `reship:${groupId}`, at: now.toISOString() });
    return current;
  });
  return error ? { ok: false, error } : { ok: true, order: value! };
}

/** Business-day deadline to refund a package that came back (Shipping Policy: within 5 business days of receipt). */
export const returnedRefundDeadline = (returnedAt: string) => addBusinessDays(easternDate(new Date(returnedAt)), 5);

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
  code:
    | "ship-overdue"
    | "ship-due-today"
    | "set-ship-by"
    | "dispute"
    | "restricted_destination"
    | "oversold"
    | "package-lost"
    | "package-returned"
    | "military_unsupported"
    | "shipping_mismatch";
  label: string;
  groupId?: string;
}

const unshipped = (status: string) => !["shipped", "delivered", "canceled", "lost", "returned"].includes(status);

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
  if (order.flags.includes("military_unsupported"))
    out.push({ code: "military_unsupported", label: "APO/FPO/DPO address, but a package's origin can't ship there — refund that package and tell the customer" });
  if (order.flags.includes("shipping_mismatch"))
    out.push({ code: "shipping_mismatch", label: "Package shipping charges didn't match checkout — check the order in Stripe before shipping" });
  if (live)
    for (const g of order.fulfillments) {
      if (g.status === "lost" && !g.resolution) out.push({ code: "package-lost", label: "Package lost — send a replacement or refund it", groupId: g.id });
      if (g.status === "returned" && !g.resolution && g.returnedAt)
        out.push({
          code: "package-returned",
          label: `Package came back (${RETURN_CAUSES[g.returnCause ?? "address"].toLowerCase()}) — ${g.returnCause === "carrier" || g.returnCause === "us" ? "reship free or refund" : "refund (or reship if the customer agrees)"} by ${returnedRefundDeadline(g.returnedAt)}`,
          groupId: g.id,
        });
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

const URGENCY: Attention["code"][] = [
  "dispute",
  "ship-overdue",
  "package-returned",
  "package-lost",
  "restricted_destination",
  "military_unsupported",
  "oversold",
  "shipping_mismatch",
  "ship-due-today",
  "set-ship-by",
];

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
