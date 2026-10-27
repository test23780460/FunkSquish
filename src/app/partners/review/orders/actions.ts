"use server";

import { redirect } from "next/navigation";
import { requireReviewer } from "@/lib/partners/review-auth";
import { siteOrigin } from "@/lib/partners/submit";
import { activeMode, notifyConfigFor, orderDeps } from "@/commerce/checkout/service";
import { cancelOrder, getOrder, markShipped, reconcileRecentSessions, refundOrder } from "@/commerce/orders/admin";
import { notifyPaidOrder, notifyShipped } from "@/commerce/orders/notify";

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
  return { mode, deps, notify: notifyConfigFor(mode, siteOrigin()) };
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
  const r = await markShipped(deps.store, sessionId, groupId, {
    carrier: String(fd.get("carrier") ?? ""),
    trackingNumber: String(fd.get("tracking") ?? ""),
    trackingUrl: String(fd.get("trackingUrl") ?? ""),
  });
  if (!r.ok) redirect(detail(sessionId, `error=${msg(r.error)}`));
  await notifyShipped(deps.store, r.order, groupId, notify);
  console.info(`[orders] ${r.order.id} package ${groupId} marked shipped`);
  redirect(detail(sessionId, "saved=shipped"));
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
