import "server-only";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { MemoryKvStore, createBlobsKvStore, updateWithRetry, type KvStore } from "@/lib/storage/kv";
import { reviewConfig } from "@/lib/partners/config";
import { partnerStores, type PartnerStores } from "@/lib/partners/store";
import { PARTIAL_SESSION_SECONDS, SESSION_COOKIE, SESSION_SECONDS, hmac, issueSession, readSession, type Session } from "@/lib/partners/security";
import { liveCheckoutEnabled } from "@/commerce/checkout/live";
import { decryptSecret, encryptSecret, hashRecoveryCode, newRecoveryCodes, normalizeRecoveryCode, sameHash } from "./mfa-crypto";
import { newTotpSecret, stepAt, verifyTotp } from "./totp";

/**
 * Owner sign-in with a second factor (authenticator app, RFC 6238).
 *
 * Draft-safe by design: until the owner sets up two-step sign-in, the
 * passphrase alone still works exactly as before — UNLESS two-step sign-in is
 * required, which happens automatically when live checkout is switched on
 * (real customer orders), or when OWNER_MFA_REQUIRED=true. Once set up, every
 * owner page and server action needs both steps.
 *
 * State (one record, compare-and-set) lives in a private Netlify Blobs store
 * of its own, separate per deploy context like the partner stores. The
 * authenticator secret is encrypted; recovery codes are stored as keyed hashes.
 */

export type OwnerStatus = "full" | "needs-mfa" | "needs-enrollment";

export interface Enrollment {
  id: string;
  /** AES-256-GCM sealed authenticator secret (mfa-crypto.ts), bound to `id`. */
  secret: string;
  createdAt: string;
  /** Last time step accepted — a code can't be used twice. */
  lastStep: number;
  recovery: { hash: string; usedAt: string | null }[];
  recoveryIssuedAt: string;
}

export interface PendingEnrollment {
  id: string;
  secret: string;
  createdAt: string;
  expiresAt: string;
}

export interface AuthState {
  /** "Sign out everywhere" counter. Bumped on sign-out-everywhere, two-step setup and reset. */
  epoch: number;
  enrollment: Enrollment | null;
  pending: PendingEnrollment | null;
}

const STATE_KEY = "owner/auth-state";
const EMPTY: AuthState = { epoch: 0, enrollment: null, pending: null };
export const ENROLL_MINUTES = 15;

type ReviewCfg = NonNullable<ReturnType<typeof reviewConfig>>;
const memory = globalThis as { __fsOwnerSecurityStore?: MemoryKvStore };

/** Its own store: "owner-security" (+ "-preview" on previews); in memory for local dev and tests. */
export async function ownerSecurityStore(cfg: Pick<ReviewCfg, "storage" | "storeSuffix">): Promise<KvStore> {
  if (cfg.storage === "memory") return (memory.__fsOwnerSecurityStore ??= new MemoryKvStore());
  return createBlobsKvStore(`owner-security${cfg.storeSuffix}`);
}

export async function loadAuthState(store: KvStore): Promise<AuthState> {
  return (await store.get<AuthState>(STATE_KEY))?.value ?? EMPTY;
}

export function updateAuthState(store: KvStore, fn: (s: AuthState) => AuthState | undefined) {
  return updateWithRetry<AuthState>(store, STATE_KEY, (current) => fn(structuredClone(current ?? EMPTY)));
}

/** Break-glass: OWNER_MFA_RESET_ID set to the enrollment id (shown on the Security page) turns that enrollment off. */
export function activeEnrollment(state: AuthState, env: Record<string, string | undefined> = process.env): Enrollment | null {
  const e = state.enrollment;
  if (!e) return null;
  const reset = env.OWNER_MFA_RESET_ID?.trim();
  return reset && reset === e.id ? null : e;
}

/** Two-step sign-in is mandatory once live checkout is on (real orders), or when the owner turns it on explicitly. */
export function mfaRequired(env: Record<string, string | undefined> = process.env, live = liveCheckoutEnabled()): boolean {
  return live || env.OWNER_MFA_REQUIRED === "true";
}

export const mfaVersion = (serverSecret: string, enrollment: Enrollment) => hmac(serverSecret, "mfa-version", enrollment.id).slice(0, 12);

