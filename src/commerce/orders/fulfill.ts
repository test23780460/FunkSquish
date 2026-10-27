import { createHash } from "node:crypto";
import { commitStock, getReservation, releaseStock } from "./inventory";
import { updateWithRetry, type KvStore } from "./store";
import type { SessionSnapshot } from "./session-snapshot";
import { isAllowedDestination } from "./shipping-restrictions";
import { shipByFor } from "./ship-by";
import type { FulfillmentGroup, Order, OrderEventRecord } from "./types";

/**
 * Durable, idempotent order processing (Stripe "fulfill_checkout" pattern).
 *
 * `fulfillCheckoutSession` may run several times — from the webhook, from
 * Stripe's automatic retries, and from the success page — possibly at the
 * same moment. It always ends with exactly one order per Checkout Session,
 * and stock is committed exactly once. The browser redirect alone never
 * creates an order: the session is re-fetched from Stripe and must be paid.
 */

export interface OrderDeps {
  store: KvStore;
  retrieveSession(sessionId: string): Promise<SessionSnapshot>;
  /** Catalog on-hand count for a variant, or null if unknown. */
  onHand(variantId: string): number | null;
  now(): Date;
  /** Which Stripe mode this store belongs to. Sessions and events of the other mode are refused. Default: test. */
  mode?: "test" | "live";
  /** Sends order emails once an order is paid (see ./notify). Optional so pure tests can skip it. */
  afterPaid?(order: Order): Promise<void>;
}

export const orderKey = (sessionId: string) => `order/session/${sessionId}`;
const piKey = (paymentIntentId: string) => `order/pi/${paymentIntentId}`;

export const TEST_SESSION_ID = /^cs_test_[A-Za-z0-9]{10,200}$/;
export const LIVE_SESSION_ID = /^cs_live_[A-Za-z0-9]{10,200}$/;
const modeOf = (deps: Pick<OrderDeps, "mode">) => deps.mode ?? "test";

/** Deterministic order number so retries can never create two orders. */
export function orderNumberFor(sessionId: string, at: Date, mode: "test" | "live" = "test"): string {
  const code = createHash("sha256").update(sessionId).digest("hex").slice(0, 8).toUpperCase();
  const day = at.toISOString().slice(0, 10).replaceAll("-", "");
  return `FS-${mode === "test" ? "T-" : ""}${day}-${code}`;
}

/** Our own stock gets the Shipping Policy's 2-business-day ship-by date from payment; supplier packages are set by the owner. */
function fulfillmentGroups(snapshot: SessionSnapshot, paidAt: Date | null): FulfillmentGroup[] {
  const groups: FulfillmentGroup[] = [];
  for (const source of ["in_house", "supplier"] as const) {
    const variantIds = snapshot.lineItems.filter((l) => l.fulfillmentSource === source).map((l) => l.variantId);
    if (variantIds.length === 0) continue;
    groups.push({
      id: `${source}-1`,
      source,
      supplierRef: null,
      variantIds,
      // Supplier items are placed with the partner MANUALLY by the owner. Nothing is auto-purchased.
      status: source === "supplier" ? "awaiting_supplier" : "unfulfilled",
      carrier: null,
      trackingNumber: null,
      trackingUrl: null,
      shippedAt: null,
      deliveredAt: null,
      shipBy: source === "in_house" && paidAt ? shipByFor(paidAt) : null,
      delayNotices: [],
    });
  }
  return groups;
}

function newOrder(snapshot: SessionSnapshot, paid: boolean, at: Date, trigger: OrderEventRecord, mode: "test" | "live"): Order {
  const iso = at.toISOString();
  return {
    id: orderNumberFor(snapshot.id, at, mode),
    mode,
    checkoutId: snapshot.checkoutId ?? "",
    stripeCheckoutSessionId: snapshot.id,
    stripePaymentIntentId: snapshot.paymentIntentId,
    status: paid ? "open" : "awaiting_payment",
    paymentStatus: paid ? "paid" : "processing",
    amounts: { currency: "usd", ...snapshot.amounts },
    lineItems: snapshot.lineItems.map((l) => ({ ...l })),
    fulfillments: fulfillmentGroups(snapshot, paid ? at : null),
    customer: snapshot.customer,
    shippingAddress: snapshot.shippingAddress,
    shippingRateId: snapshot.shippingRateId,
    refunds: [],
    inventoryCommitted: false,
    // Territory / non-US address slipped through Stripe's form → refund, don't ship.
    flags: isAllowedDestination(snapshot.shippingAddress) ? [] : ["restricted_destination"],
    createdAt: iso,
    updatedAt: iso,
    history: [trigger],
    policyVersions: snapshot.policyVersions ?? null,
  };
}

