import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConflictError, MemoryKvStore, type KvStore } from "@/lib/storage/kv-core";
import { rateLimitExpired } from "@/lib/partners/retention";
import { runRetention } from "@/lib/partners/cleanup";

// Fake values only — not real Stripe credentials.
const ENV = {
  BUILD_CONTEXT: "deploy-preview",
  STRIPE_TEST_CHECKOUT_ENABLED: "true",
  STRIPE_TEST_SECRET_KEY: "sk_test_FAKEFAKEFAKE123",
  STRIPE_TEST_SHIPPING_RATE_ID: "shr_FAKE123",
  DEPLOY_PRIME_URL: "https://deploy-preview-6--ephemeral-syrniki-2b3f3c.netlify.app",
  PARTNER_SECRET: "test-only-partner-secret-0123456789abcdef",
};

const state = {
  orders: new MemoryKvStore(),
  limits: new MemoryKvStore(),
  create: vi.fn(),
  headers: new Headers() as Headers | null,
};

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: async () => {
    if (!state.headers) throw new Error("headers() called outside a request scope");
    return state.headers;
  },
}));
vi.mock("@/commerce/orders/store", async (orig) => ({ ...(await orig<object>()), getTestOrderStore: async () => state.orders }));
// The deploy-preview rate-limit store (Netlify Blobs) is replaced by memory.
vi.mock("@/lib/storage/kv", async (orig) => ({ ...(await orig<object>()), createBlobsKvStore: async () => state.limits }));
vi.mock("@/commerce/checkout/stripe", async (orig) => ({
  ...(await orig<object>()),
  createStripeTestClient: () => ({ checkout: { sessions: { create: state.create, expire: vi.fn(), retrieve: vi.fn() } } }),
}));

const { startCheckout, quoteCheckout } = await import("@/app/actions/checkout");
const { CHECKOUT_RATE_LIMITS, RATE_LIMIT_MESSAGES, MAX_TRACKED_CLIENTS, checkCheckoutRateLimit, clientNetwork, resetCheckoutRateLimitMemory } = await import(
  "@/commerce/checkout/rate-limit"
);

const from = (ip: string, extra: Record<string, string> = {}) => new Headers({ "x-nf-client-connection-ip": ip, ...extra });
const CART = [{ variantId: "test-var-jelly-blue", quantity: 1 }];
const MIXED = [
  { variantId: "test-var-jelly-blue", quantity: 1 },
  { variantId: "test-var-supplier-mint", quantity: 1 },
];

const T0 = new Date("2026-11-03T15:00:00Z").getTime();
let now = T0;
const advance = (seconds: number) => {
  now += seconds * 1000;
  vi.setSystemTime(now);
};

