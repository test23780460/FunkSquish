"use server";

import { redirect } from "next/navigation";
import { requireReviewer } from "@/lib/partners/review-auth";
import { siteOrigin } from "@/lib/partners/submit";
import { activeMode, notifyConfigFor, orderDeps } from "@/commerce/checkout/service";
import {
  RETURN_CAUSES,
  cancelOrder,
  cancelPackage,
  getOrder,
  markLost,
  markReturned,
  markShipped,
  reconcileRecentSessions,
  refundOrder,
  refundPackage,
  reshipPackage,
  sendDelayNotice,
  setShipBy,
} from "@/commerce/orders/admin";
import type { ReturnCause } from "@/commerce/orders/types";
import { notifyPaidOrder, notifyShipped } from "@/commerce/orders/notify";
import { addSupplierException, claimTracking, EXCEPTION_KINDS, placeWithSupplier, resolveSupplierException, supplierCanceled, supplierUpdate } from "@/commerce/orders/supplier-orders";
import type { SupplierExceptionKind, SupplierOrderStatus } from "@/commerce/orders/types";
import { ownerTools } from "@/lib/owner/data";
import { getSupplier } from "@/commerce/suppliers/supplier";

/*
 * Owner-only order actions. Like every server action these are public
 * endpoints, so each one re-checks the signed-in owner session first, and
 * works only on the store of the mode that's open here (test on previews /
 * local dev, live on production once live checkout is approved).
 */

const BASE = "/partners/review/orders";

async function context() {
  const ctx = await requireReviewer();
  if (!ctx) redirect("/partners/review");
  const mode = activeMode();
  if (!mode) redirect(`${BASE}?error=closed`);
  const deps = await orderDeps(mode);
  if (!deps) redirect(`${BASE}?error=closed`);
  return { mode, deps, notify: notifyConfigFor(mode, siteOrigin()), tools: await ownerTools(ctx) };
}

const sessionFrom = (fd: FormData) => {
  const id = String(fd.get("session") ?? "");
  return /^cs_(test|live)_[A-Za-z0-9]{10,200}$/.test(id) ? id : null;
};
const detail = (sessionId: string, q: string) => `${BASE}/${sessionId}?${q}`;
const msg = (s: string) => encodeURIComponent(s.slice(0, 120));

export async function markShippedAction(fd: FormData) {
  const { deps, notify } = await context();
  const sessionId = sessionFrom(fd);
  if (!sessionId) redirect(BASE);
  const groupId = String(fd.get("group") ?? "");
  // One tracking number belongs to one package: refuse a number already recorded on another order.
  const tracking = String(fd.get("tracking") ?? "").trim().replace(/s+/g, "");
  const existing = await getOrder(deps.store, sessionId);
  if (existing && /^[A-Za-z0-9-]{6,60}$/.test(tracking)) {
    const claim = await claimTracking(deps.store, tracking, sessionId, groupId, existing.id);
    if (!claim.ok) redirect(detail(sessionId, `error=${msg(claim.error)}`));
  }
  const r = await markShipped(
    deps.store,
    sessionId,
    groupId,
    {
      carrier: String(fd.get("carrier") ?? ""),
      trackingNumber: String(fd.get("tracking") ?? ""),
      trackingUrl: String(fd.get("trackingUrl") ?? ""),
    },
    new Date(),
    deps.onHand, // the package's units come off the stock count (once)
  );
  if (!r.ok) redirect(detail(sessionId, `error=${msg(r.error)}`));
  await notifyShipped(deps.store, r.order, groupId, notify);
  console.info(`[orders] ${r.order.id} package ${groupId} marked shipped`);
  redirect(detail(sessionId, r.warning ? `saved=shipped&error=${msg(r.warning)}` : "saved=shipped"));
}

