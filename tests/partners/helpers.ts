import type { PartnerConfig } from "@/lib/partners/config";

export const SECRET = "test-secret-0123456789-abcdefghijklmnop";

export const config: PartnerConfig = {
  secret: SECRET,
  passphraseHash: "scrypt:16384:8:1:AAAAAAAAAAAAAAAAAAAAAA:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  notifyTo: "owner@example.com",
  notifyFrom: "website@example.com",
  brevoKey: "fake-brevo-key",
  storage: "memory",
  storeSuffix: "-dev",
};

export function resetMemoryStores() {
  delete (globalThis as { __fsPartnerStores?: unknown }).__fsPartnerStores;
}

/** A complete, valid manufacturer application. */
export function goodForm(overrides: Record<string, string | string[]> = {}) {
  const base: Record<string, string | string[]> = {
    type: "manufacturer",
    name: "Pat Example",
    email: "pat@squishfactory.example.com",
    business: "Squish Factory Co.",
    website: "https://squishfactory.co/catalog",
    country: "Vietnam",
    categories: ["Jelly / TPR squishies", "Crunchy squishies"],
    examples: "SKU JB-01, JB-02 — https://squishfactory.co/jelly",
    moq: "MOQ 300 per design",
    samples: "Samples available",
    safetyDocs: "Available (e.g. CPC, test reports)",
    message: "Hello!\nWe make jelly squishies.",
    consent: "yes",
    ...overrides,
  };
  const f = new FormData();
  for (const [k, v] of Object.entries(base)) for (const x of Array.isArray(v) ? v : [v]) f.append(k, x);
  return f;
}