const saved = { ...process.env };
beforeEach(() => {
  Object.assign(process.env, ENV);
  vi.useFakeTimers({ toFake: ["Date"] });
  now = T0;
  vi.setSystemTime(now);
  state.orders = new MemoryKvStore();
  state.limits = new MemoryKvStore();
  state.headers = from("203.0.113.10");
  state.create = vi.fn(async () => ({ id: "cs_test_abcdefghij123", livemode: false, url: "https://checkout.stripe.com/c/pay/cs_test_abcdefghij123" }));
  resetCheckoutRateLimitMemory();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  for (const k of Object.keys(ENV)) delete process.env[k];
  Object.assign(process.env, saved);
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** One shopper "session": edits the cart `edits` times (a quote each), then checks out. */
async function shop(ip: string, edits: number, secondsBetween = 8) {
  state.headers = from(ip);
  for (let i = 0; i < edits; i++) {
    const q = await quoteCheckout(i % 2 ? MIXED : CART);
    expect(q.ok, `quote ${i + 1} from ${ip}`).toBe(true);
    advance(secondsBetween);
  }
  state.orders = new MemoryKvStore(); // each checkout below starts with fresh stock
  return startCheckout(MIXED);
}

describe("legitimate shoppers still check out", () => {
  it("one shopper: 40 cart changes and a checkout in a few minutes all go through", async () => {
    const r = await shop("203.0.113.10", 40, 5);
    expect(r).toMatchObject({ ok: true, url: expect.stringContaining("checkout.stripe.com") });
    expect(state.create).toHaveBeenCalledTimes(1);
  });

  it("a shopper who goes back and forth to Stripe several times can still pay", async () => {
    for (let i = 0; i < 8; i++) {
      expect((await shop("203.0.113.10", 3)).ok, `checkout ${i + 1}`).toBe(true);
      advance(60);
    }
    expect(state.create).toHaveBeenCalledTimes(8);
  });

  it("a busy shared network (school, office, phone carrier): 5 shoppers, 25 cart changes each, all check out", async () => {
    for (let s = 0; s < 5; s++) expect((await shop("198.51.100.7", 25, 3)).ok, `shopper ${s + 1}`).toBe(true);
  });

  it("rapid quantity taps (one quote per second for a minute) stay under the burst limit", async () => {
    state.headers = from("203.0.113.10");
    for (let i = 0; i < 39; i++) {
      expect((await quoteCheckout(CART)).ok).toBe(true);
      advance(1.5);
    }
  });

  it("a shopper whose quote was limited can still check out (separate counters)", async () => {
    state.headers = from("203.0.113.10");
    for (let i = 0; i < CHECKOUT_RATE_LIMITS.quote.windows[0].max; i++) {
      await quoteCheckout(CART);
      advance(3);
    }
    expect(await quoteCheckout(CART)).toEqual({ ok: false, error: RATE_LIMIT_MESSAGES.quote, blocked: [] });
    expect((await startCheckout(CART)).ok).toBe(true);
  });

  it("the limited-quote message promises the total on Stripe's page and doesn't block the checkout button (no blocked items)", () => {
    expect(RATE_LIMIT_MESSAGES.quote).toMatch(/shown on the secure checkout page before you pay/);
    expect(RATE_LIMIT_MESSAGES.start).toMatch(/nothing was charged/);
  });
});

describe("abuse is limited", () => {
  it("a quote flood from one network is refused; other networks are unaffected", async () => {
    state.headers = from("192.0.2.66");
    let refusedAt = -1;
    for (let i = 0; i < 400 && refusedAt < 0; i++) {
      const q = await quoteCheckout(CART);
      if (!q.ok) refusedAt = i;
      advance(1.6); // just under the burst limit, to reach the stored 10-minute limit
    }
    expect(refusedAt).toBe(CHECKOUT_RATE_LIMITS.quote.windows[0].max);
    state.headers = from("203.0.113.10");
    expect((await quoteCheckout(CART)).ok).toBe(true);
  });

  it("a burst is stopped in memory before it touches storage", async () => {
    state.headers = from("192.0.2.66");
    const results = [];
    for (let i = 0; i < 100; i++) results.push((await quoteCheckout(CART)).ok);
    expect(results.filter(Boolean)).toHaveLength(CHECKOUT_RATE_LIMITS.quote.burst.max);
    const counters = await Promise.all(state.limits.keys().map(async (k) => (await state.limits.get<{ n: number }>(k))?.value.n));
    expect(counters).toEqual([CHECKOUT_RATE_LIMITS.quote.burst.max]); // refused requests weren't counted in storage
  });

  it("checkout starts (which hold stock) are limited per 30 minutes; nothing is held or sent to Stripe when refused", async () => {
    const max = CHECKOUT_RATE_LIMITS.start.windows[0].max;
    state.headers = from("192.0.2.66");
    for (let i = 0; i < max; i++) {
      state.orders = new MemoryKvStore();
      expect((await startCheckout(CART)).ok).toBe(true);
      advance(15);
    }
    state.orders = new MemoryKvStore();
    expect(await startCheckout(CART)).toEqual({ ok: false, error: RATE_LIMIT_MESSAGES.start });
    expect(state.create).toHaveBeenCalledTimes(max);
    expect(state.orders.keys()).toEqual([]); // no stock hold
    advance(30 * 60);
    expect((await startCheckout(CART)).ok).toBe(true);
  });

  it("a daily cap on checkout starts", async () => {
    state.headers = from("192.0.2.66");
    let ok = 0;
    for (let i = 0; i < 60; i++) {
      state.orders = new MemoryKvStore();
      if ((await startCheckout(CART)).ok) ok++;
      advance(200); // 9 per 30 minutes: never hits the 30-minute limit
    }
    expect(ok).toBe(CHECKOUT_RATE_LIMITS.start.windows[1].max);
  });

  it("a spoofed X-Forwarded-For doesn't change who is counted", async () => {
    for (let i = 0; i < CHECKOUT_RATE_LIMITS.quote.burst.max; i++) {
      state.headers = from("192.0.2.66", { "x-forwarded-for": `10.0.0.${i}` });
      expect((await quoteCheckout(CART)).ok).toBe(true);
    }
    state.headers = from("192.0.2.66", { "x-forwarded-for": "10.9.9.9" });
    expect((await quoteCheckout(CART)).ok).toBe(false);
  });

  it("identifies networks safely", () => {
    expect(clientNetwork(from("203.0.113.10"))).toBe("203.0.113.10");
    // Without Netlify's header, only the last (proxy-added) X-Forwarded-For entry counts.
    expect(clientNetwork(new Headers({ "x-forwarded-for": "1.2.3.4, 203.0.113.10" }))).toBe("203.0.113.10");
    expect(clientNetwork(from("::ffff:203.0.113.10"))).toBe("203.0.113.10");
    // IPv6: one home/phone usually has a whole /64, so it's counted as one network.
    expect(clientNetwork(from("2001:db8:aa:bb::1"))).toBe("2001:db8:aa:bb::/64");
    expect(clientNetwork(from("2001:0db8:00aa:00bb:1234:5678:9abc:def0"))).toBe("2001:db8:aa:bb::/64");
    expect(clientNetwork(from("not an ip"))).toBe("unknown");
    expect(clientNetwork(new Headers())).toBe("unknown");
  });

  it("IPv6 addresses in the same /64 share one limit", async () => {
    for (let i = 0; i < CHECKOUT_RATE_LIMITS.quote.burst.max; i++) {
      state.headers = from(`2001:db8:aa:bb::${(i + 1).toString(16)}`);
      expect((await quoteCheckout(CART)).ok).toBe(true);
    }
    state.headers = from("2001:db8:aa:bb:ffff::1");
    expect((await quoteCheckout(CART)).ok).toBe(false);
    state.headers = from("2001:db8:aa:cc::1"); // another /64
    expect((await quoteCheckout(CART)).ok).toBe(true);
  });

  it("parallel requests from one network that keep colliding on its counter are refused, not let through", async () => {
    const colliding: KvStore = {
      durable: true,
      get: async <T,>() => ({ value: { n: 1 } as T, etag: "1" }),
      create: async () => false,
      replace: async () => false,
      delete: async () => {},
      list: async () => [],
    };
    expect(await checkCheckoutRateLimit("start", from("192.0.2.66"), now, colliding)).toEqual({ ok: false, message: RATE_LIMIT_MESSAGES.start });
    expect(ConflictError).toBeDefined();
  });

  it("the per-instance memory is bounded", async () => {
    for (let i = 0; i < MAX_TRACKED_CLIENTS + 50; i++) await checkCheckoutRateLimit("quote", from(`10.${(i >> 16) & 255}.${(i >> 8) & 255}.${i & 255}`), now, null);
    const map = (globalThis as { __fsCheckoutBurst?: Map<string, number[]> }).__fsCheckoutBurst!;
    expect(map.size).toBe(MAX_TRACKED_CLIENTS);
  });
});

describe("privacy and safety of the limiter", () => {
  it("stores only keyed hashes (no IP), in keys the daily cleanup deletes after 2 days", async () => {
    state.headers = from("203.0.113.10");
    await quoteCheckout(CART);
    await startCheckout(CART);
    const keys = state.limits.keys();
    expect(keys.length).toBe(3); // quote: 10 min; start: 30 min + day
    for (const k of keys) {
      expect(k).not.toContain("203.0.113");
      expect(k).toMatch(/^checkout-(quote|start)\/[A-Za-z0-9_-]{22}\/w\d+\/\d+$/);
      expect(rateLimitExpired(k, new Date(now + 3_600_000))).toBe(false);
      expect(rateLimitExpired(k, new Date(now + 49 * 3_600_000 + 86_400_000))).toBe(true);
    }
  });

  it("the existing daily cleanup deletes them (and nothing else of the shop's)", async () => {
    state.headers = from("203.0.113.10");
    await quoteCheckout(CART);
    await startCheckout(CART);
    expect(state.limits.keys()).toHaveLength(3);
    const stores = { apps: new MemoryKvStore(), limits: state.limits, ops: new MemoryKvStore() };
    await runRetention(stores, { now: new Date(now + 24 * 3_600_000), trigger: "test" });
    expect(state.limits.keys()).toHaveLength(3); // too early
    await runRetention(stores, { now: new Date(now + 4 * 86_400_000), trigger: "test" });
    expect(state.limits.keys()).toEqual([]);
    expect(state.orders.keys().length).toBeGreaterThan(0); // orders/holds live elsewhere, untouched
  });

  it("never logs the network address", async () => {
    const logs = [vi.spyOn(console, "log"), vi.spyOn(console, "info"), console.warn as unknown as ReturnType<typeof vi.spyOn>, console.error as unknown as ReturnType<typeof vi.spyOn>];
    state.headers = from("203.0.113.10");
    for (let i = 0; i < 60; i++) await quoteCheckout(CART);
    for (let i = 0; i < 12; i++) await startCheckout(CART);
    for (const l of logs) expect(JSON.stringify(l.mock.calls)).not.toContain("203.0.113");
  });

  it("a storage outage lets shoppers through (and logs only the error class)", async () => {
    const down: KvStore = {
      durable: true,
      get: async () => {
        throw new Error("blobs down for 203.0.113.10");
      },
      create: async () => false,
      replace: async () => false,
      delete: async () => {},
      list: async () => [],
    };
    expect(await checkCheckoutRateLimit("start", from("203.0.113.10"), now, down)).toEqual({ ok: true });
    expect(JSON.stringify((console.error as unknown as ReturnType<typeof vi.spyOn>).mock.calls)).not.toContain("203.0.113");
  });

  it("while checkout is closed, nothing is counted or stored", async () => {
    delete process.env.STRIPE_TEST_CHECKOUT_ENABLED;
    for (let i = 0; i < 100; i++) expect(await quoteCheckout(CART)).toEqual({ ok: false, error: "Checkout isn't open yet.", blocked: [] });
    expect((await startCheckout(CART)).ok).toBe(false);
    expect(state.limits.keys()).toEqual([]);
  });

  it("without the site secret on Netlify, limits still apply per server instance and nothing is stored", async () => {
    delete process.env.PARTNER_SECRET;
    state.headers = from("192.0.2.66");
    const results = [];
    for (let i = 0; i < 60; i++) results.push((await quoteCheckout(CART)).ok);
    expect(results.filter(Boolean)).toHaveLength(CHECKOUT_RATE_LIMITS.quote.burst.max);
    expect(state.limits.keys()).toEqual([]);
  });

  it("calls from outside a web request (tests, scripts) aren't counted", async () => {
    state.headers = null;
    for (let i = 0; i < 60; i++) expect((await quoteCheckout(CART)).ok).toBe(true);
    expect(state.limits.keys()).toEqual([]);
  });
});