function addHistory(order: Order, trigger: OrderEventRecord) {
  if (!order.history.some((h) => h.source === trigger.source && h.type === trigger.type)) order.history.push(trigger);
}

export type FulfillOutcome =
  | { state: "invalid" }
  | { state: "not_paid"; sessionStatus: SessionSnapshot["status"] }
  | { state: "processing"; order: Order }
  | { state: "paid"; order: Order };

export async function fulfillCheckoutSession(sessionId: string, deps: OrderDeps, source: string, type: string): Promise<FulfillOutcome> {
  const live = modeOf(deps) === "live";
  if (!(live ? LIVE_SESSION_ID : TEST_SESSION_ID).test(sessionId)) return { state: "invalid" };
  const snapshot = await deps.retrieveSession(sessionId);
  if (snapshot.livemode !== live || snapshot.id !== sessionId || !snapshot.checkoutId) return { state: "invalid" };

  const now = deps.now();
  const trigger: OrderEventRecord = { source, type, at: now.toISOString() };
  const paid = snapshot.paymentStatus === "paid" || snapshot.paymentStatus === "no_payment_required";

  // Checkout not finished (open / expired) → nothing to record.
  if (!paid && snapshot.status !== "complete") return { state: "not_paid", sessionStatus: snapshot.status };

  // Create or advance the single order for this session (compare-and-set).
  const { value } = await updateWithRetry<Order>(deps.store, orderKey(sessionId), (current) => {
    if (!current) return newOrder(snapshot, paid, now, trigger, modeOf(deps));
    if (paid && current.paymentStatus === "processing") {
      current.paymentStatus = "paid";
      current.status = "open";
      // The ship-by clock starts when payment actually arrives.
      for (const g of current.fulfillments) if (g.source === "in_house" && !g.shipBy) g.shipBy = shipByFor(now);
      current.amounts = { currency: "usd", ...snapshot.amounts };
      current.updatedAt = now.toISOString();
      addHistory(current, trigger);
      return current;
    }
    return undefined; // already recorded
  });
  let order = value!;

  if (order.stripePaymentIntentId) await deps.store.create(piKey(order.stripePaymentIntentId), { sessionId });

  // Commit stock exactly once, only for paid orders.
  if (order.paymentStatus === "paid" && !order.inventoryCommitted) {
    const lines = order.lineItems.map((l) => ({ variantId: l.variantId, quantity: l.quantity, onHand: deps.onHand(l.variantId) ?? 0 }));
    const { oversold } = await commitStock(deps.store, order.checkoutId, lines, Math.floor(now.getTime() / 1000));
    const result = await updateWithRetry<Order>(deps.store, orderKey(sessionId), (current) => {
      if (!current || current.inventoryCommitted) return undefined;
      current.inventoryCommitted = true;
      if (oversold && !current.flags.includes("oversold")) current.flags.push("oversold");
      current.updatedAt = now.toISOString();
      return current;
    });
    order = result.value ?? order;
  }

  // Order emails: sent at most once each (the notifier claims each email before sending).
  if (order.paymentStatus === "paid" && deps.afterPaid) {
    try {
      await deps.afterPaid(order);
    } catch (err) {
      // Never fail order processing because of email; the owner page shows what wasn't sent.
      console.error("[orders] notification error", err instanceof Error ? err.name : "unknown");
    }
  }

  // Paid orders stay "paid" for display even after a refund (the order shows the refund).
  const settled = order.paymentStatus === "paid" || order.paymentStatus === "partially_refunded" || order.paymentStatus === "refunded";
  if (order.paymentStatus === "failed") return { state: "not_paid", sessionStatus: snapshot.status };
  return settled ? { state: "paid", order } : { state: "processing", order };
}