export async function refundAction(fd: FormData) {
  const { deps } = await context();
  const sessionId = sessionFrom(fd);
  if (!sessionId) redirect(BASE);
  const order = await getOrder(deps.store, sessionId);
  if (!order) redirect(BASE);
  if (fd.get("confirm") !== order.id) redirect(detail(sessionId, `error=${msg("Type the order number to confirm the refund.")}`));
  const amount = Math.round(Number(String(fd.get("amount") ?? "").replace(/[$,\s]/g, "")) * 100);
  let r;
  try {
    r = await refundOrder(deps.stripe, deps.store, sessionId, amount);
  } catch (err) {
    console.error(`[orders] refund failed for ${order.id}:`, (err as { code?: string })?.code ?? "error");
    r = { ok: false as const, error: "Stripe didn't accept the refund. Check the Stripe Dashboard." };
  }
  if (!r.ok) redirect(detail(sessionId, `error=${msg(r.error)}`));
  console.info(`[orders] ${order.id} refunded ${amount} cents`);
  redirect(detail(sessionId, "saved=refund"));
}

export async function cancelAction(fd: FormData) {
  const { deps } = await context();
  const sessionId = sessionFrom(fd);
  if (!sessionId) redirect(BASE);
  const order = await getOrder(deps.store, sessionId);
  if (!order) redirect(BASE);
  if (fd.get("confirm") !== order.id) redirect(detail(sessionId, `error=${msg("Type the order number to confirm canceling.")}`));
  let r;
  try {
    r = await cancelOrder(deps.stripe, deps.store, sessionId);
  } catch (err) {
    console.error(`[orders] cancel failed for ${order.id}:`, (err as { code?: string })?.code ?? "error");
    r = { ok: false as const, error: "Stripe didn't accept the refund. Nothing was canceled." };
  }
  if (!r.ok) redirect(detail(sessionId, `error=${msg(r.error)}`));
  console.info(`[orders] ${order.id} canceled`);
  redirect(detail(sessionId, "saved=canceled"));
}

export async function resendEmailsAction(fd: FormData) {
  const { deps, notify } = await context();
  const sessionId = sessionFrom(fd);
  if (!sessionId) redirect(BASE);
  const order = await getOrder(deps.store, sessionId);
  if (!order) redirect(BASE);
  // Only emails that failed are retried; sent or skipped ones are left alone.
  await notifyPaidOrder(deps.store, order, notify);
  for (const f of order.fulfillments) if (f.shippedAt) await notifyShipped(deps.store, order, f.id, notify);
  redirect(detail(sessionId, "saved=emails"));
}

export async function reconcileAction() {
  const { deps } = await context();
  let q: string;
  try {
    const r = await reconcileRecentSessions(deps.stripe, deps);
    q = `reconciled=${r.checked}-${r.recorded}`;
  } catch (err) {
    console.error("[orders] reconcile failed:", (err as { code?: string })?.code ?? "error");
    q = `error=${msg("Couldn't reach Stripe. Try again in a minute.")}`;
  }
  redirect(`${BASE}?${q}`);
}

/** Supplier packages: record the ship-by date from the product's stated processing time. */
export async function setShipByAction(fd: FormData) {
  const { deps } = await context();
  const sessionId = sessionFrom(fd);
  if (!sessionId) redirect(BASE);
  const r = await setShipBy(deps.store, sessionId, String(fd.get("group") ?? ""), String(fd.get("shipBy") ?? ""));
  redirect(detail(sessionId, r.ok ? "saved=ship-by" : `error=${msg(r.error)}`));
}

/** FTC Mail Order Rule delay notice for one package (new date, or none if unknown). */
export async function delayNoticeAction(fd: FormData) {
  const { deps, notify } = await context();
  const sessionId = sessionFrom(fd);
  if (!sessionId) redirect(BASE);
  const unknown = fd.get("unknown") === "yes";
  const newShipBy = unknown ? null : String(fd.get("newShipBy") ?? "");
  const r = await sendDelayNotice(deps.store, sessionId, String(fd.get("group") ?? ""), newShipBy, notify);
  if (r.ok) console.info(`[orders] ${r.order.id} delay notice recorded`);
  redirect(detail(sessionId, r.ok ? "saved=delay" : `error=${msg(r.error)}`));
}

