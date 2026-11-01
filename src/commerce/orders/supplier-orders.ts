import { randomBytes } from "node:crypto";
import { updateWithRetry, type KvStore } from "./store";
import { orderKey } from "./fulfill";
import { isValidDay } from "./ship-by";
import type { FulfillmentGroup, Order, SupplierExceptionKind, SupplierOrderStatus } from "./types";

/**
 * The manual supplier workflow for supplier-shipped packages. Nothing here
 * talks to a supplier: the owner places the order on the supplier's site or
 * by email, then records it here. The guards:
 *
 *  - only paid, not canceled/refunded orders, and only supplier packages that
 *    haven't been placed yet (no duplicate supplier orders for one package);
 *  - a supplier order reference can only belong to ONE package (claimed with
 *    create-only, so two tabs can't record the same reference twice);
 *  - a tracking number can only belong to ONE package (so a supplier's
 *    shipment can't be recorded on the wrong order);
 *  - every step is written to the order's history.
 */
export const EXCEPTION_KINDS: Record<SupplierExceptionKind, string> = {
  delay: "Running late",
  "out-of-stock": "Out of stock",
  "wrong-item": "Sent the wrong item",
  damaged: "Damaged",
  address: "Address problem",
  "no-tracking": "No tracking received",
  other: "Other",
};
export const SUPPLIER_UPDATE_STATUSES: SupplierOrderStatus[] = ["confirmed", "processing", "problem"];

export type SupplierResult = { ok: true; order: Order } | { ok: false; error: string };

