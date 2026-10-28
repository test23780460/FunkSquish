import Stripe from "stripe";
import { stripeLiveConfig } from "@/commerce/checkout/live";
import { orderDeps } from "@/commerce/checkout/service";
import { handleStripeEvent, type VerifiedEvent } from "@/commerce/orders/webhook";

/**
 * Stripe LIVE webhook (production only). Returns 404 unless every live lock
 * is open. Same safeguards as the test endpoint, mirrored for live mode:
 *  1. raw body + `Stripe-Signature` verified with the LIVE endpoint secret
 *     (HMAC-SHA256, constant-time compare, 5-minute replay window);
 *  2. TEST events are rejected (and the test endpoint rejects live ones);
 *  3. idempotent order processing — duplicates can't create a second order
 *     or count stock twice; a 5xx makes Stripe retry.
 * Logs contain only event ids/types — never customer data.
 */
const MAX_BODY_BYTES = 256 * 1024;

export async function POST(request: Request): Promise<Response> {
  const config = stripeLiveConfig();
  if (!config) return new Response("Not found", { status: 404 });

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
  if (event.livemode !== true) return new Response("Test events are not accepted here", { status: 400 });

  const deps = await orderDeps("live");
  if (!deps) return new Response("Not found", { status: 404 });
  try {
    const result = await handleStripeEvent(event as unknown as VerifiedEvent, deps);
    if (result.status !== "ignored") console.info("[stripe-webhook]", result.status, event.type, event.id);
    return Response.json({ received: true, status: result.status });
  } catch (err) {
    console.error("[stripe-webhook] processing failed", event.type, event.id, err instanceof Error ? err.name : "unknown");
    return new Response("Processing failed; Stripe will retry", { status: 500 });
  }
}