/* ------------------------------ one package ------------------------------ */

const groupFrom = (fd: FormData) => String(fd.get("group") ?? "").slice(0, 40);

/** Money moves: the owner types the order number, like the whole-order refund. */
async function confirmedOrder(fd: FormData, deps: Awaited<ReturnType<typeof context>>["deps"], sessionId: string, what: string) {
  const order = await getOrder(deps.store, sessionId);
  if (!order) redirect(BASE);
  if (fd.get("confirm") !== order.id) redirect(detail(sessionId, `error=${msg(`Type the order number to confirm ${what}.`)}`));
  return order;
}

/** Cancel one unshipped package (e.g. the customer declined a delay): refund it in full and return its stock. */
export async function cancelPackageAction(fd: FormData) {
  const { deps } = await context();
  const sessionId = sessionFrom(fd);
  if (!sessionId) redirect(BASE);
  const order = await confirmedOrder(fd, deps, sessionId, "canceling this package");
  let r;
  try {
    r = await cancelPackage(deps.stripe, deps.store, sessionId, groupFrom(fd), { supplierCanceled: fd.get("supplierCanceled") === "yes" });
  } catch (err) {
    console.error(`[orders] package cancel failed for ${order.id}:`, (err as { code?: string })?.code ?? "error");
    r = { ok: false as const, error: "Stripe didn't accept the refund. Nothing was canceled." };
  }
  if (!r.ok) redirect(detail(sessionId, `error=${msg(r.error)}`));
  console.info(`[orders] ${order.id} package canceled`);
  redirect(detail(sessionId, "saved=package-canceled"));
}

/** Refund one package in full (items + its shipping + tax): lost, came back, or customer canceled after a delay. */
export async function refundPackageAction(fd: FormData) {
  const { deps } = await context();
  const sessionId = sessionFrom(fd);
  if (!sessionId) redirect(BASE);
  const order = await confirmedOrder(fd, deps, sessionId, "this package refund");
  let r;
  try {
    r = await refundPackage(deps.stripe, deps.store, sessionId, groupFrom(fd));
  } catch (err) {
    console.error(`[orders] package refund failed for ${order.id}:`, (err as { code?: string })?.code ?? "error");
    r = { ok: false as const, error: "Stripe didn't accept the refund. Check the Stripe Dashboard." };
  }
  if (!r.ok) redirect(detail(sessionId, `error=${msg(r.error)}`));
  console.info(`[orders] ${order.id} package refunded`);
  redirect(detail(sessionId, "saved=package-refund"));
}

export async function markLostAction(fd: FormData) {
  const { deps } = await context();
  const sessionId = sessionFrom(fd);
  if (!sessionId) redirect(BASE);
  const r = await markLost(deps.store, sessionId, groupFrom(fd));
  redirect(detail(sessionId, r.ok ? "saved=lost" : `error=${msg(r.error)}`));
}

export async function markReturnedAction(fd: FormData) {
  const { deps } = await context();
  const sessionId = sessionFrom(fd);
  if (!sessionId) redirect(BASE);
  const cause = String(fd.get("cause") ?? "");
  const r = cause in RETURN_CAUSES ? await markReturned(deps.store, sessionId, groupFrom(fd), cause as ReturnCause) : { ok: false as const, error: "Choose why it came back." };
  redirect(detail(sessionId, r.ok ? "saved=returned" : `error=${msg(r.error)}`));
}

/** Free replacement for a lost or returned package (no charge to the customer). */
export async function reshipAction(fd: FormData) {
  const { deps } = await context();
  const sessionId = sessionFrom(fd);
  if (!sessionId) redirect(BASE);
  const r = await reshipPackage(deps.store, sessionId, groupFrom(fd));
  if (r.ok) console.info(`[orders] ${r.order.id} replacement started`);
  redirect(detail(sessionId, r.ok ? "saved=reship" : `error=${msg(r.error)}`));
}

/* ------------------------------ supplier packages (manual workflow) ------------------------------ */

