import { createHash } from "node:crypto";
import { commitStock, getReservation, releaseStock, unsellStock } from "./inventory";
import { ConflictError, updateWithRetry, type KvStore } from "./store";
import { disputeNeedsOwner, resolveDispute, sameDisputeFacts, type DisputeFacts } from "./dispute-status";
import type { SessionSnapshot } from "./session-snapshot";
import { isAllowedDestination, isMilitaryAddress } from "./shipping-restrictions";
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
  /**
   * Reads a dispute's current state from Stripe (same mode only). Used only when an event
   * disagrees with what's stored. Optional: without it (or if it fails) the event is used.
   */
  retrieveDispute?(disputeId: string): Promise<DisputeFacts>;
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

const emptyGroup = (id: string, source: FulfillmentGroup["source"], variantIds: string[]): FulfillmentGroup => ({
  id,
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
  shipBy: null,
  delayNotices: [],
});

/**
 * One package per origin, exactly as priced at checkout (session metadata
 * "shipping_plan"): its own shipping charge and its own ship-by date
 * (business days after payment, as promised). If the plan is missing or
 * doesn't match the items, fall back to one package per source and flag the
 * order so the owner checks it — never guess a package's charge.
 */
export function fulfillmentGroups(snapshot: SessionSnapshot, paidAt: Date | null): { groups: FulfillmentGroup[]; flags: string[] } {
  const plan = snapshot.shippingPlan ?? null;
  const flags: string[] = [];
  if (plan && plan.length) {
    const groups = plan.map((p) => ({
      ...emptyGroup(
        p.groupId,
        p.source,
        snapshot.lineItems.filter((l) => l.fulfillmentOrigin === p.groupId).map((l) => l.variantId),
      ),
      origin: p.groupId,
      shippingAmount: p.cents,
      processingBusinessDays: p.processingBusinessDays,
      militaryAddresses: p.militaryAddresses,
      shipBy: paidAt ? shipByFor(paidAt, p.processingBusinessDays) : null,
    }));
    const assigned = new Set(groups.flatMap((g) => g.variantIds));
    const complete = snapshot.lineItems.every((l) => assigned.has(l.variantId)) && groups.every((g) => g.variantIds.length > 0);
    if (complete) {
      if (plan.reduce((sum, p) => sum + p.cents, 0) !== snapshot.amounts.shipping) flags.push("shipping_mismatch");
      return { groups, flags };
    }
    flags.push("shipping_mismatch");
  } else if (snapshot.lineItems.some((l) => l.fulfillmentOrigin)) {
    flags.push("shipping_mismatch"); // priced per package at checkout, but the plan didn't come back
  }

  // Orders from before per-package pricing (or a broken plan): one package per source, as before.
  const groups: FulfillmentGroup[] = [];
  for (const source of ["in_house", "supplier"] as const) {
    const variantIds = snapshot.lineItems.filter((l) => l.fulfillmentSource === source).map((l) => l.variantId);
    if (variantIds.length === 0) continue;
    groups.push({ ...emptyGroup(`${source}-1`, source, variantIds), shipBy: source === "in_house" && paidAt ? shipByFor(paidAt) : null });
  }
  return { groups, flags };
}

function newOrder(snapshot: SessionSnapshot, paid: boolean, at: Date, trigger: OrderEventRecord, mode: "test" | "live"): Order {
  const iso = at.toISOString();
  const { groups, flags } = fulfillmentGroups(snapshot, paid ? at : null);
  // Territory / non-US address slipped through Stripe's form → refund, don't ship.
  if (!isAllowedDestination(snapshot.shippingAddress)) flags.push("restricted_destination");
  // Military address, but a package's origin can't ship there (disclosed on Stripe's page) → refund that package.
  if (isMilitaryAddress(snapshot.shippingAddress) && groups.some((g) => g.militaryAddresses === false)) flags.push("military_unsupported");
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
    fulfillments: groups,
    customer: snapshot.customer,
    shippingAddress: snapshot.shippingAddress,
    shippingRateId: snapshot.shippingRateId,
    refunds: [],
    inventoryCommitted: false,
    flags,
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
      for (const g of current.fulfillments)
        if (!g.shipBy && (g.processingBusinessDays || g.source === "in_house")) g.shipBy = shipByFor(now, g.processingBusinessDays);
      current.amounts = { currency: "usd", ...snapshot.amounts };
      current.updatedAt = now.toISOString();
      addHistory(current, trigger);
      return current;
    }
    return undefined; // already recorded
  });
  let order = value!;

  if (order.stripePaymentIntentId) {
    await deps.store.create(piKey(order.stripePaymentIntentId), { sessionId });
    // A dispute Stripe reported before this order existed is recorded now.
    if (await applyParkedDisputes(order.stripePaymentIntentId, deps)) order = (await getOrderBySession(deps.store, sessionId)) ?? order;
  }

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
  // Refunded in full before anything shipped (e.g. from the Stripe Dashboard): the units never left
  // the shelf, so they're free again. Refunds after shipping never change stock — a returned item is
  // put back by hand once it's inspected.
  const order = await getOrderBySession(deps.store, link.value.sessionId);
  if (order?.status === "canceled" && order.inventoryCommitted && order.fulfillments.every((f) => !f.shippedAt))
    await unsellStock(deps.store, order.checkoutId, order.lineItems.map((l) => l.variantId));
  return true;
}

export async function getOrderBySession(store: KvStore, sessionId: string): Promise<Order | null> {
  return (await store.get<Order>(orderKey(sessionId)))?.value ?? null;
}

