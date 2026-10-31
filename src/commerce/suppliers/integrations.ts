import type { Supplier } from "./supplier";

/**
 * Supplier integrations — the framework, all switched OFF.
 *
 * Some suppliers offer inventory feeds, CSV order uploads, order APIs or
 * tracking webhooks; many offer none. An adapter describes what ONE approved
 * supplier actually supports. Nothing here runs today: every capability
 * stays disabled until ALL of these are true for that supplier —
 *   1. a signed agreement that covers customer data, ship times and rates;
 *   2. the owner's explicit approval for that capability, recorded as a
 *      per-supplier environment switch (SUPPLIER_<ID>_<CAPABILITY>=on);
 *   3. that supplier's credentials stored as Netlify secrets (never in code);
 *   4. a reviewed PR that adds the adapter's real implementation.
 * Until then the manual workflow (record the order you placed, paste the
 * tracking) and CSV exports are the way to work. No API calls are made, no
 * purchases are placed, and no customer address leaves the site automatically.
 */
export const CAPABILITIES = ["inventory-feed", "csv-order-export", "order-api", "tracking-updates", "availability-updates"] as const;
export type Capability = (typeof CAPABILITIES)[number];

export const CAPABILITY_LABEL: Record<Capability, string> = {
  "inventory-feed": "Read their stock levels",
  "csv-order-export": "Download orders as a CSV for their portal",
  "order-api": "Send orders to them automatically",
  "tracking-updates": "Receive tracking numbers automatically",
  "availability-updates": "Mark items unavailable when they discontinue them",
};

export interface SupplierAdapter {
  /** Matches an implementation reviewed in a PR; none exist yet. */
  id: string;
  supports: Capability[];
  /** Environment variable names the adapter needs (values are secrets set in Netlify, never here). */
  credentials: string[];
}

/** Reviewed adapter implementations. Empty on purpose: no supplier API is connected. */
export const ADAPTERS: SupplierAdapter[] = [];

export type CapabilityState = { capability: Capability; enabled: boolean; blockers: string[] };

const envName = (s: Pick<Supplier, "id">, c: Capability) => `SUPPLIER_${s.id.toUpperCase()}_${c.toUpperCase().replace(/-/g, "_")}`;

/**
 * What each capability needs before it could run for this supplier. CSV
 * export is the manual tool the dashboard has today: it only needs the
 * signed agreement covering customer data (checked again on every download).
 */
export function capabilityStates(s: Supplier, env: Record<string, string | undefined> = process.env): CapabilityState[] {
  const adapter = ADAPTERS.find((a) => a.id === s.id);
  return CAPABILITIES.map((capability) => {
    const blockers: string[] = [];
    const a = s.agreement;
    if (a.status !== "signed") blockers.push("no signed agreement");
    else {
      if (!a.coversCustomerData) blockers.push("agreement doesn't cover customer data");
      if (capability !== "inventory-feed" && capability !== "availability-updates" && !a.coversShipTimes) blockers.push("agreement doesn't cover ship times");
    }
    if (capability === "csv-order-export") return { capability, enabled: blockers.length === 0, blockers };
    if (!adapter) blockers.push("no reviewed integration for this supplier");
    else {
      if (!adapter.supports.includes(capability)) blockers.push("the supplier doesn't offer this");
      for (const c of adapter.credentials) if (!env[c]) blockers.push(`credential ${c} not set`);
    }
    if (env[envName(s, capability)] !== "on") blockers.push(`not approved (${envName(s, capability)})`);
    return { capability, enabled: blockers.length === 0, blockers };
  });
}
