import { fulfillCheckoutSession, handleSessionExpired, markPaymentFailed, recordRefund, type OrderDeps } from "./fulfill";

/**
 * Routes a signature-VERIFIED Stripe event to order processing.
 *
 * Duplicate deliveries: Stripe may send the same event more than once (and
 * occasionally two different events for the same object). We record each
 * event id, skip ones already processed, and — because every handler below
 * is idempotent per Checkout Session — a duplicate that slips through still
 * can't create a second order or double-count stock.
 *
 * If processing throws, the caller returns 5xx so Stripe retries later; the
 * event marker stays "processing" and the retry runs it again safely.
 */

export interface VerifiedEvent {
  id: string;
  type: string;
  livemode: boolean;
  data: { object: Record<string, unknown> };
}

export const HANDLED_EVENT_TYPES = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
  "charge.refunded",
] as const;

const eventKey = (id: string) => `event/${id}`;

export type HandleResult = { status: "processed" | "duplicate" | "ignored" };

const str = (v: unknown) => (typeof v === "string" ? v : null);

export async function handleStripeEvent(event: VerifiedEvent, deps: OrderDeps): Promise<HandleResult> {
  const live = (deps.mode ?? "test") === "live";
  if (event.livemode !== live) throw new Error(`${event.livemode ? "Live" : "Test"}-mode event rejected by the ${live ? "live" : "test"} integration.`);
  if (!(HANDLED_EVENT_TYPES as readonly string[]).includes(event.type)) return { status: "ignored" };

  const marker = await deps.store.get<{ status: string }>(eventKey(event.id));
  if (marker?.value.status === "processed") return { status: "duplicate" };
  if (!marker) await deps.store.create(eventKey(event.id), { status: "processing", type: event.type, at: deps.now().toISOString() });

  const object = event.data.object;
  const sessionId = str(object.id);
  const checkoutId = str(object.client_reference_id) ?? str((object.metadata as Record<string, unknown> | undefined)?.checkout_id);

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      if (sessionId) await fulfillCheckoutSession(sessionId, deps, event.id, event.type);
      break;
    case "checkout.session.async_payment_failed":
      if (sessionId) await markPaymentFailed(sessionId, checkoutId, deps, event.id);
      break;
    case "checkout.session.expired":
      await handleSessionExpired(checkoutId, deps);
      break;
    case "charge.refunded": {
      const pi = str(object.payment_intent);
      const amount = typeof object.amount_refunded === "number" ? object.amount_refunded : null;
      if (pi && amount !== null) await recordRefund(pi, amount, deps, event.id);
      break;
    }
  }

  const current = await deps.store.get<{ status: string }>(eventKey(event.id));
  if (current) await deps.store.replace(eventKey(event.id), { ...current.value, status: "processed" }, current.etag);
  return { status: "processed" };
}
