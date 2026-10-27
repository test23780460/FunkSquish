"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  checkSecondFactor,
  confirmEnrollment,
  disableMfa,
  mfaVersion,
  ownerAuth,
  regenerateRecoveryCodes,
  setSessionCookie,
  signOutEverywhere,
  startEnrollment,
} from "@/lib/owner/auth";
import { SESSION_COOKIE, clientIp, hashIdentifier } from "@/lib/partners/security";
import { takeRateLimits } from "@/lib/partners/store";

/*
 * Two-step sign-in actions. Public endpoints like every server action, so each
 * checks the session state it needs. Codes and secrets are never logged; logs
 * say only what happened ("mfa failed", "mfa ok via app").
 */

export type CodeState = { error: string | null };
export type CodesState = { error: string | null; codes: string[] | null };

const LOGIN = "/partners/review";
const HOME = "/partners/review/today";
const SECURITY = "/partners/review/security";

async function ipHashFor(secret: string) {
  return hashIdentifier(secret, "ip", clientIp(await headers()));
}

/**
 * Tell the owner (at most once an hour) that someone got past the passphrase
 * but not the second step — a strong sign the passphrase has leaked.
 */
async function alertOwner(limits: Parameters<typeof takeRateLimits>[0]) {
  if (!(await takeRateLimits(limits, [{ key: "mfa-alert", max: 1, windowSeconds: 3600 }]))) return;
  const to = process.env.PARTNER_NOTIFY_EMAIL;
  const from = process.env.PARTNER_NOTIFY_FROM;
  const key = process.env.BREVO_API_KEY;
  if (!to || !from || !key) return;
  try {
    await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": key, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        sender: { name: "FunkSquish website", email: from },
        to: [{ email: to }],
        subject: "Security: wrong two-step code after a correct passphrase",
        htmlContent:
          '<!doctype html><html><body style="font-family:Arial,sans-serif;color:#0e2a5c"><h2>Owner sign-in alert</h2><p>Someone entered the correct owner passphrase but then a wrong two-step code. If this wasn\'t you, change the passphrase now (docs/OWNER-SECURITY.md, "Change the passphrase").</p></body></html>',
        tags: ["owner-security"],
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    /* the log line below is the fallback */
  }
}

/** Second step of sign-in: a 6-digit app code or a recovery code. */
export async function verifyMfaAction(_prev: CodeState, fd: FormData): Promise<CodeState> {
  const auth = await ownerAuth();
  if (!auth) redirect(LOGIN);
  if (auth.status === "full") redirect(HOME);
  if (auth.status === "needs-enrollment") redirect(SECURITY);
  const ipHash = await ipHashFor(auth.cfg.secret);
  const sessionKey = hashIdentifier(auth.cfg.secret, "ip", `session:${auth.session.nonce}`);
  const code = String(fd.get("code") ?? "").slice(0, 40);
  const recovery = !/^\s*\d[\d\s]{5,8}$/.test(code);
  const allowed = await takeRateLimits(auth.stores.limits, [
    { key: `mfa-ip/${ipHash}`, max: 5, windowSeconds: 15 * 60 },
    { key: `mfa-session/${sessionKey}`, max: 5, windowSeconds: 15 * 60 },
    recovery ? { key: "mfa-recovery-global", max: 10, windowSeconds: 24 * 3600 } : { key: "mfa-global", max: 20, windowSeconds: 24 * 3600 },
  ]);
  if (!allowed) {
    (await cookies()).delete({ name: SESSION_COOKIE, path: "/partners/review" });
    console.warn("[owner-auth] mfa rate limited");
    return { error: "Too many tries. Wait 15 minutes, then sign in again." };
  }
  const r = await checkSecondFactor(auth.security, auth.cfg.secret, code);
  if (!r.ok) {
    console.warn(`[owner-auth] mfa failed (${r.reason})`);
    if (r.reason === "wrong") await alertOwner(auth.stores.limits);
    return {
      error:
        r.reason === "unreadable"
          ? "Two-step sign-in data can't be read (the site secret may have changed). Use the reset steps in docs/OWNER-SECURITY.md."
          : "That code didn't work. Use the newest code from your app, or a recovery code.",
    };
  }
  await setSessionCookie(auth.cfg, { aal: 2, mfa: mfaVersion(auth.cfg.secret, auth.enrollment!), epoch: auth.state.epoch });
  console.info(`[owner-auth] mfa ok via ${r.via}`);
  redirect(r.via === "recovery" ? `${SECURITY}?recovery=${r.recoveryLeft}` : HOME);
}

