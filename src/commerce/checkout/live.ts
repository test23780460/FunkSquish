import "server-only";
import { features } from "@/lib/features";
import { readStripeLiveConfig, runtimeEnv, type StripeLiveConfig } from "./environment";

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
