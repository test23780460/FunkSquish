import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
  headers: async () => new Headers({ "x-nf-client-connection-ip": "198.51.100.30" }),
}));
// Live checkout's own locks are pretended open here (fake values), so only the two-step gate decides.
const liveOpen = { on: false };
vi.mock("@/commerce/checkout/live", () => ({
  liveCodeSwitchOn: () => liveOpen.on,
  liveCheckoutEnabled: () => liveOpen.on,
  stripeLiveConfig: () =>
    liveOpen.on ? { secretKey: "rk_live_FAKEFAKE", shippingRateIds: ["shr_FAKE"], webhookSecret: "whsec_FAKE", returnOrigin: "https://funksquish.com", automaticTax: false } : null,
}));
const stripe = { create: vi.fn() };
vi.mock("@/commerce/checkout/stripe", async (orig) => ({
  ...(await orig<object>()),
  createStripeLiveClient: () => ({ checkout: { sessions: { create: stripe.create, expire: vi.fn(), retrieve: vi.fn() } } }),
}));
const { MemoryKvStore } = await import("@/lib/storage/kv-core");
const liveOrders = new MemoryKvStore();
vi.mock("@/commerce/orders/store", async (orig) => ({ ...(await orig<object>()), getLiveOrderStore: async () => liveOrders }));

const { ownerMfaReady, forgetMfaGate } = await import("@/lib/owner/mfa-gate");
const { mfaRequired, ownerSecurityStore, updateAuthState } = await import("@/lib/owner/auth");
const { getPartnerFormToken, submitPartnerApplication } = await import("@/app/actions/partners");
const { startCheckout, quoteCheckout } = await import("@/app/actions/checkout");
const { issueFormToken } = await import("@/lib/partners/security");
const { listApplications, partnerStores } = await import("@/lib/partners/store");
const { SECRET, config, goodForm, resetMemoryStores } = await import("../partners/helpers");

const logs: string[] = [];
const securityStore = () => ownerSecurityStore({ storage: "memory", storeSuffix: "-dev" });

async function enroll(id = "enr-test-1") {
  await updateAuthState(await securityStore(), (s) => ({
    ...s,
    epoch: s.epoch + 1,
    enrollment: { id, secret: "sealed", createdAt: new Date().toISOString(), lastStep: 0, recovery: [], recoveryIssuedAt: new Date().toISOString() },
  }));
  forgetMfaGate();
}

function application() {
  const f = goodForm();
  f.set("token", issueFormToken(SECRET, Date.now() - 30_000));
  return f;
}

beforeEach(() => {
  resetMemoryStores();
  delete (globalThis as { __fsOwnerSecurityStore?: unknown }).__fsOwnerSecurityStore;
  forgetMfaGate();
  liveOpen.on = false;
  stripe.create.mockReset();
  logs.length = 0;
  // Partner applications fully set up and switched on (memory storage, fake values).
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("PARTNER_DEV_MEMORY_STORE", "true");
  vi.stubEnv("PARTNER_APPLICATIONS_ENABLED", "true");
  vi.stubEnv("PARTNER_SECRET", SECRET);
  vi.stubEnv("PARTNER_REVIEW_PASSPHRASE_HASH", config.passphraseHash);
  vi.stubEnv("PARTNER_NOTIFY_EMAIL", "owner@example.com");
  vi.stubEnv("PARTNER_NOTIFY_FROM", "website@example.com");
  vi.stubEnv("BREVO_API_KEY", "fake-brevo-key");
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ messageId: "x" }, { status: 201 })));
  for (const level of ["info", "warn", "error", "log"] as const) vi.spyOn(console, level).mockImplementation((...a: unknown[]) => void logs.push(a.map(String).join(" ")));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("two-step sign-in becomes required when either feature is switched on", () => {
  it("partner applications switched on → required (as live checkout already was)", () => {
    expect(mfaRequired({ PARTNER_APPLICATIONS_ENABLED: "true" }, false)).toBe(true);
    expect(mfaRequired({}, true)).toBe(true);
    expect(mfaRequired({ OWNER_MFA_REQUIRED: "true" }, false)).toBe(true);
    expect(mfaRequired({}, false)).toBe(false); // draft: still optional, so the owner can enroll without being locked out
  });
});

describe("partner applications (private applicant details) need the owner's two-step sign-in first", () => {
  it("without it: no form token, nothing stored, an owner-facing log line with no applicant data", async () => {
    expect(await getPartnerFormToken()).toBeNull();
    expect(await submitPartnerApplication(application())).toEqual({ status: "closed" });
    expect(await listApplications((await partnerStores(config)).apps)).toEqual([]);
    expect(logs.join("\n")).toContain("two-step sign-in isn't set up");
    expect(logs.join("\n")).not.toMatch(/Pat Example|squishfactory/);
  });

  it("with it: the form works", async () => {
    await enroll();
    expect(await getPartnerFormToken()).toEqual(expect.any(String));
    expect(await submitPartnerApplication(application())).toMatchObject({ status: "success" });
    expect(await listApplications((await partnerStores(config)).apps)).toHaveLength(1);
  });

  it("closes again while an enrollment is being reset (break-glass) until the owner sets it up again", async () => {
    await enroll("enr-lost-phone");
    vi.stubEnv("OWNER_MFA_RESET_ID", "enr-lost-phone");
    forgetMfaGate();
    expect(await submitPartnerApplication(application())).toEqual({ status: "closed" });
  });
});

describe("live customer orders need the owner's two-step sign-in first", () => {
  it("without it: checkout and the cart quote say it isn't open; nothing is held or sent to Stripe", async () => {
    liveOpen.on = true;
    expect(await startCheckout([{ variantId: "anything", quantity: 1 }])).toEqual({ ok: false, error: "Checkout isn't open yet." });
    expect(await quoteCheckout([{ variantId: "anything", quantity: 1 }])).toEqual({ ok: false, error: "Checkout isn't open yet.", blocked: [] });
    expect(stripe.create).not.toHaveBeenCalled();
    expect(liveOrders.keys()).toEqual([]);
    expect(logs.join("\n")).toContain("[stripe-live] checkout closed: owner two-step sign-in isn't set up");
  });

  it("with it: checkout gets past the gate (the cart itself is then checked as usual)", async () => {
    liveOpen.on = true;
    await enroll();
    const r = await startCheckout([{ variantId: "not-a-real-variant", quantity: 1 }]);
    expect(r.ok).toBe(false);
    expect(r.ok ? "" : r.error).not.toBe("Checkout isn't open yet.");
  });
});

describe("the gate fails closed", () => {
  it("owner area not configured", async () => {
    vi.stubEnv("PARTNER_SECRET", "");
    expect(await ownerMfaReady()).toEqual({ ready: false, reason: "owner-area-not-configured" });
  });

  it("security store unreadable", async () => {
    (globalThis as { __fsOwnerSecurityStore?: unknown }).__fsOwnerSecurityStore = {
      durable: false,
      get: async () => {
        throw new Error("down");
      },
    };
    expect(await ownerMfaReady()).toEqual({ ready: false, reason: "store-unavailable" });
  });

  it("answers are reused for a minute, then re-read", async () => {
    const t = Date.now();
    expect((await ownerMfaReady(t)).ready).toBe(false);
    await updateAuthState(await securityStore(), (s) => ({
      ...s,
      enrollment: { id: "e", secret: "s", createdAt: "", lastStep: 0, recovery: [], recoveryIssuedAt: "" },
    }));
    expect((await ownerMfaReady(t + 30_000)).ready).toBe(false);
    expect((await ownerMfaReady(t + 61_000)).ready).toBe(true);
  });
});
