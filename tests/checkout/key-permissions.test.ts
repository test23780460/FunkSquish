import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import Stripe from "stripe";
import type { KeyPermissions } from "@/commerce/checkout/key-permissions";

/**
 * Live checkout requires Stripe to confirm the live key has Disputes: Read.
 * Errors below are the SDK's own classes with the shapes Stripe returned on
 * 2026-10-31: the sandbox key without the permission got StripePermissionError
 * / more_permissions_required / 403, and an unknown key got
 * StripeAuthenticationError / 401.
 */
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
  headers: async () => new Headers({ "x-nf-client-connection-ip": "198.51.100.31" }),
}));
// Every other live lock is pretended open (fake values), so only the key check decides.
const liveOpen = { on: false };
vi.mock("@/commerce/checkout/live", async (orig) => ({
  ...(await orig<object>()),
  liveCodeSwitchOn: () => liveOpen.on,
  liveCheckoutEnabled: () => liveOpen.on,
  stripeLiveConfig: () => (liveOpen.on ? { secretKey: "rk_live_FAKEKEYPERMS", webhookSecret: "whsec_FAKE", returnOrigin: "https://funksquish.com", automaticTax: false } : null),
}));
vi.mock("@/lib/owner/mfa-gate", () => ({ ownerMfaReady: async () => ({ ready: true }), MFA_GATE_TEXT: {} }));
const stripe = { create: vi.fn(), list: vi.fn() };
vi.mock("@/commerce/checkout/stripe", async (orig) => ({
  ...(await orig<object>()),
  createStripeLiveClient: () => ({ checkout: { sessions: { create: stripe.create, expire: vi.fn(), retrieve: vi.fn() } }, disputes: { list: stripe.list } }),
}));
const { MemoryKvStore } = await import("@/lib/storage/kv-core");
const liveOrders = new MemoryKvStore();
vi.mock("@/commerce/orders/store", async (orig) => ({ ...(await orig<object>()), getLiveOrderStore: async () => liveOrders }));

const { REQUIRED_KEY_PERMISSIONS, checkKeyPermissions, forgetKeyPermissions, keyPermissionsReady, keyPermissionsText } = await import("@/commerce/checkout/key-permissions");
const { startCheckout, quoteCheckout } = await import("@/app/actions/checkout");
const { checkStripeKeyPermissions } = await import("@/commerce/checkout/service");
const { liveKeyForPermissionCheck } = await import("@/commerce/checkout/live");

const permissionError = () => new Stripe.errors.StripePermissionError({ message: "The provided key does not have the required permissions", code: "more_permissions_required", statusCode: 403 });
const authError = () => new Stripe.errors.StripeAuthenticationError({ message: "Invalid API Key provided", statusCode: 401 });
const connectionError = () => new Stripe.errors.StripeConnectionError({ message: "An error occurred with our connection to Stripe" });
const client = (list: () => Promise<unknown>) => ({ disputes: { list } }) as unknown as Pick<Stripe, "disputes">;

