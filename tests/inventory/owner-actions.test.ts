import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: ({ name }: { name: string }) => void jar.delete(name),
  }),
  headers: async () => new Headers({ "x-nf-client-connection-ip": "198.51.100.21" }),
}));
class Redirect extends Error {
  constructor(public url: string) {
    super(url);
  }
}
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Redirect(url);
  },
}));

const { adjustAction, pauseAction, resumeAction, startLiveAction, endLiveAction, undoAction, tiktokListedAction, releaseCanceledAction } = await import("@/app/partners/review/inventory/actions");
const { loginAction } = await import("@/app/partners/review/actions");
const { hashPassphrase, SESSION_COOKIE } = await import("@/lib/partners/security");
const { getTestOrderStore } = await import("@/commerce/orders/store");
const { getLedger } = await import("@/commerce/orders/inventory");
const { inventoryContext } = await import("@/commerce/orders/inventory-context");
const { resetMemoryStores, SECRET } = await import("../partners/helpers");

const PASS = "four random squishy words";
const fd = (o: Record<string, string | string[]>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) for (const x of Array.isArray(v) ? v : [v]) f.append(k, x);
  return f;
};
const go = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    if (e instanceof Redirect) return e.url;
    throw e;
  }
  return null;
};

beforeEach(async () => {
  resetMemoryStores();
  delete (globalThis as { __funksquishTestOrderStore?: unknown }).__funksquishTestOrderStore;
  jar.clear();
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("PARTNER_DEV_MEMORY_STORE", "true");
  vi.stubEnv("PARTNER_SECRET", SECRET);
  vi.stubEnv("PARTNER_REVIEW_PASSPHRASE_HASH", await hashPassphrase(PASS, 16384));
  for (const level of ["info", "warn"] as const) vi.spyOn(console, level).mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("inventory actions", () => {
  it("manage TEST fixtures only, off production", async () => {
    const ctx = await inventoryContext();
    expect(ctx.mode).toBe("test");
    expect(ctx.items.every((i) => i.variantId.startsWith("test-var-"))).toBe(true);
  });

  it("refuse every change without a valid owner session", async () => {
    jar.set(SESSION_COOKIE, "forged.token.value.sig");
    const v = "test-var-jelly-blue";
    for (const p of [
      adjustAction(fd({ variant: v, kind: "tiktok-sale", quantity: "1", requestId: randomUUID() })),
      undoAction(fd({ variant: v, adjustment: randomUUID() })),
      pauseAction(fd({ variant: v })),
      resumeAction(fd({ variant: v })),
      tiktokListedAction(fd({ variant: v, listed: "yes" })),
      releaseCanceledAction(fd({ variant: v })),
      startLiveAction(fd({ variant: v, pause: "yes" })),
      endLiveAction(fd({})),
    ])
      expect(await go(p)).toBe("/partners/review");
    expect(await getLedger(await getTestOrderStore(), v)).toBeNull();
  });

  it("record a TikTok sale for a signed-in owner, and only for items in this catalog", async () => {
    expect(await go(loginAction({ error: null }, fd({ passphrase: PASS })))).toBe("/partners/review");
    const store = await getTestOrderStore();
    const r = await go(adjustAction(fd({ variant: "test-var-jelly-blue", kind: "tiktok-sale", quantity: "1", requestId: randomUUID() })));
    expect(r).toMatch(/^\/partners\/review\/inventory\?saved=TEST-JELLY-BLUE%3A\+5\+%E2%86%92\+4/);
    expect((await getLedger(store, "test-var-jelly-blue"))?.onHand).toBe(4);

    expect(await go(adjustAction(fd({ variant: "someone-elses-variant", kind: "tiktok-sale", quantity: "1", requestId: randomUUID() })))).toMatch(/error=/);
    expect(await getLedger(store, "someone-elses-variant")).toBeNull();
    // An outside "back" address is ignored.
    expect(await go(adjustAction(fd({ variant: "test-var-jelly-blue", kind: "received", quantity: "1", requestId: randomUUID(), back: "https://evil.example" })))).toMatch(/^\/partners\/review\/inventory\?/);
  });

  it("asks before taking units the website sold, then records when confirmed", async () => {
    await go(loginAction({ error: null }, fd({ passphrase: PASS })));
    const store = await getTestOrderStore();
    const requestId = randomUUID();
    const first = await go(adjustAction(fd({ variant: "test-var-jelly-pink", kind: "tiktok-sale", quantity: "1", requestId })));
    expect(first).toMatch(/saved=/); // 1 on the shelf, nothing sold on the website: fine
    const second = await go(adjustAction(fd({ variant: "test-var-jelly-pink", kind: "tiktok-sale", quantity: "1", requestId: randomUUID() })));
    expect(second).toMatch(/error=That\+would\+take/); // below zero: refused, not clamped
    expect((await getLedger(store, "test-var-jelly-pink"))?.onHand).toBe(0);
  });

  it("pause only real items of this catalog; LIVE start and end round-trip", async () => {
    await go(loginAction({ error: null }, fd({ passphrase: PASS })));
    const store = await getTestOrderStore();
    expect(await go(pauseAction(fd({ variant: ["test-var-jelly-blue", "not-a-real-one"] })))).toMatch(/Paused\+1\+item/);
    expect((await getLedger(store, "test-var-jelly-blue"))?.paused).toMatchObject({ by: "owner" });
    expect(await getLedger(store, "not-a-real-one")).toBeNull();
    await go(resumeAction(fd({ variant: "test-var-jelly-blue" })));

    expect(await go(startLiveAction(fd({ variant: ["test-var-jelly-blue", "test-var-supplier-mint"], pause: "yes" })))).toMatch(/LIVE\+started/);
    expect((await getLedger(store, "test-var-supplier-mint"))?.paused).toMatchObject({ by: "live" });
    expect(await go(endLiveAction(fd({ "sales-test-var-jelly-blue": "2", "count-test-var-supplier-mint": "", resume: "yes" })))).toMatch(/LIVE\+ended/);
    expect((await getLedger(store, "test-var-jelly-blue"))?.onHand).toBe(3);
    expect((await getLedger(store, "test-var-supplier-mint"))?.paused).toBeNull();
  });
});