export { isOpenDispute } from "./dispute-status";

type DisputeInput = DisputeFacts & {
  id: string;
  reason: string | null;
  /** When Stripe created the event (ISO, whole seconds), if known. */
  eventAt?: string | null;
};
/** Parked events, one entry per Stripe event (keyed `<dispute id>:<event id>`), so none is lost or merged. */
type ParkedDisputes = Record<string, { dispute: DisputeInput; source: string; type: string }>;
const parkedDisputeKey = (paymentIntentId: string) => `dispute/parked/${paymentIntentId}`;

/**
 * Record a card dispute reported by Stripe (charge.dispute.created / updated /
 * closed). Keeps the order and its evidence trail in one place so the owner
 * can answer before Stripe's deadline (usually 7–21 days). Money movements are
 * Stripe's; this never refunds or changes stock.
 */
export async function recordDispute(
  paymentIntentId: string,
  dispute: DisputeInput,
  deps: OrderDeps,
  source: string,
  type: string,
): Promise<boolean> {
  const link = await deps.store.get<{ sessionId: string }>(piKey(paymentIntentId));
  if (link) return applyDispute(link.value.sessionId, dispute, deps, source, type);
  // Stripe can send charge.dispute.* before checkout.session.completed (seen in the sandbox:
  // the dispute arrived a second before the order existed). Park it so it isn't lost; the order
  // picks it up when it's created. Re-check afterwards in case the order appeared meanwhile.
  await updateWithRetry<ParkedDisputes>(deps.store, parkedDisputeKey(paymentIntentId), (current) => {
    const key = `${dispute.id}:${source}`;
    if (current?.[key]) return undefined; // the same event again
    return { ...(current ?? {}), [key]: { dispute, source, type } };
  });
  return applyParkedDisputes(paymentIntentId, deps);
}

/** Record disputes parked for a payment whose order now exists. Safe to repeat. */
async function applyParkedDisputes(paymentIntentId: string, deps: OrderDeps): Promise<boolean> {
  const link = await deps.store.get<{ sessionId: string }>(piKey(paymentIntentId));
  if (!link) return false;
  let applied = false;
  for (let attempt = 0; attempt < 5; attempt++) {
    const parked = await deps.store.get<ParkedDisputes>(parkedDisputeKey(paymentIntentId));
    const entries = parked ? Object.values(parked.value) : [];
    if (!parked || entries.length === 0) return applied;
    // Oldest Stripe event first; applying is order-independent anyway (see ./dispute-status).
    entries.sort((a, b) => (a.dispute.eventAt ?? "").localeCompare(b.dispute.eventAt ?? "") || a.source.localeCompare(b.source));
    for (const { dispute, source, type } of entries) await applyDispute(link.value.sessionId, dispute, deps, source, type);
    applied = true;
    // Clear only what was applied: if another event was parked meanwhile, go round again.
    if (await deps.store.replace<ParkedDisputes>(parkedDisputeKey(paymentIntentId), {}, parked.etag)) return true;
  }
  return applied;
}

/** The dispute as Stripe has it now, or null if there's no reader or Stripe failed (never throws). */
async function readDisputeFromStripe(disputeId: string, deps: OrderDeps): Promise<{ facts: DisputeFacts; at: string } | null> {
  if (!deps.retrieveDispute) return null;
  const at = deps.now().toISOString(); // when the read started: a later read can't be overwritten by this one
  try {
    return { facts: await deps.retrieveDispute(disputeId), at };
  } catch (err) {
    // Fall back to the event (nothing actionable is hidden; conflicts are marked for the owner).
    const code = (err as { code?: string; type?: string })?.code ?? (err as { type?: string })?.type ?? "unknown";
    console.error("[orders] couldn't read dispute from Stripe:", code);
    return null;
  }
}

async function applyDispute(sessionId: string, dispute: DisputeInput, deps: OrderDeps, source: string, type: string): Promise<boolean> {
  const key = orderKey(sessionId);
  // undefined = not asked yet. Stripe is asked only when this event disagrees with what's stored.
  let stripe: { facts: DisputeFacts; at: string } | null | undefined;
  for (let attempt = 0; attempt < 8; attempt++) {
    const current = await deps.store.get<Order>(key);
    if (!current) return false;
    const order = structuredClone(current.value);
    const disputes = (order.disputes ??= []);
    const existing = disputes.find((d) => d.stripeDisputeId === dispute.id);
    if (existing && stripe === undefined && !sameDisputeFacts(existing, dispute)) {
      stripe = await readDisputeFromStripe(dispute.id, deps);
      continue; // re-read the order: it may have changed while Stripe answered
    }
    const next = resolveDispute(existing, dispute, stripe ?? null);
    if (!next) return true; // nothing new (duplicate, or older than what's stored)
    const now = deps.now().toISOString();
    if (existing) Object.assign(existing, next, { updatedAt: now });
    else disputes.push({ stripeDisputeId: dispute.id, reason: dispute.reason, ...next, createdAt: now, updatedAt: now });
    order.flags = order.flags.filter((f) => f !== "disputed");
    if (disputes.some(disputeNeedsOwner)) order.flags.push("disputed");
    order.updatedAt = now;
    addHistory(order, { source, type: `${type}:${next.status}${next.needsCheck ? ":unconfirmed" : ""}`, at: now });
    if (await deps.store.replace(key, order, current.etag)) return true;
  }
  throw new ConflictError(key);
}
