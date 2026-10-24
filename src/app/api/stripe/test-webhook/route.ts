import Stripe from "stripe";
import { stripeTestConfig } from "@/commerce/checkout/environment";
import { orderDepsFor } from "@/commerce/checkout/service";
import { handleStripeEvent, type VerifiedEvent } from "@/commerce/orders/webhook";

/**
 * Stripe TEST-mode webhook. Returns 404 anywhere the test integration isn't
 * allowed (always on production).
 *
 * 1. Read the RAW body (signature covers the exact bytes).
 * 2. Verify `Stripe-Signature` with Stripe's official library: HMAC-SHA256
 *    with the endpoint secret, constant-time compare, 5-minute timestamp
 *    tolerance (replay protection).
 * 3. Reject live-mode events.
 * 4. Hand off to idempotent order processing; 5xx makes Stripe retry.
 * Logs contain only event ids/types — never customer data.
 * (Route handlers run on the Node.js runtime by default.)
 */

const MAX_BODY_BYTES = 256 * 1024;

export async function POST(request: Request): Promise<Response> {
  const config = stripeTestConfig();
  if (!config) return new Response("Not found", { status: 404 });
  if (!config.webhookSecret) return new Response("Webhook not configured", { status: 503 });

  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > MAX_BODY_BYTES) return new Response("Payload too large", { status: 413 });
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return new Response("Payload too large", { status: 413 });

  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });

  let event: Stripe.Event;
  try {
    event = Stripe.webhooks.constructEvent(raw, signature, config.webhookSecret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }
  if (event.livemode !== false) return new Response("Live events are not accepted here", { status: 400 });

  try {
    const result = await handleStripeEvent(event as unknown as VerifiedEvent, await orderDepsFor(config));
    if (result.status !== "ignored") console.info("[stripe-test-webhook]", result.status, event.type, event.id);
    return Response.json({ received: true, status: result.status });
  } catch (err) {
    console.error("[stripe-test-webhook] processing failed", event.type, event.id, err instanceof Error ? err.name : "unknown");
    return new Response("Processing failed; Stripe will retry", { status: 500 });
  }
}
