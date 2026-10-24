import { createHmac, timingSafeEqual } from "node:crypto";
import { stripeTestEnvironmentAllowed } from "@/commerce/providers/stripe-test-checkout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function validSignature(body: string, header: string, secret: string): boolean {
  const entries = header.split(",").map((item) => item.trim().split("="));
  const timestamp = entries.find(([key]) => key === "t")?.[1];
  const sigs = entries.filter(([key]) => key === "v1").map(([, value]) => value);
  if (!timestamp || !/^\d+$/.test(timestamp) || !sigs.length) return false;
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest();
  return sigs.some((value) => {
    if (!value || !/^[a-f0-9]{64}$/i.test(value)) return false;
    const actual = Buffer.from(value, "hex");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  });
}

/**
 * Test-mode webhook probe only. A verified 200 response is NOT an order
 * record, stock reservation, tax filing, customer email, or fulfillment.
 * Durable idempotent order storage must be built and reviewed before launch.
 */
export async function POST(request: Request): Promise<Response> {
  if (!stripeTestEnvironmentAllowed()) return new Response("Not found", { status: 404 });
  const secret = process.env.STRIPE_TEST_WEBHOOK_SECRET;
  if (!secret?.startsWith("whsec_")) return new Response("Not configured", { status: 503 });
  if (Number(request.headers.get("content-length") || 0) > 100_000) return new Response("Too large", { status: 413 });
  const raw = await request.text();
  if (raw.length > 100_000) return new Response("Too large", { status: 413 });
  const sig = request.headers.get("stripe-signature");
  if (!sig || !validSignature(raw, sig, secret)) return new Response("Invalid signature", { status: 400 });
  let event: { id?: string; type?: string; livemode?: boolean };
  try {
    event = JSON.parse(raw) as typeof event;
  } catch {
    return new Response("Invalid event", { status: 400 });
  }
  if (event.livemode !== false || !event.id?.startsWith("evt_")) {
    return new Response("Invalid test event", { status: 400 });
  }
  // Intentionally omit personal information and object data from logs.
  if (event.type?.startsWith("checkout.session.")) {
    console.info("[stripe-test-webhook] verified", event.type, event.id);
  }
  return Response.json({ received: true });
}
