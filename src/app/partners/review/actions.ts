"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { partnerSetup, reviewConfig } from "@/lib/partners/config";
import { requireReviewer } from "@/lib/partners/review-auth";
import { SESSION_COOKIE, SESSION_SECONDS, clientIp, hashIdentifier, issueSession, verifyPassphrase } from "@/lib/partners/security";
import { ID_PATTERN, deleteApplication, getApplication, partnerStores, takeRateLimits, updateApplication, withStatus } from "@/lib/partners/store";
import { notifyOwner } from "@/lib/partners/notify";
import { siteOrigin } from "@/lib/partners/submit";
import { isStage } from "@/lib/partners/schema";
import { recordRun, runRetention, summarize } from "@/lib/partners/cleanup";
import { completeDeletionRequest, createDeletionRequest, recordDeletionException, reopenDeletionRequest } from "@/lib/partners/deletion-requests";
import { DELETION_ID } from "@/lib/partners/deletion";

/*
 * Public endpoints (like every server action). Each one re-checks the
 * session before touching data; none of them takes config from the caller.
 */

export type LoginState = { error: string | null };

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const cfg = reviewConfig();
  if (!cfg) return { error: "Review isn't available." };
  const stores = await partnerStores(cfg);
  const ipHash = hashIdentifier(cfg.secret, "ip", clientIp(await headers()));
  const allowed = await takeRateLimits(stores.limits, [
    { key: `login-ip/${ipHash}`, max: 5, windowSeconds: 15 * 60 },
    { key: "login-global", max: 30, windowSeconds: 60 * 60 },
  ]);
  if (!allowed) return { error: "Too many attempts. Please wait 15 minutes and try again." };

  const passphrase = String(formData.get("passphrase") ?? "");
  if (!(await verifyPassphrase(passphrase, cfg.passphraseHash))) {
    console.warn("[partners] review sign-in failed");
    return { error: "That passphrase didn't match." };
  }
  (await cookies()).set(SESSION_COOKIE, issueSession(cfg.secret, cfg.passphraseHash), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/partners/review",
    maxAge: SESSION_SECONDS,
  });
  console.info("[partners] review sign-in");
  redirect("/partners/review");
}

export async function logoutAction() {
  (await cookies()).delete({ name: SESSION_COOKIE, path: "/partners/review" });
  redirect("/partners/review");
}

function idFrom(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  return ID_PATTERN.test(id) ? id : null;
}

export async function updateStatusAction(formData: FormData) {
  const ctx = await requireReviewer();
  const id = idFrom(formData);
  if (!ctx || !id) redirect("/partners/review");
  const status = formData.get("status");
  const note = String(formData.get("note") ?? "");
  await updateApplication(ctx.stores.apps, id, (app) => withStatus(app, isStage(status) ? status : app.status, note));
  redirect(`/partners/review/${id}?saved=1`);
}

export async function resendNotificationAction(formData: FormData) {
  const ctx = await requireReviewer();
  const id = idFrom(formData);
  if (!ctx || !id) redirect("/partners/review");
  const { config } = partnerSetup();
  const app = await getApplication(ctx.stores.apps, id);
  if (config && app) {
    const r = await notifyOwner(config, app, siteOrigin());
    await updateApplication(ctx.stores.apps, id, (a) => ({
      ...a,
      notification: r.status === "sent" ? { status: "sent", at: new Date().toISOString() } : { status: "failed", at: new Date().toISOString(), code: r.code },
    }));
  }
  redirect(`/partners/review/${id}?saved=1`);
}

export async function deleteApplicationAction(formData: FormData) {
  const ctx = await requireReviewer();
  const id = idFrom(formData);
  if (!ctx || !id) redirect("/partners/review");
  if (formData.get("confirm") !== id) redirect(`/partners/review/${id}?delete=confirm`);
  await deleteApplication(ctx.stores.apps, id);
  console.info(`[partners] deleted ${id}`);
  redirect("/partners/review?deleted=1");
}

/* ------------------------------ retention ------------------------------ */

/** Runs the retention cleanup on this site's stores now (the live site also runs it daily on a schedule). */
export async function runCleanupAction(formData: FormData) {
  const ctx = await requireReviewer();
  if (!ctx) redirect("/partners/review");
  const dryRun = formData.get("dryRun") === "true";
  const report = await runRetention(ctx.stores, { dryRun, trigger: "owner" });
  await recordRun(ctx.stores.ops, report);
  console.info(summarize(report));
  redirect(`/partners/review?cleanup=${dryRun ? "dry-run" : report.status}`);
}

