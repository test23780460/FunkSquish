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

/** Convenience wrappers for app code (reads process.env). */
export function stripeTestConfig(): StripeTestConfig | null {
  const result = readStripeTestConfig(process.env);
  return result.ok ? result.config : null;
}

export function testCheckoutEnabled(): boolean {
  return stripeTestConfig() !== null;
}
