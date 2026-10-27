/**
 * Stripe TEST-MODE environment guard (B4: preparation only, no live sales).
 *
 * Every Stripe code path asks this module first. It only ever returns a
 * config when ALL of these hold:
 *  - the build is a Netlify Deploy Preview or local development
 *    (never Netlify production, never a branch deploy);
 *  - the test switch STRIPE_TEST_CHECKOUT_ENABLED=true is set for that context;
 *  - the secret key is a Stripe TEST key (sk_test_ / rk_test_). Live keys are
 *    rejected outright, even if someone pastes one by mistake.
 *
 * Pure functions take an `env` object so they can be unit-tested.
 */

export type Env = Record<string, string | undefined>;

export interface StripeTestConfig {
  secretKey: string;
  shippingRateIds: string[];
  webhookSecret: string | null;
  returnOrigin: string;
  automaticTax: boolean;
}

export type ConfigProblem =
  | "environment-not-allowed"
  | "switch-off"
  | "missing-secret-key"
  | "live-key-rejected"
  | "invalid-secret-key"
  | "missing-shipping-rate"
  | "invalid-return-origin";

const PRODUCTION_HOSTS = new Set(["funksquish.com", "www.funksquish.com"]);

/** Netlify CONTEXT frozen at build (see next.config.ts), with a runtime fallback. */
export function deployContext(env: Env): string {
  return env.BUILD_CONTEXT || env.CONTEXT || "";
}

/** Only Deploy Previews and local development may ever talk to Stripe. */
export function stripeTestEnvironmentAllowed(env: Env): boolean {
  const context = deployContext(env);
  if (context === "production" || context === "branch-deploy") return false;
  return context === "deploy-preview" || (context === "" && env.NODE_ENV === "development") || (context === "dev" && env.NODE_ENV === "development");
}

export function isLiveKey(key: string): boolean {
  return /^(sk|rk|pk)_live_/.test(key);
}

