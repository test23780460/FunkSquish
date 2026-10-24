import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Container } from "@/components/ui/Primitives";
import { ButtonLink } from "@/components/ui/Button";
import { Mascot } from "@/components/illustrations/Mascot";
import { pageMetadata } from "@/lib/seo";
import { formatMoney } from "@/commerce/availability";
import { stripeTestConfig, testCheckoutEnabled } from "@/commerce/checkout/environment";
import { cancelTestCheckout, orderDepsFor } from "@/commerce/checkout/service";
import { fulfillCheckoutSession, type FulfillOutcome } from "@/commerce/orders/fulfill";
import type { Order } from "@/commerce/orders/types";

export const metadata = pageMetadata({
  title: "Checkout result (test mode)",
  description: "Stripe test-mode checkout result.",
  path: "/checkout/test-result",
  noindex: true,
});

/**
 * Where Stripe sends shoppers back. The redirect itself proves nothing: the
 * Checkout Session is re-fetched from Stripe on the server and only a paid
 * session produces an order (the same idempotent step the webhook runs).
 * No personal details are shown — anyone holding this URL sees only items and totals.
 */
export default function TestResultPage({ searchParams }: PageProps<"/checkout/test-result">) {
  if (!testCheckoutEnabled()) notFound();
  return (
    <section className="sky-wash pb-32 pt-32 sm:pt-40">
      <Container className="flex max-w-2xl flex-col items-center text-center">
        <Suspense fallback={<Message mood="grin" title="Checking your payment…" body="This only takes a moment." />}>
          <Result searchParams={searchParams} />
        </Suspense>
      </Container>
    </section>
  );
}

const usd = (cents: number) => formatMoney({ amount: cents, currency: "USD" });

function Message({ title, body, mood = "grin", children }: { title: string; body: string; mood?: "grin" | "happy"; children?: React.ReactNode }) {
  return (
    <>
      <Mascot className="w-32 animate-bob sm:w-40" mood={mood} />
      <p className="mt-6 font-display text-sm font-semibold uppercase tracking-[0.14em] text-royal">Stripe test mode</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-ink sm:text-5xl">{title}</h1>
      <p className="mt-4 max-w-md text-lg text-ink-soft">{body}</p>
      {children}
      <div className="mt-8 flex flex-col gap-3 min-[440px]:flex-row">
        <ButtonLink href="/checkout/test" size="lg">Back to test checkout</ButtonLink>
      </div>
    </>
  );
}

function OrderSummary({ order }: { order: Order }) {
  return (
    <div className="mt-8 w-full rounded-3xl bg-white p-6 text-left ring-1 ring-inset ring-sky-200">
      <p className="font-display text-lg font-bold text-ink">Order {order.id}</p>
      <ul className="mt-3 divide-y divide-sky-100">
        {order.lineItems.map((l) => (
          <li key={l.variantId} className="flex justify-between gap-4 py-2 text-ink">
            <span>
              {l.name} × {l.quantity}
            </span>
            <span className="font-semibold">{usd(l.amountTotal)}</span>
          </li>
        ))}
      </ul>
      <dl className="mt-3 space-y-1 border-t border-sky-100 pt-3 text-ink-soft">
        <div className="flex justify-between"><dt>Subtotal</dt><dd>{usd(order.amounts.subtotal)}</dd></div>
        <div className="flex justify-between"><dt>Shipping</dt><dd>{usd(order.amounts.shipping)}</dd></div>
        <div className="flex justify-between"><dt>Tax</dt><dd>{usd(order.amounts.tax)}</dd></div>
        <div className="flex justify-between font-display text-lg font-bold text-ink"><dt>Total</dt><dd>{usd(order.amounts.total)}</dd></div>
      </dl>
      {order.fulfillments.length > 1 && (
        <p className="mt-3 text-sm text-ink-soft">This order ships in {order.fulfillments.length} packages, each with its own tracking.</p>
      )}
    </div>
  );
}

async function Result({ searchParams }: { searchParams: PageProps<"/checkout/test-result">["searchParams"] }) {
  await connection(); // always per request: payment status must never be prerendered or cached
  const params = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

  if (one(params.canceled) === "1") {
    try {
      await cancelTestCheckout(one(params.checkout));
    } catch {
      // Not fatal: the hold also expires on its own when the Stripe session expires.
    }
    return (
      <Message
        title="Checkout canceled"
        body="No payment was taken and the items you picked have been released. Your test cart is still saved if you want to try again."
      />
    );
  }

  const sessionId = one(params.session_id);
  const config = stripeTestConfig();
  if (!sessionId || !config) {
    return <Message title="Nothing to show" body="We couldn't find a checkout to look up." />;
  }

  let outcome: FulfillOutcome | "error";
  try {
    outcome = await fulfillCheckoutSession(sessionId, await orderDepsFor(config), "landing-page", "landing-page");
  } catch (err) {
    // Stripe says the session doesn't exist → treat as not found, not as an outage.
    outcome = (err as { code?: string })?.code === "resource_missing" ? { state: "invalid" } : "error";
  }

  if (outcome === "error") {
    return (
      <Message
        title="We're still confirming"
        body="We couldn't reach Stripe just now. If your payment went through, it's recorded automatically from Stripe's notification — you don't need to pay again."
      />
    );
  }
  switch (outcome.state) {
    case "paid":
      return (
        <Message
          mood="happy"
          title="Thank you! Test payment confirmed"
          body="Stripe confirmed this test payment. In a real order you'd get a confirmation email now, and tracking once it ships."
        >
          <OrderSummary order={outcome.order} />
          {outcome.order.flags.includes("restricted_destination") && (
            <p role="alert" className="mt-4 rounded-xl bg-berry-soft px-4 py-3 text-ink">
              Flagged for review: we can&apos;t ship to this address yet (U.S. territories aren&apos;t supported). In a real order
              we&apos;d contact you and refund it in full.
            </p>
          )}
          {outcome.order.flags.includes("oversold") && (
            <p role="alert" className="mt-4 rounded-xl bg-berry-soft px-4 py-3 text-ink">
              Flagged for review: an item sold out while this checkout was open. In a real order we&apos;d contact you and refund it.
            </p>
          )}
        </Message>
      );
    case "processing":
      return (
        <Message
          title="Payment processing"
          body="Your bank is still confirming this payment. We'll only prepare the order once Stripe tells us it succeeded."
        >
          <OrderSummary order={outcome.order} />
        </Message>
      );
    case "not_paid":
      return (
        <Message
          title="Payment not completed"
          body="Stripe hasn't confirmed a payment for this checkout, so nothing was charged. You can go back and try again."
        />
      );
    default:
      return <Message title="Checkout not found" body="We couldn't find that checkout. Nothing was charged." />;
  }
}