/** Delayed payment failed: cancel the order (if any) and free the stock. */
export async function markPaymentFailed(sessionId: string, checkoutId: string | null, deps: OrderDeps, source: string): Promise<void> {
  const now = deps.now();
  await updateWithRetry<Order>(deps.store, orderKey(sessionId), (current) => {
    if (!current || current.paymentStatus === "paid" || current.paymentStatus === "failed") return undefined;
    current.paymentStatus = "failed";
    current.status = "canceled";
    current.updatedAt = now.toISOString();
    addHistory(current, { source, type: "checkout.session.async_payment_failed", at: now.toISOString() });
    return current;
  });
  if (checkoutId) await releaseStock(deps.store, checkoutId);
}

/** Session expired unpaid (or shopper canceled): free the held stock. */
export async function handleSessionExpired(checkoutId: string | null, deps: OrderDeps): Promise<void> {
  if (!checkoutId) return;
  const reservation = await getReservation(deps.store, checkoutId);
  if (reservation?.status === "held") await releaseStock(deps.store, checkoutId);
}

/**
 * Record a refund reported by Stripe (charge.refunded). Refunds are issued
 * by the owner in the Stripe Dashboard; this only keeps our order in sync.
 * Stock is NOT returned automatically — returned items must be inspected first.
 */
export async function recordRefund(
  paymentIntentId: string,
  amountRefunded: number,
  deps: OrderDeps,
  source: string,
): Promise<boolean> {
  const link = await deps.store.get<{ sessionId: string }>(piKey(paymentIntentId));
  if (!link) return false;
  const now = deps.now();
  await updateWithRetry<Order>(deps.store, orderKey(link.value.sessionId), (current) => {
    if (!current) return undefined;
    const already = current.refunds.reduce((sum, r) => sum + r.amount, 0);
    if (amountRefunded <= already) return undefined; // nothing new
    current.refunds.push({ stripeRefundId: null, amount: amountRefunded - already, reason: null, createdAt: now.toISOString() });
    current.paymentStatus = amountRefunded >= current.amounts.total ? "refunded" : "partially_refunded";
    if (current.paymentStatus === "refunded" && current.fulfillments.every((f) => !f.shippedAt)) current.status = "canceled";
    current.updatedAt = now.toISOString();
    addHistory(current, { source, type: "charge.refunded", at: now.toISOString() });
    return current;
  });
  return true;
}

export async function getOrderBySession(store: KvStore, sessionId: string): Promise<Order | null> {
  return (await store.get<Order>(orderKey(sessionId)))?.value ?? null;
}

const OPEN_DISPUTE = new Set(["warning_needs_response", "warning_under_review", "needs_response", "under_review"]);
export const isOpenDispute = (status: string) => OPEN_DISPUTE.has(status);

/**
 * Record a card dispute reported by Stripe (charge.dispute.created / updated /
 * closed). Keeps the order and its evidence trail in one place so the owner
 * can answer before Stripe's deadline (usually 7–21 days). Money movements are
 * Stripe's; this never refunds or changes stock.
 */
export async function recordDispute(
  paymentIntentId: string,
  dispute: { id: string; amount: number; reason: string | null; status: string; evidenceDueBy: string | null },
  deps: OrderDeps,
  source: string,
  type: string,
): Promise<boolean> {
  const link = await deps.store.get<{ sessionId: string }>(piKey(paymentIntentId));
  if (!link) return false;
  const now = deps.now().toISOString();
  await updateWithRetry<Order>(deps.store, orderKey(link.value.sessionId), (current) => {
    if (!current) return undefined;
    const disputes = (current.disputes ??= []);
    const existing = disputes.find((d) => d.stripeDisputeId === dispute.id);
    if (existing && existing.status === dispute.status && existing.evidenceDueBy === dispute.evidenceDueBy) return undefined;
    if (existing) Object.assign(existing, { status: dispute.status, evidenceDueBy: dispute.evidenceDueBy, amount: dispute.amount, updatedAt: now });
    else disputes.push({ stripeDisputeId: dispute.id, amount: dispute.amount, reason: dispute.reason, status: dispute.status, evidenceDueBy: dispute.evidenceDueBy, createdAt: now, updatedAt: now });
    const open = disputes.some((d) => isOpenDispute(d.status));
    current.flags = current.flags.filter((f) => f !== "disputed");
    if (open) current.flags.push("disputed");
    current.updatedAt = now;
    addHistory(current, { source, type: `${type}:${dispute.status}`, at: now });
    return current;
  });
  return true;
}