export function returnOriginFrom(env: Env): string | null {
  const supplied =
    env.STRIPE_TEST_RETURN_ORIGIN ||
    env.BUILD_DEPLOY_URL ||
    env.DEPLOY_PRIME_URL ||
    (env.NODE_ENV === "development" ? "http://localhost:3000" : "");
  if (!supplied) return null;
  try {
    const url = new URL(supplied);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (url.protocol !== "https:" && !(local && url.protocol === "http:")) return null;
    if (url.username || url.password) return null;
    if (PRODUCTION_HOSTS.has(url.hostname)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

/** Returns the validated test config, or the first reason it can't be used. */
export function readStripeTestConfig(env: Env): { ok: true; config: StripeTestConfig } | { ok: false; problem: ConfigProblem } {
  if (!stripeTestEnvironmentAllowed(env)) return { ok: false, problem: "environment-not-allowed" };
  if (env.STRIPE_TEST_CHECKOUT_ENABLED !== "true") return { ok: false, problem: "switch-off" };

  const secretKey = env.STRIPE_TEST_SECRET_KEY?.trim() ?? "";
  if (!secretKey) return { ok: false, problem: "missing-secret-key" };
  if (isLiveKey(secretKey)) return { ok: false, problem: "live-key-rejected" };
  if (!/^(sk|rk)_test_[A-Za-z0-9]+$/.test(secretKey)) return { ok: false, problem: "invalid-secret-key" };

  const shippingRateIds = (env.STRIPE_TEST_SHIPPING_RATE_IDS || env.STRIPE_TEST_SHIPPING_RATE_ID || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (shippingRateIds.length === 0 || shippingRateIds.length > 5 || !shippingRateIds.every((id) => /^shr_[A-Za-z0-9]+$/.test(id))) {
    return { ok: false, problem: "missing-shipping-rate" };
  }

  const returnOrigin = returnOriginFrom(env);
  if (!returnOrigin) return { ok: false, problem: "invalid-return-origin" };

  const webhookSecret = env.STRIPE_TEST_WEBHOOK_SECRET?.trim();
  return {
    ok: true,
    config: {
      secretKey,
      shippingRateIds,
      webhookSecret: webhookSecret && /^whsec_[A-Za-z0-9]+$/.test(webhookSecret) ? webhookSecret : null,
      returnOrigin,
      automaticTax: env.STRIPE_TEST_AUTOMATIC_TAX === "true",
    },
  };
}

/**
 * process.env plus the build-time deploy context. Next.js only inlines
 * BUILD_CONTEXT where the code literally says `process.env.BUILD_CONTEXT`
 * (see next.config.ts); passing `process.env` as an object would lose it at
 * runtime on Netlify, so it's copied in explicitly here.
 */
export function runtimeEnv(): Env {
  return { ...process.env, BUILD_CONTEXT: process.env.BUILD_CONTEXT, BUILD_DEPLOY_URL: process.env.BUILD_DEPLOY_URL };
}

/** Convenience wrappers for app code (reads process.env). */
export function stripeTestConfig(): StripeTestConfig | null {
  const result = readStripeTestConfig(runtimeEnv());
  return result.ok ? result.config : null;
}

export function testCheckoutEnabled(): boolean {
  return stripeTestConfig() !== null;
}

/* ------------------------------------------------------------------ */
/* LIVE (production) configuration — built, but locked.                */
/* ------------------------------------------------------------------ */

/**
 * Real payments need ALL of these, so no single mistake can switch them on:
 *  1. a reviewed CODE change: features.commerce = true and
 *     features.checkoutMode = "hosted-checkout" (src/lib/features.ts);
 *  2. the Netlify PRODUCTION build (never previews, branches or local dev);
 *  3. STRIPE_LIVE_CHECKOUT_ENABLED=true for Production;
 *  4. a LIVE secret key (sk_live_ / rk_live_ — test keys are rejected here,
 *     just as live keys are rejected by the test config);
 *  5. a live webhook signing secret (orders are only created from verified webhooks
 *     or a server-side re-fetch of the session);
 *  6. at least one live shipping rate.
 * Live variables have their own names (STRIPE_LIVE_*), so test and live can
 * never share a key, webhook secret, shipping rate or order store.
 */
export interface StripeLiveConfig {
  secretKey: string;
  shippingRateIds: string[];
  webhookSecret: string;
  returnOrigin: string;
  automaticTax: boolean;
}

export type LiveConfigProblem =
  | "code-switch-off"
  | "environment-not-allowed"
  | "switch-off"
  | "missing-secret-key"
  | "test-key-rejected"
  | "invalid-secret-key"
  | "missing-webhook-secret"
  | "missing-shipping-rate";

export const LIVE_RETURN_ORIGIN = "https://funksquish.com";

export function readStripeLiveConfig(
  env: Env,
  codeSwitchOn: boolean,
): { ok: true; config: StripeLiveConfig } | { ok: false; problem: LiveConfigProblem } {
  if (!codeSwitchOn) return { ok: false, problem: "code-switch-off" };
  if (deployContext(env) !== "production") return { ok: false, problem: "environment-not-allowed" };
  if (env.STRIPE_LIVE_CHECKOUT_ENABLED !== "true") return { ok: false, problem: "switch-off" };

  const secretKey = env.STRIPE_LIVE_SECRET_KEY?.trim() ?? "";
  if (!secretKey) return { ok: false, problem: "missing-secret-key" };
  if (/^(sk|rk|pk)_test_/.test(secretKey)) return { ok: false, problem: "test-key-rejected" };
  if (!/^(sk|rk)_live_[A-Za-z0-9]+$/.test(secretKey)) return { ok: false, problem: "invalid-secret-key" };

  const webhookSecret = env.STRIPE_LIVE_WEBHOOK_SECRET?.trim() ?? "";
  if (!/^whsec_[A-Za-z0-9]+$/.test(webhookSecret)) return { ok: false, problem: "missing-webhook-secret" };

  const shippingRateIds = (env.STRIPE_LIVE_SHIPPING_RATE_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (shippingRateIds.length === 0 || shippingRateIds.length > 5 || !shippingRateIds.every((id) => /^shr_[A-Za-z0-9]+$/.test(id))) {
    return { ok: false, problem: "missing-shipping-rate" };
  }

  return {
    ok: true,
    config: { secretKey, shippingRateIds, webhookSecret, returnOrigin: LIVE_RETURN_ORIGIN, automaticTax: env.STRIPE_LIVE_AUTOMATIC_TAX === "true" },
  };
}
