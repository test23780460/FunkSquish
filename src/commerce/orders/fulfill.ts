import { createHash } from "node:crypto";
import { commitStock, getReservation, releaseStock } from "./inventory";
import { updateWithRetry, type KvStore } from "./store";
import type { SessionSnapshot } from "./session-snapshot";
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
}

export const orderKey = (sessionId: string) => `order/session/${sessionId}`;
const piKey = (paymentIntentId: string) => `order/pi/${paymentIntentId}`;

export const TEST_SESSION_ID = /^cs_test_[A-Za-z0-9]{10,200}$/;

/** Deterministic order number so retries can never create two orders. */
export function orderNumberFor(sessionId: string, at: Date, mode: "test" | "live" = "test"): string {
  const code = createHash("sha256").update(sessionId).digest("hex").slice(0, 8).toUpperCase();
  const day = at.toISOString().slice(0, 10).replaceAll("-", "");
  return `FS-${mode === "test" ? "T-" : ""}${day}-${code}`;
}

function fulfillmentGroups(snapshot: SessionSnapshot): FulfillmentGroup[] {
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
    });
  }
  return groups;
}

function newOrder(snapshot: SessionSnapshot, paid: boolean, at: Date, trigger: OrderEventRecord): Order {
  const iso = at.toISOString();
  return {
    id: orderNumberFor(snapshot.id, at),
    mode: "test",
    checkoutId: snapshot.checkoutId ?? "",
    stripeCheckoutSessionId: snapshot.id,
    stripePaymentIntentId: snapshot.paymentIntentId,
    status: paid ? "open" : "awaiting_payment",
    paymentStatus: paid ? "paid" : "processing",
    amounts: { currency: "usd", ...snapshot.amounts },
    lineItems: snapshot.lineItems.map((l) => ({ ...l })),
    fulfillments: fulfillmentGroups(snapshot),
    customer: snapshot.customer,
    shippingAddress: snapshot.shippingAddress,
    shippingRateId: snapshot.shippingRateId,
    refunds: [],
    inventoryCommitted: false,
    flags: [],
    createdAt: iso,
    updatedAt: iso,
    history: [trigger],
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
  if (!TEST_SESSION_ID.test(sessionId)) return { state: "invalid" };
  const snapshot = await deps.retrieveSession(sessionId);
  if (snapshot.livemode !== false || snapshot.id !== sessionId || !snapshot.checkoutId) return { state: "invalid" };

  const now = deps.now();
  const trigger: OrderEventRecord = { source, type, at: now.toISOString() };
  const paid = snapshot.paymentStatus === "paid" || snapshot.paymentStatus === "no_payment_required";

  // Checkout not finished (open / expired) → nothing to record.
  if (!paid && snapshot.status !== "complete") return { state: "not_paid", sessionStatus: snapshot.status };

  // Create or advance the single order for this session (compare-and-set).
  const { value } = await updateWithRetry<Order>(deps.store, orderKey(sessionId), (current) => {
    if (!current) return newOrder(snapshot, paid, now, trigger);
    if (paid && current.paymentStatus === "processing") {
      current.paymentStatus = "paid";
      current.status = "open";
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

  return order.paymentStatus === "paid" ? { state: "paid", order } : { state: "processing", order };
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
