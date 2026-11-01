import "server-only";
import { features } from "@/lib/features";
import { deployContext, readStripeLiveConfig, runtimeEnv, type StripeLiveConfig } from "./environment";

/** The code half of the live lock: only a reviewed change to src/lib/features.ts can turn it on. */
export function liveCodeSwitchOn(): boolean {
  return features.commerce && features.checkoutMode === "hosted-checkout";
}

export function stripeLiveConfig(): StripeLiveConfig | null {
  const result = readStripeLiveConfig(runtimeEnv(), liveCodeSwitchOn());
  return result.ok ? result.config : null;
}

export function liveCheckoutEnabled(): boolean {
  return stripeLiveConfig() !== null;
}

/**
 * The live key, for the owner's read-only permission check only — available
 * on the production build before the other live locks are open, so a missing
 * permission can be fixed before launch. Never used to take payments.
 */
export function liveKeyForPermissionCheck(): string | null {
  const env = runtimeEnv();
  if (deployContext(env) !== "production") return null;
  const key = env.STRIPE_LIVE_SECRET_KEY?.trim() ?? "";
  return /^(sk|rk)_live_[A-Za-z0-9]+$/.test(key) ? key : null;
}