export function statusFor(session: Session, state: AuthState, serverSecret: string, required: boolean, env: Record<string, string | undefined> = process.env): OwnerStatus {
  const e = activeEnrollment(state, env);
  if (e) return session.aal === 2 && session.mfa === mfaVersion(serverSecret, e) ? "full" : "needs-mfa";
  return required ? "needs-enrollment" : "full";
}

export interface OwnerAuth {
  cfg: ReviewCfg;
  stores: PartnerStores;
  security: KvStore;
  state: AuthState;
  session: Session;
  status: OwnerStatus;
  required: boolean;
  enrollment: Enrollment | null;
}

/** The current owner session and what it may do, or null when not signed in (or signed out everywhere). */
export async function ownerAuth(): Promise<OwnerAuth | null> {
  const cfg = reviewConfig();
  if (!cfg) return null;
  const session = readSession(cfg.secret, cfg.passphraseHash, (await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const security = await ownerSecurityStore(cfg);
  const state = await loadAuthState(security);
  if (session.epoch !== state.epoch) return null;
  const required = mfaRequired();
  return {
    cfg,
    stores: await partnerStores(cfg),
    security,
    state,
    session,
    status: statusFor(session, state, cfg.secret, required),
    required,
    enrollment: activeEnrollment(state),
  };
}

/** Write the session cookie (private to /partners/review, HTTP-only, same-site strict). */
export async function setSessionCookie(cfg: ReviewCfg, claims: { aal: 1 | 2; mfa: string; epoch: number }, seconds = SESSION_SECONDS) {
  (await cookies()).set(SESSION_COOKIE, issueSession(cfg.secret, cfg.passphraseHash, Date.now(), claims, seconds), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/partners/review",
    maxAge: seconds,
  });
}

/** After the passphrase: full session if no second step applies; otherwise a 10-minute partial one. */
export async function sessionAfterPassphrase(cfg: ReviewCfg, security: KvStore): Promise<OwnerStatus> {
  const state = await loadAuthState(security);
  const pseudo: Session = { aal: 1, mfa: "0", epoch: state.epoch, exp: 0, nonce: "" };
  const status = statusFor(pseudo, state, cfg.secret, mfaRequired());
  await setSessionCookie(cfg, { aal: 1, mfa: "0", epoch: state.epoch }, status === "full" ? SESSION_SECONDS : status === "needs-mfa" ? PARTIAL_SESSION_SECONDS : 30 * 60);
  return status;
}

/* ------------------------------ verification ------------------------------ */

export type CheckResult = { ok: true; via: "app" | "recovery"; recoveryLeft: number } | { ok: false; reason: "wrong" | "unreadable" | "not-enrolled" };

/**
 * Check a second-factor code (6-digit app code, or a recovery code) and, if
 * it's good, record its use atomically: an app code's time step can't be
 * reused, a recovery code is spent.
 */
export async function checkSecondFactor(security: KvStore, serverSecret: string, code: string, now = new Date()): Promise<CheckResult> {
  const trimmed = code.trim();
  let result: CheckResult = { ok: false, reason: "not-enrolled" };
  await updateAuthState(security, (state) => {
    const e = activeEnrollment(state);
    if (!e) return ((result = { ok: false, reason: "not-enrolled" }), undefined);
    if (/^\d{6}$/.test(trimmed.replace(/\s/g, ""))) {
      const secret = decryptSecret(serverSecret, e.secret, e.id);
      if (!secret) return ((result = { ok: false, reason: "unreadable" }), undefined);
      const step = verifyTotp(secret, trimmed, now.getTime(), e.lastStep);
      if (step === null) return ((result = { ok: false, reason: "wrong" }), undefined);
      state.enrollment!.lastStep = step;
      result = { ok: true, via: "app", recoveryLeft: e.recovery.filter((r) => !r.usedAt).length };
      return state;
    }
    if (normalizeRecoveryCode(trimmed).length !== 10) return ((result = { ok: false, reason: "wrong" }), undefined);
    const hash = hashRecoveryCode(serverSecret, trimmed);
    // Compare against every code (no early exit), then spend the one that matched.
    let hit = -1;
    e.recovery.forEach((r, i) => {
      if (sameHash(r.hash, hash) && !r.usedAt && hit === -1) hit = i;
    });
    if (hit === -1) return ((result = { ok: false, reason: "wrong" }), undefined);
    state.enrollment!.recovery[hit].usedAt = now.toISOString();
    result = { ok: true, via: "recovery", recoveryLeft: state.enrollment!.recovery.filter((r) => !r.usedAt).length };
    return state;
  });
  return result;
}

/* ------------------------------ setup, codes, reset ------------------------------ */

/** Start setup: a new secret, shown once on the Security page; expires in 15 minutes unless confirmed. */
export async function startEnrollment(security: KvStore, serverSecret: string, now = new Date()): Promise<PendingEnrollment> {
  const id = randomBytes(9).toString("base64url");
  const pending: PendingEnrollment = {
    id,
    secret: encryptSecret(serverSecret, newTotpSecret(), id),
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ENROLL_MINUTES * 60_000).toISOString(),
  };
  await updateAuthState(security, (s) => ({ ...s, pending }));
  return pending;
}

