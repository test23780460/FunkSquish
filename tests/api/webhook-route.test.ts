import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Stripe from "stripe";
import { fakeDeps, SESSION_ID, CHECKOUT_ID } from "../orders/helpers";

// Fake values only — not real Stripe credentials.
const SECRET = "whsec_FAKEtestSECRET123";
const ENV = {
  BUILD_CONTEXT: "deploy-preview",
  STRIPE_TEST_CHECKOUT_ENABLED: "true",
  STRIPE_TEST_SECRET_KEY: "sk_test_FAKEFAKEFAKE123",
  STRIPE_TEST_SHIPPING_RATE_ID: "shr_FAKE123",
  STRIPE_TEST_WEBHOOK_SECRET: SECRET,
  DEPLOY_PRIME_URL: "https://deploy-preview-6--ephemeral-syrniki-2b3f3c.netlify.app",
};

vi.mock("server-only", () => ({}));
const shared = { f: fakeDeps() };
vi.mock("@/commerce/checkout/service", () => ({ orderDepsFor: async () => shared.f.deps }));

const { POST } = await import("@/app/api/stripe/test-webhook/route");

function eventBody(id: string, type = "checkout.session.completed", livemode = false) {
  return JSON.stringify({ id, object: "event", type, livemode, data: { object: { id: SESSION_ID, object: "checkout.session", client_reference_id: CHECKOUT_ID } } });
}

function signed(body: string, opts: { secret?: string; timestamp?: number } = {}) {
  const header = Stripe.webhooks.generateTestHeaderString({ payload: body, secret: opts.secret ?? SECRET, timestamp: opts.timestamp });
  return new Request("https://preview.example/api/stripe/test-webhook", {
    method: "POST",
    headers: { "stripe-signature": header, "content-type": "application/json" },
    body,
  });
}

const saved = { ...process.env };
beforeEach(() => {
  shared.f = fakeDeps();
  Object.assign(process.env, ENV);
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  for (const k of Object.keys(ENV)) delete process.env[k];
  Object.assign(process.env, saved);
  vi.restoreAllMocks();
});

describe("POST /api/stripe/test-webhook", () => {
  it("accepts a correctly signed test event and creates the order", async () => {
    const res = await POST(signed(eventBody("evt_ok1")));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true, status: "processed" });
    expect(shared.f.store.keys()).toContain(`order/session/${SESSION_ID}`);
  });

  it("acknowledges a duplicate delivery without reprocessing", async () => {
    await POST(signed(eventBody("evt_dup")));
    const res = await POST(signed(eventBody("evt_dup")));
    expect(await res.json()).toEqual({ received: true, status: "duplicate" });
  });

  it("rejects a bad signature", async () => {
    const res = await POST(signed(eventBody("evt_bad"), { secret: "whsec_WRONGsecret999" }));
    expect(res.status).toBe(400);
    expect(shared.f.store.keys()).toEqual([]);
  });

  it("rejects a tampered body", async () => {
    const req = signed(eventBody("evt_t"));
    const tampered = new Request(req.url, { method: "POST", headers: req.headers, body: eventBody("evt_t").replace(SESSION_ID, "cs_test_attackerAAAAAAAA") });
    expect((await POST(tampered)).status).toBe(400);
  });

  it("rejects a replayed (old) event", async () => {
    const res = await POST(signed(eventBody("evt_old"), { timestamp: Math.floor(Date.now() / 1000) - 3600 }));
    expect(res.status).toBe(400);
  });

  it("rejects a missing signature", async () => {
    const res = await POST(new Request("https://x/api", { method: "POST", body: eventBody("evt_n") }));
    expect(res.status).toBe(400);
  });

  it("rejects live-mode events even when signed", async () => {
    const res = await POST(signed(eventBody("evt_live", "checkout.session.completed", true)));
    expect(res.status).toBe(400);
  });

  it("returns 500 so Stripe retries when processing fails", async () => {
    shared.f = { ...shared.f, deps: { ...shared.f.deps, retrieveSession: () => Promise.reject(new Error("down")) } } as typeof shared.f;
    const res = await POST(signed(eventBody("evt_fail")));
    expect(res.status).toBe(500);
  });

  it("is 404 on production", async () => {
    process.env.BUILD_CONTEXT = "production";
    expect((await POST(signed(eventBody("evt_p")))).status).toBe(404);
  });

  it("is 404 when the test switch is off", async () => {
    delete process.env.STRIPE_TEST_CHECKOUT_ENABLED;
    expect((await POST(signed(eventBody("evt_s")))).status).toBe(404);
  });

  it("is 503 when no webhook secret is configured", async () => {
    delete process.env.STRIPE_TEST_WEBHOOK_SECRET;
    expect((await POST(signed(eventBody("evt_c")))).status).toBe(503);
  });

  it("refuses to run with a live key", async () => {
    process.env.STRIPE_TEST_SECRET_KEY = "sk_live_FAKE123";
    expect((await POST(signed(eventBody("evt_k")))).status).toBe(404);
  });
});