const supplierGroupFrom = (fd: FormData) => {
  const g = groupFrom(fd);
  return /^[w~:-]{1,40}$/.test(g) ? g : null;
};

export async function placeWithSupplierAction(fd: FormData) {
  const { deps, tools } = await context();
  const sessionId = sessionFrom(fd);
  const groupId = supplierGroupFrom(fd);
  if (!sessionId || !groupId) redirect(BASE);
  if (!(await tools.allow("supplier-orders", 200, 60 * 60))) redirect(detail(sessionId, `error=${msg("Too many changes in an hour.")}`));
  if (fd.get("placed") !== "on") redirect(detail(sessionId, `error=${msg("Tick the box to confirm you placed the order with the supplier yourself.")}`));
  const supplier = await getSupplier(tools.data, String(fd.get("supplierId") ?? ""));
  if (!supplier) redirect(detail(sessionId, `error=${msg("Pick the supplier you ordered from.")}`));
  const r = await placeWithSupplier(deps.store, sessionId, groupId, { supplierId: supplier.id, reference: String(fd.get("reference") ?? ""), expectedShipBy: String(fd.get("expectedShipBy") ?? "") || null });
  if (!r.ok) redirect(detail(sessionId, `error=${msg(r.error)}`));
  await tools.audit("fulfillment", "supplier-placed", r.order.id, `Package ${groupId} placed with ${supplier.name}`);
  redirect(detail(sessionId, "saved=supplier"));
}

export async function supplierUpdateAction(fd: FormData) {
  const { deps, tools } = await context();
  const sessionId = sessionFrom(fd);
  const groupId = supplierGroupFrom(fd);
  if (!sessionId || !groupId) redirect(BASE);
  const r = await supplierUpdate(deps.store, sessionId, groupId, String(fd.get("status") ?? "") as SupplierOrderStatus, String(fd.get("note") ?? "").trim() || null, String(fd.get("expectedShipBy") ?? "") || null);
  if (!r.ok) redirect(detail(sessionId, `error=${msg(r.error)}`));
  await tools.audit("fulfillment", "supplier-update", r.order.id, `Package ${groupId}: supplier status ${String(fd.get("status"))}`);
  redirect(detail(sessionId, "saved=supplier"));
}

export async function supplierExceptionAction(fd: FormData) {
  const { deps, tools } = await context();
  const sessionId = sessionFrom(fd);
  const groupId = supplierGroupFrom(fd);
  if (!sessionId || !groupId) redirect(BASE);
  const exceptionId = String(fd.get("exception") ?? "");
  const r = exceptionId
    ? await resolveSupplierException(deps.store, sessionId, groupId, exceptionId)
    : await addSupplierException(deps.store, sessionId, groupId, String(fd.get("kind") ?? "") as SupplierExceptionKind, String(fd.get("note") ?? ""));
  if (!r.ok) redirect(detail(sessionId, `error=${msg(r.error)}`));
  await tools.audit("fulfillment", exceptionId ? "supplier-problem-resolved" : "supplier-problem", r.order.id, `Package ${groupId}: ${exceptionId ? "problem resolved" : EXCEPTION_KINDS[String(fd.get("kind")) as SupplierExceptionKind] ?? "problem"}`);
  redirect(detail(sessionId, "saved=supplier"));
}

export async function supplierCanceledAction(fd: FormData) {
  const { deps, tools } = await context();
  const sessionId = sessionFrom(fd);
  const groupId = supplierGroupFrom(fd);
  if (!sessionId || !groupId) redirect(BASE);
  if (fd.get("confirm") !== "on") redirect(detail(sessionId, `error=${msg("Tick the box to confirm the supplier order was canceled.")}`));
  const r = await supplierCanceled(deps.store, sessionId, groupId);
  if (!r.ok) redirect(detail(sessionId, `error=${msg(r.error)}`));
  await tools.audit("fulfillment", "supplier-canceled", r.order.id, `Package ${groupId}: supplier order canceled; back to "place with supplier"`);
  redirect(detail(sessionId, "saved=supplier"));
}