export function pendingSecret(state: AuthState, serverSecret: string, now = new Date()): Buffer | null {
  const p = state.pending;
  if (!p || Date.parse(p.expiresAt) <= now.getTime()) return null;
  return decryptSecret(serverSecret, p.secret, p.id);
}

/**
 * Finish setup with the first code from the app (proves the app has the right
 * secret). Creates the enrollment, ten recovery codes (returned ONCE), and
 * signs out every other device.
 */
export async function confirmEnrollment(
  security: KvStore,
  serverSecret: string,
  code: string,
  now = new Date(),
): Promise<{ ok: true; enrollment: Enrollment; codes: string[]; epoch: number } | { ok: false; error: string }> {
  let out: { ok: true; enrollment: Enrollment; codes: string[]; epoch: number } | { ok: false; error: string } = { ok: false, error: "Start the setup again." };
  await updateAuthState(security, (state) => {
    if (activeEnrollment(state)) return ((out = { ok: false, error: "Two-step sign-in is already on." }), undefined);
    const secret = pendingSecret(state, serverSecret, now);
    if (!secret || !state.pending) return ((out = { ok: false, error: "The setup expired. Start again." }), undefined);
    const step = verifyTotp(secret, code, now.getTime(), 0);
    if (step === null) return ((out = { ok: false, error: "That code didn't match. Check the app's time is automatic and try the newest code." }), undefined);
    const codes = newRecoveryCodes();
    const enrollment: Enrollment = {
      id: state.pending.id,
      secret: state.pending.secret,
      createdAt: now.toISOString(),
      lastStep: step,
      recovery: codes.map((c) => ({ hash: hashRecoveryCode(serverSecret, c), usedAt: null })),
      recoveryIssuedAt: now.toISOString(),
    };
    const next: AuthState = { epoch: state.epoch + 1, enrollment, pending: null };
    out = { ok: true, enrollment, codes, epoch: next.epoch };
    return next;
  });
  return out;
}

/** New recovery codes (the old ones stop working). Needs a fresh code from the app. */
export async function regenerateRecoveryCodes(security: KvStore, serverSecret: string, appCode: string, now = new Date()): Promise<{ ok: true; codes: string[] } | { ok: false; error: string }> {
  if (!/^\d{6}$/.test(appCode.replace(/\s/g, ""))) return { ok: false, error: "Enter the 6-digit code from your authenticator app." };
  const check = await checkSecondFactor(security, serverSecret, appCode, now);
  if (!check.ok) return { ok: false, error: "That code didn't work." };
  const codes = newRecoveryCodes();
  await updateAuthState(security, (s) => {
    if (!s.enrollment) return undefined;
    s.enrollment.recovery = codes.map((c) => ({ hash: hashRecoveryCode(serverSecret, c), usedAt: null }));
    s.enrollment.recoveryIssuedAt = now.toISOString();
    return s;
  });
  return { ok: true, codes };
}

/**
 * Turn two-step sign-in off (to set up a new phone). Needs a code from the app
 * or a recovery code, and signs out every device.
 */
export async function disableMfa(security: KvStore, serverSecret: string, code: string, now = new Date()): Promise<{ ok: true } | { ok: false; error: string }> {
  const check = await checkSecondFactor(security, serverSecret, code, now);
  if (!check.ok) return { ok: false, error: "That code didn't work." };
  await updateAuthState(security, (s) => ({ epoch: s.epoch + 1, enrollment: null, pending: null }));
  return { ok: true };
}

/** Sign out every device (including this one). */
export async function signOutEverywhere(security: KvStore): Promise<void> {
  await updateAuthState(security, (s) => ({ ...s, epoch: s.epoch + 1 }));
}

export const currentStep = (now = new Date()) => stepAt(now.getTime());