/** A documented legal reason to keep an application past its retention date. Doesn't restart the retention clock. */
export async function legalHoldAction(formData: FormData) {
  const ctx = await requireReviewer();
  const id = idFrom(formData);
  if (!ctx || !id) redirect("/partners/review");
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 300);
  if (!reason) redirect(`/partners/review/${id}?hold=reason`);
  const at = new Date().toISOString();
  await updateApplication(ctx.stores.apps, id, (app) => ({ ...app, legalHold: { reason, at } }));
  console.info(`[partners] legal hold set on ${id}`);
  redirect(`/partners/review/${id}?saved=1`);
}

export async function releaseHoldAction(formData: FormData) {
  const ctx = await requireReviewer();
  const id = idFrom(formData);
  if (!ctx || !id) redirect("/partners/review");
  await updateApplication(ctx.stores.apps, id, (app) => {
    if (!app.legalHold) return undefined;
    const next = { ...app };
    delete next.legalHold;
    return next;
  });
  console.info(`[partners] legal hold released on ${id}`);
  redirect(`/partners/review/${id}?saved=1`);
}

/** For approved partners only: the relationship is still active, so restart the yearly review. */
export async function confirmActiveAction(formData: FormData) {
  const ctx = await requireReviewer();
  const id = idFrom(formData);
  if (!ctx || !id) redirect("/partners/review");
  const at = new Date().toISOString();
  await updateApplication(ctx.stores.apps, id, (app) => (app.status === "approved" ? { ...app, relationshipConfirmedAt: at } : undefined));
  redirect(`/partners/review/${id}?saved=1`);
}

/* ------------------------------ deletion requests ------------------------------ */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function requestIdFrom(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  return DELETION_ID.test(id) ? id : null;
}

export async function createDeletionRequestAction(formData: FormData) {
  const ctx = await requireReviewer();
  if (!ctx) redirect("/partners/review");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const received = new Date(`${String(formData.get("receivedOn") ?? "")}T12:00:00Z`);
  const now = Date.now();
  if (!EMAIL.test(email) || email.length > 254) redirect("/partners/review/requests?error=email");
  if (!Number.isFinite(received.getTime()) || received.getTime() > now + 86_400_000 || received.getTime() < now - 365 * 86_400_000) redirect("/partners/review/requests?error=date");
  const req = await createDeletionRequest(ctx.stores, ctx.cfg.secret, email, received);
  console.info(`[partners] deletion request ${req.id} recorded matches=${req.matchedIds.length}`);
  redirect(`/partners/review/requests?saved=${req.id}`);
}

export async function completeDeletionRequestAction(formData: FormData) {
  const ctx = await requireReviewer();
  const id = requestIdFrom(formData);
  if (!ctx || !id) redirect("/partners/review/requests");
  if (formData.get("confirm") !== id) redirect(`/partners/review/requests?error=confirm`);
  const done = await completeDeletionRequest(ctx.stores, ctx.cfg.secret, id);
  if (done.status === "held") {
    console.info(`[partners] deletion request ${id} not completed: ${done.heldIds.length} on legal hold`);
    redirect(`/partners/review/requests?error=held`);
  }
  console.info(`[partners] deletion request ${id} ${done.status === "completed" ? `completed: ${done.request.matchedIds.length} deleted` : "not open"}`);
  redirect(`/partners/review/requests?saved=${id}`);
}

export async function deletionExceptionAction(formData: FormData) {
  const ctx = await requireReviewer();
  const id = requestIdFrom(formData);
  if (!ctx || !id) redirect("/partners/review/requests");
  const ok = await recordDeletionException(ctx.stores.ops, id, String(formData.get("reason") ?? ""));
  redirect(ok ? `/partners/review/requests?saved=${id}` : "/partners/review/requests?error=reason");
}

export async function reopenDeletionRequestAction(formData: FormData) {
  const ctx = await requireReviewer();
  const id = requestIdFrom(formData);
  if (!ctx || !id) redirect("/partners/review/requests");
  await reopenDeletionRequest(ctx.stores.ops, id);
  redirect(`/partners/review/requests?saved=${id}`);
}