/** Begin setting up two-step sign-in (needs a full session, or one that's required to set it up). */
export async function startEnrollmentAction() {
  const auth = await ownerAuth();
  if (!auth || auth.status === "needs-mfa") redirect(LOGIN);
  if (auth.enrollment) redirect(SECURITY);
  await startEnrollment(auth.security, auth.cfg.secret);
  console.info("[owner-auth] mfa setup started");
  redirect(`${SECURITY}?step=scan`);
}

/** Finish setup with the first code from the app. Returns the recovery codes ONCE. */
export async function confirmEnrollmentAction(_prev: CodesState, fd: FormData): Promise<CodesState> {
  const auth = await ownerAuth();
  if (!auth || auth.status === "needs-mfa") redirect(LOGIN);
  const ipHash = await ipHashFor(auth.cfg.secret);
  if (!(await takeRateLimits(auth.stores.limits, [{ key: `mfa-enroll/${ipHash}`, max: 10, windowSeconds: 15 * 60 }])))
    return { error: "Too many tries. Wait 15 minutes and start again.", codes: null };
  const r = await confirmEnrollment(auth.security, auth.cfg.secret, String(fd.get("code") ?? "").slice(0, 12));
  if (!r.ok) return { error: r.error, codes: null };
  // Every other device is signed out; this one continues with both steps done.
  await setSessionCookie(auth.cfg, { aal: 2, mfa: mfaVersion(auth.cfg.secret, r.enrollment), epoch: r.epoch });
  console.info("[owner-auth] mfa enrolled");
  return { error: null, codes: r.codes };
}

export async function regenerateCodesAction(_prev: CodesState, fd: FormData): Promise<CodesState> {
  const auth = await ownerAuth();
  if (!auth || auth.status !== "full" || !auth.enrollment) redirect(LOGIN);
  const ipHash = await ipHashFor(auth.cfg.secret);
  if (!(await takeRateLimits(auth.stores.limits, [{ key: `mfa-ip/${ipHash}`, max: 5, windowSeconds: 15 * 60 }])))
    return { error: "Too many tries. Wait 15 minutes.", codes: null };
  const r = await regenerateRecoveryCodes(auth.security, auth.cfg.secret, String(fd.get("code") ?? "").slice(0, 12));
  if (!r.ok) return { error: r.error, codes: null };
  console.info("[owner-auth] recovery codes replaced");
  return { error: null, codes: r.codes };
}

/** Turn two-step sign-in off (e.g. to move to a new phone). Signs out every device. */
export async function disableMfaAction(_prev: CodeState, fd: FormData): Promise<CodeState> {
  const auth = await ownerAuth();
  if (!auth || auth.status !== "full" || !auth.enrollment) redirect(LOGIN);
  const ipHash = await ipHashFor(auth.cfg.secret);
  if (!(await takeRateLimits(auth.stores.limits, [{ key: `mfa-ip/${ipHash}`, max: 5, windowSeconds: 15 * 60 }])))
    return { error: "Too many tries. Wait 15 minutes." };
  if (fd.get("confirm") !== "TURN OFF") return { error: 'Type TURN OFF to confirm.' };
  const r = await disableMfa(auth.security, auth.cfg.secret, String(fd.get("code") ?? "").slice(0, 40));
  if (!r.ok) return { error: r.error };
  (await cookies()).delete({ name: SESSION_COOKIE, path: "/partners/review" });
  console.info("[owner-auth] mfa turned off");
  redirect(`${LOGIN}?signedout=mfa-off`);
}

export async function signOutEverywhereAction() {
  const auth = await ownerAuth();
  if (!auth || auth.status !== "full") redirect(LOGIN);
  await signOutEverywhere(auth.security);
  (await cookies()).delete({ name: SESSION_COOKIE, path: "/partners/review" });
  console.info("[owner-auth] signed out everywhere");
  redirect(`${LOGIN}?signedout=everywhere`);
}
