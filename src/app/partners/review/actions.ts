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