const REF = /^[A-Za-z0-9#._\-/ ]{3,60}$/;
const norm = (s: string) => s.trim().toUpperCase().replace(/\s+/g, "");
const refKey = (supplierId: string, ref: string) => `supplier-ref/${supplierId}/${encodeURIComponent(norm(ref))}`;
export const trackingKey = (trackingNumber: string) => `tracking/${encodeURIComponent(norm(trackingNumber))}`;

const placeable = (o: Order) => o.status !== "canceled" && (o.paymentStatus === "paid" || o.paymentStatus === "partially_refunded");

function packageOf(o: Order, groupId: string): FulfillmentGroup | null {
  return o.fulfillments.find((g) => g.id === groupId) ?? null;
}

/** Record that the owner placed this package with the supplier. */
export async function placeWithSupplier(
  store: KvStore,
  sessionId: string,
  groupId: string,
  input: { supplierId: string; reference: string; expectedShipBy: string | null },
  now = new Date(),
): Promise<SupplierResult> {
  const reference = input.reference.trim();
  if (!REF.test(reference)) return { ok: false, error: "Enter the supplier's order number (3–60 letters, numbers, # . _ - /)." };
  if (input.expectedShipBy && !isValidDay(input.expectedShipBy)) return { ok: false, error: "The supplier's ship date must be a real date." };

  // Claim the reference first: if it's already on another package, stop.
  const key = refKey(input.supplierId, reference);
  const claimed = await store.create(key, { sessionId, groupId, at: now.toISOString() });
  if (!claimed) {
    const owner = (await store.get<{ sessionId: string; groupId: string }>(key))?.value;
    if (!owner || owner.sessionId !== sessionId || owner.groupId !== groupId) return { ok: false, error: `Supplier order ${reference} is already recorded on another package — this looks like a duplicate supplier order. Check before ordering again.` };
  }

  let error: string | null = null;
  let repeat = false;
  const { value } = await updateWithRetry<Order>(store, orderKey(sessionId), (o) => {
    if (!o) return ((error = "Order not found."), undefined);
    if (!placeable(o)) return ((error = o.status === "canceled" ? "This order was canceled — don't place it with the supplier." : "This order isn't paid (or was fully refunded) — don't place it."), undefined);
    const g = packageOf(o, groupId);
    if (!g) return ((error = "Package not found."), undefined);
    if (g.source !== "supplier") return ((error = "This package ships from your own stock, not a supplier."), undefined);
    if (g.supplierOrder && g.supplierOrder.status !== "canceled") {
      if (g.supplierOrder.reference === reference) return ((repeat = true), undefined); // same form sent twice: nothing to do
      return ((error = `This package was already placed with the supplier (order ${g.supplierOrder.reference}).`), undefined);
    }
    if (!["awaiting_supplier", "unfulfilled"].includes(g.status)) return ((error = `This package is ${g.status.replaceAll("_", " ")}; it can't be placed now.`), undefined);
    const at = now.toISOString();
    g.supplierOrder = { supplierId: input.supplierId, reference, placedAt: at, status: "placed", expectedShipBy: input.expectedShipBy, exceptions: [], updates: [{ at, status: "placed", note: null }] };
    g.supplierRef = reference;
    g.status = "sent_to_supplier";
    o.updatedAt = at;
    o.history.push({ source: "owner", type: `supplier-placed:${groupId}`, at });
    return o;
  });
  if (repeat) return { ok: true, order: value! };
  if (error) {
    if (claimed) await store.delete(key); // give the reference back
    return { ok: false, error };
  }
  return { ok: true, order: value! };
}

async function change(store: KvStore, sessionId: string, groupId: string, now: Date, type: string, fn: (g: FulfillmentGroup, o: Order) => string | null): Promise<SupplierResult> {
  let error: string | null = null;
  const { value } = await updateWithRetry<Order>(store, orderKey(sessionId), (o) => {
    if (!o) return ((error = "Order not found."), undefined);
    const g = packageOf(o, groupId);
    if (!g?.supplierOrder) return ((error = "Record the supplier order first."), undefined);
    const e = fn(g, o);
    if (e) return ((error = e), undefined);
    o.updatedAt = now.toISOString();
    o.history.push({ source: "owner", type: `${type}:${groupId}`, at: now.toISOString() });
    return o;
  });
  return error ? { ok: false, error } : { ok: true, order: value! };
}

export function supplierUpdate(store: KvStore, sessionId: string, groupId: string, status: SupplierOrderStatus, note: string | null, expectedShipBy: string | null, now = new Date()): Promise<SupplierResult> {
  if (!SUPPLIER_UPDATE_STATUSES.includes(status)) return Promise.resolve({ ok: false, error: "Pick confirmed, processing or problem." });
  if (expectedShipBy && !isValidDay(expectedShipBy)) return Promise.resolve({ ok: false, error: "Enter a real date." });
  return change(store, sessionId, groupId, now, "supplier-update", (g) => {
    const so = g.supplierOrder!;
    if (so.status === "shipped" || so.status === "canceled") return `The supplier order is already ${so.status}.`;
    so.status = status;
    if (expectedShipBy) so.expectedShipBy = expectedShipBy;
    so.updates.push({ at: now.toISOString(), status, note: note?.slice(0, 300) ?? null });
    return null;
  });
}

export function addSupplierException(store: KvStore, sessionId: string, groupId: string, kind: SupplierExceptionKind, note: string, now = new Date()): Promise<SupplierResult> {
  if (!(kind in EXCEPTION_KINDS)) return Promise.resolve({ ok: false, error: "Pick what went wrong." });
  if (!note.trim()) return Promise.resolve({ ok: false, error: "Describe the problem (no customer details needed)." });
  return change(store, sessionId, groupId, now, "supplier-exception", (g) => {
    const so = g.supplierOrder!;
    if (so.exceptions.filter((x) => !x.resolvedAt).length >= 10) return "Resolve some open problems first.";
    so.exceptions.push({ id: randomBytes(5).toString("hex"), at: now.toISOString(), kind, note: note.trim().slice(0, 300), resolvedAt: null });
    if (so.status !== "shipped") so.status = "problem";
    return null;
  });
}

export function resolveSupplierException(store: KvStore, sessionId: string, groupId: string, exceptionId: string, now = new Date()): Promise<SupplierResult> {
  return change(store, sessionId, groupId, now, "supplier-exception-resolved", (g) => {
    const x = g.supplierOrder!.exceptions.find((e) => e.id === exceptionId);
    if (!x) return "That problem isn't on this package.";
    if (x.resolvedAt) return "Already resolved.";
    x.resolvedAt = now.toISOString();
    return null;
  });
}

/** The supplier canceled (or you canceled with them): the package goes back to "place with supplier", and its reference is freed. */
export async function supplierCanceled(store: KvStore, sessionId: string, groupId: string, now = new Date()): Promise<SupplierResult> {
  let ref: { supplierId: string; reference: string } | null = null;
  const r = await change(store, sessionId, groupId, now, "supplier-canceled", (g) => {
    const so = g.supplierOrder!;
    if (so.status === "shipped") return "It already shipped — record a return or loss instead.";
    if (so.status === "canceled") return "Already canceled.";
    so.status = "canceled";
    so.updates.push({ at: now.toISOString(), status: "canceled", note: null });
    if (g.status === "sent_to_supplier") g.status = "awaiting_supplier";
    g.supplierRef = null;
    ref = { supplierId: so.supplierId, reference: so.reference };
    return null;
  });
  if (r.ok && ref) await store.delete(refKey((ref as { supplierId: string }).supplierId, (ref as { reference: string }).reference));
  return r;
}

/**
 * Claim a tracking number for one package before it's recorded as shipped.
 * The same number on a different package is refused (a supplier's update for
 * another order, or a typo). Repeating it on the same package is fine.
 */
export async function claimTracking(store: KvStore, trackingNumber: string, sessionId: string, groupId: string, orderId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const key = trackingKey(trackingNumber);
  if (await store.create(key, { sessionId, groupId, orderId })) return { ok: true };
  const owner = (await store.get<{ sessionId: string; groupId: string; orderId: string }>(key))?.value;
  if (owner && owner.sessionId === sessionId && owner.groupId === groupId) return { ok: true };
  return { ok: false, error: `Tracking number ${trackingNumber} is already recorded on ${owner?.orderId ?? "another package"}. Check you're on the right order.` };
}

/** Packages that need the owner on the supplier side, for the Overview and Fulfillment pages. */
export function supplierAttention(orders: Order[], now = new Date()): { order: Order; group: FulfillmentGroup; why: string }[] {
  const today = now.toISOString().slice(0, 10);
  const out: { order: Order; group: FulfillmentGroup; why: string }[] = [];
  for (const o of orders) {
    if (!placeable(o)) continue;
    for (const g of o.fulfillments) {
      if (g.source !== "supplier") continue;
      const so = g.supplierOrder;
      if (g.status === "awaiting_supplier" || (g.status === "unfulfilled" && !so)) out.push({ order: o, group: g, why: "Place this with the supplier" });
      else if (so && so.status !== "shipped" && so.status !== "canceled") {
        const open = so.exceptions.filter((x) => !x.resolvedAt);
        if (open.length) out.push({ order: o, group: g, why: `Supplier problem: ${open.map((x) => EXCEPTION_KINDS[x.kind].toLowerCase()).join(", ")}` });
        else if (so.expectedShipBy && so.expectedShipBy < today) out.push({ order: o, group: g, why: `Supplier said it would ship by ${so.expectedShipBy} — no tracking yet` });
      }
    }
  }
  return out;
}