const logs: string[] = [];
beforeEach(() => {
  forgetKeyPermissions();
  liveOpen.on = false;
  stripe.create.mockReset();
  stripe.list.mockReset();
  logs.length = 0;
  for (const level of ["info", "warn", "error", "log"] as const) vi.spyOn(console, level).mockImplementation((...a: unknown[]) => void logs.push(a.map(String).join(" ")));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("which permissions are required", () => {
  it("Disputes: Read, checked with a one-item read-only list", async () => {
    expect(REQUIRED_KEY_PERMISSIONS.map((p) => p.label)).toEqual(["Disputes: Read"]);
    const list = vi.fn(async () => ({ data: [] }));
    expect(await checkKeyPermissions(client(list))).toEqual({ ready: true });
    expect(list).toHaveBeenCalledWith({ limit: 1 });
  });
});

describe("reading Stripe's answer", () => {
  it("missing permission (403 more_permissions_required) → names the permission", async () => {
    const r = await checkKeyPermissions(client(async () => Promise.reject(permissionError())));
    expect(r).toEqual({ ready: false, reason: "missing-permission", missing: ["Disputes: Read"] });
    expect(keyPermissionsText(r)).toContain("missing Disputes: Read");
  });

  it("rejected key (401) is reported as such, not as a missing permission", async () => {
    expect(await checkKeyPermissions(client(async () => Promise.reject(authError())))).toEqual({ ready: false, reason: "key-rejected" });
  });

  it("network trouble or anything unexpected fails closed as 'unreachable'", async () => {
    expect(await checkKeyPermissions(client(async () => Promise.reject(connectionError())))).toEqual({ ready: false, reason: "stripe-unreachable" });
    expect(await checkKeyPermissions(client(async () => Promise.reject(new TypeError("boom"))))).toEqual({ ready: false, reason: "stripe-unreachable" });
  });

  it("explanations never contain key material", () => {
    const all: KeyPermissions[] = [{ ready: true }, { ready: false, reason: "missing-permission", missing: ["Disputes: Read"] }, { ready: false, reason: "key-rejected" }, { ready: false, reason: "stripe-unreachable" }];
    for (const r of all) expect(keyPermissionsText(r)).not.toMatch(/rk_|sk_/);
  });
});

describe("reusing answers so shoppers don't cause a Stripe call per click", () => {
  const t0 = 1_800_000_000_000;

  it("a pass is reused for 10 minutes, then asked again", async () => {
    const list = vi.fn(async () => ({ data: [] }));
    await keyPermissionsReady("rk_live_A", client(list), t0);
    await keyPermissionsReady("rk_live_A", client(list), t0 + 9 * 60_000);
    expect(list).toHaveBeenCalledTimes(1);
    await keyPermissionsReady("rk_live_A", client(list), t0 + 10 * 60_000 + 1);
    expect(list).toHaveBeenCalledTimes(2);
  });

  it("a missing permission is re-checked after 1 minute, so a fix in Stripe takes effect quickly", async () => {
    const list = vi.fn().mockRejectedValueOnce(permissionError()).mockResolvedValue({ data: [] });
    expect((await keyPermissionsReady("rk_live_A", client(list), t0)).ready).toBe(false);
    expect((await keyPermissionsReady("rk_live_A", client(list), t0 + 30_000)).ready).toBe(false);
    expect(list).toHaveBeenCalledTimes(1);
    expect((await keyPermissionsReady("rk_live_A", client(list), t0 + 61_000)).ready).toBe(true);
  });

  it("'unreachable' is never reused: the next request asks again", async () => {
    const list = vi.fn().mockRejectedValueOnce(connectionError()).mockResolvedValue({ data: [] });
    expect((await keyPermissionsReady("rk_live_A", client(list), t0)).ready).toBe(false);
    expect((await keyPermissionsReady("rk_live_A", client(list), t0 + 1)).ready).toBe(true);
  });

  it("a different key is checked afresh, and the cache keeps no key text", async () => {
    const list = vi.fn(async () => ({ data: [] }));
    await keyPermissionsReady("rk_live_A", client(list), t0);
    await keyPermissionsReady("rk_live_B", client(list), t0);
    expect(list).toHaveBeenCalledTimes(2);
    const cached = (globalThis as { __fsKeyPermissions?: Map<string, unknown> }).__fsKeyPermissions!;
    expect(JSON.stringify([...cached.keys()])).not.toContain("rk_live");
  });
});

describe("live checkout waits for the key check", () => {
  it("missing Disputes: Read → checkout and quotes closed, nothing held or sent to Stripe, owner-facing log", async () => {
    liveOpen.on = true;
    stripe.list.mockRejectedValue(permissionError());
    expect(await startCheckout([{ variantId: "anything", quantity: 1 }])).toEqual({ ok: false, error: "Checkout isn't open yet." });
    expect(await quoteCheckout([{ variantId: "anything", quantity: 1 }])).toEqual({ ok: false, error: "Checkout isn't open yet.", blocked: [] });
    expect(stripe.create).not.toHaveBeenCalled();
    expect(liveOrders.keys()).toEqual([]);
    expect(logs.join("\n")).toContain("[stripe-live] checkout closed: the Stripe key is missing Disputes: Read");
    expect(logs.join("\n")).not.toContain("rk_live_FAKEKEYPERMS");
  });

  it("Stripe unreachable during the check → still closed (fails closed)", async () => {
    liveOpen.on = true;
    stripe.list.mockRejectedValue(connectionError());
    expect(await startCheckout([{ variantId: "anything", quantity: 1 }])).toEqual({ ok: false, error: "Checkout isn't open yet." });
    expect(stripe.create).not.toHaveBeenCalled();
  });

  it("with the permission: checkout gets past the gate (the cart itself is then checked as usual)", async () => {
    liveOpen.on = true;
    stripe.list.mockResolvedValue({ data: [] });
    const r = await startCheckout([{ variantId: "not-a-real-variant", quantity: 1 }]);
    expect(r.ok).toBe(false);
    expect(r.ok ? "" : r.error).not.toBe("Checkout isn't open yet.");
  });

  it("the owner's check refreshes the gate at once (no waiting for the cache)", async () => {
    liveOpen.on = true;
    stripe.list.mockRejectedValueOnce(permissionError());
    expect(await startCheckout([{ variantId: "anything", quantity: 1 }])).toEqual({ ok: false, error: "Checkout isn't open yet." });
    stripe.list.mockResolvedValue({ data: [] }); // owner added the permission in Stripe
    expect(await checkStripeKeyPermissions()).toEqual({ mode: "live", result: { ready: true } });
    const calls = stripe.list.mock.calls.length;
    const r = await startCheckout([{ variantId: "not-a-real-variant", quantity: 1 }]);
    expect(r.ok ? "" : r.error).not.toBe("Checkout isn't open yet.");
    expect(stripe.list.mock.calls.length).toBe(calls);
  });
});

describe("checking the live key before launch", () => {
  it("only on the production build, only a live-format key", () => {
    vi.stubEnv("BUILD_CONTEXT", "production");
    vi.stubEnv("STRIPE_LIVE_SECRET_KEY", "rk_live_FAKEKEY123");
    expect(liveKeyForPermissionCheck()).toBe("rk_live_FAKEKEY123");
    vi.stubEnv("STRIPE_LIVE_SECRET_KEY", "rk_test_FAKEKEY123");
    expect(liveKeyForPermissionCheck()).toBeNull();
    vi.stubEnv("STRIPE_LIVE_SECRET_KEY", "rk_live_FAKEKEY123");
    for (const ctx of ["deploy-preview", "branch-deploy", "dev", ""]) {
      vi.stubEnv("BUILD_CONTEXT", ctx);
      vi.stubEnv("CONTEXT", "");
      expect(liveKeyForPermissionCheck()).toBeNull();
    }
  });

  it("the owner's check works while live checkout is still locked, and says which key was checked", async () => {
    vi.stubEnv("BUILD_CONTEXT", "production");
    vi.stubEnv("STRIPE_LIVE_SECRET_KEY", "rk_live_FAKEKEY123");
    stripe.list.mockRejectedValue(permissionError());
    expect(await checkStripeKeyPermissions()).toEqual({ mode: "live", result: { ready: false, reason: "missing-permission", missing: ["Disputes: Read"] } });
  });

  it("nothing to check when no key is set", async () => {
    vi.stubEnv("BUILD_CONTEXT", "production");
    vi.stubEnv("STRIPE_LIVE_SECRET_KEY", "");
    expect(await checkStripeKeyPermissions()).toBeNull();
    expect(stripe.list).not.toHaveBeenCalled();
  });
});

describe("source guards", () => {
  const service = readFileSync("src/commerce/checkout/service.ts", "utf8");
  const actions = readFileSync("src/app/partners/review/orders/actions.ts", "utf8");

  it("test mode is never blocked by the key check (previews keep working with the sandbox key)", () => {
    expect(service).toMatch(/async function ownerReadyFor\(mode: StripeMode\): Promise<boolean> \{\s*if \(mode !== "live"\) return true;/);
  });

  it("the owner's button re-checks the signed-in owner first", () => {
    expect(actions).toMatch(/export async function checkKeyPermissionsAction\(\) \{\s*const ctx = await requireReviewer\(\);\s*if \(!ctx\) redirect/);
  });

  it("the CI safeguards check enforces the requirement", () => {
    const safeguards = readFileSync("scripts/safeguards-check.mjs", "utf8");
    expect(safeguards).toContain("live checkout no longer requires the Disputes: Read permission");
    expect(safeguards).toContain("live checkout no longer waits for the Stripe key permission check");
  });
});
