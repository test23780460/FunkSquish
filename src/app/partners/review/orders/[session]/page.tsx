import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { reviewConfig } from "@/lib/partners/config";
import { requireReviewer } from "@/lib/partners/review-auth";
import { activeMode, orderDeps } from "@/commerce/checkout/service";
import { getOrder, refundedSoFar } from "@/commerce/orders/admin";
import { formatMoney } from "@/commerce/availability";
import { Container } from "@/components/ui/Primitives";
import { ReviewLogin } from "@/components/partners/ReviewLogin";
import { ArrowLeftIcon } from "@/components/icons/Icons";
import { cancelAction, markShippedAction, refundAction, resendEmailsAction } from "../actions";

export const metadata: Metadata = { title: "Order", robots: { index: false, follow: false } };

// Private, per-request page: no shared instant-navigation shell needed.
export const instant = false;

export default function OrderPage({ params, searchParams }: PageProps<"/partners/review/orders/[session]">) {
  if (!reviewConfig()) notFound();
  return (
    <section className="min-h-screen bg-ice-50 pb-24 pt-28 sm:pt-32">
      <Container className="max-w-4xl">
        <Suspense fallback={<p className="text-ink-soft">Loading…</p>}>
          <Detail params={params} searchParams={searchParams} />
        </Suspense>
      </Container>
    </section>
  );
}

const usd = (cents: number) => formatMoney({ amount: cents, currency: "USD" });
const fmt = (iso: string) => new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" });
const box = "rounded-[2rem] bg-white p-6 ring-1 ring-inset ring-sky-200";
const input = "min-h-11 rounded-xl bg-ice-50 px-3 text-ink ring-2 ring-inset ring-sky-200";
const saved: Record<string, string> = { shipped: "Marked shipped — tracking email handled.", refund: "Refund sent to Stripe.", canceled: "Order canceled.", emails: "Emails retried." };

async function Detail({ params, searchParams }: { params: PageProps<"/partners/review/orders/[session]">["params"]; searchParams: PageProps<"/partners/review/orders/[session]">["searchParams"] }) {
  await connection();
  const ctx = await requireReviewer();
  if (!ctx) return <ReviewLogin />;
  const { session } = await params;
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const mode = activeMode();
  const deps = mode ? await orderDeps(mode) : null;
  const order = deps ? await getOrder(deps.store, session) : null;
  if (!order) return <p className={box}>Order not found. <Link href="/partners/review/orders" className="font-semibold text-royal underline">Back to orders</Link></p>;

  const remaining = order.amounts.total - refundedSoFar(order);
  const a = order.shippingAddress;
  const n = order.notifications;
  const shipped = order.fulfillments.some((f) => f.shippedAt);

  return (
    <div className="space-y-6">
      <Link href="/partners/review/orders" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-4 font-display font-semibold text-ink ring-1 ring-inset ring-sky-200">
        <ArrowLeftIcon className="size-4" /> All orders
      </Link>
      {one(sp.saved) && <p role="status" className="rounded-2xl bg-mint-soft px-4 py-3 font-semibold text-ink">{saved[one(sp.saved)!] ?? "Saved."}</p>}
      {one(sp.error) && <p role="alert" className="rounded-2xl bg-berry-soft px-4 py-3 font-semibold text-ink">{one(sp.error)}</p>}

      <header className={box}>
        <p className="font-display text-sm font-semibold uppercase tracking-[0.12em] text-royal">{order.mode === "live" ? "Live order" : "TEST order"}</p>
        <h1 className="mt-1 font-display text-3xl font-bold text-ink">{order.id}</h1>
        <p className="mt-1 text-ink-soft">
          {fmt(order.createdAt)} · {order.status.replace("_", " ")} · payment {order.paymentStatus.replace("_", " ")}
        </p>
        {order.flags.length > 0 && (
          <ul className="mt-3 space-y-1">
            {order.flags.includes("restricted_destination") && <li className="rounded-xl bg-berry-soft px-3 py-2 text-sm font-semibold text-ink">U.S. territory address — cancel and refund in full (we don&apos;t ship there).</li>}
            {order.flags.includes("oversold") && <li className="rounded-xl bg-berry-soft px-3 py-2 text-sm font-semibold text-ink">Oversold — an item sold out while checkout was open. Contact the customer and refund.</li>}
          </ul>
        )}
      </header>

      <section aria-labelledby="items" className={box}>
        <h2 id="items" className="font-display text-xl font-bold text-ink">Items and payment</h2>
        <ul className="mt-3 divide-y divide-sky-100">
          {order.lineItems.map((l) => (
            <li key={l.variantId} className="flex justify-between gap-4 py-2 text-ink">
              <span>{l.name} × {l.quantity} <span className="text-sm text-ink-soft">({l.sku}{l.fulfillmentSource === "supplier" ? ", supplier-shipped" : ""})</span></span>
              <span className="font-semibold">{usd(l.amountTotal)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-ink-soft">
          Subtotal {usd(order.amounts.subtotal)} · shipping {usd(order.amounts.shipping)} · tax {usd(order.amounts.tax)} · <strong className="text-ink">total {usd(order.amounts.total)}</strong>
          {refundedSoFar(order) ? ` · refunded ${usd(refundedSoFar(order))}` : ""}
        </p>
      </section>

      <section aria-labelledby="customer" className={box}>
        <h2 id="customer" className="font-display text-xl font-bold text-ink">Customer</h2>
        <p className="mt-2 whitespace-pre-line text-ink">
          {[order.customer.name, order.customer.email, order.customer.phone].filter(Boolean).join("\n")}
        </p>
        {a && <p className="mt-2 whitespace-pre-line text-ink">{[a.name, a.line1, a.line2, `${a.city ?? ""}, ${a.state ?? ""} ${a.postalCode ?? ""}`, a.country].filter(Boolean).join("\n")}</p>}
        <p className="mt-2 text-sm text-ink-soft">
          Emails: confirmation {n?.customer?.status ?? "not sent"}{n?.customer?.code ? ` (${n.customer.code})` : ""} · owner alert {n?.owner?.status ?? "not sent"}
        </p>
        <form action={resendEmailsAction} className="mt-2">
          <input type="hidden" name="session" value={order.stripeCheckoutSessionId} />
          <button type="submit" className="rounded-full bg-white px-4 py-2 font-display text-sm font-semibold text-ink ring-1 ring-inset ring-sky-200 hover:bg-ice">Retry failed emails</button>
        </form>
      </section>

      <section aria-labelledby="ship" className={box}>
        <h2 id="ship" className="font-display text-xl font-bold text-ink">Shipping</h2>
        <div className="mt-3 space-y-4">
          {order.fulfillments.map((f) => (
            <div key={f.id} className="rounded-2xl bg-ice-50 p-4">
              <p className="font-semibold text-ink">
                {f.source === "supplier" ? "Supplier package" : "Our package"} · {f.status.replace("_", " ")}
                {f.trackingNumber ? ` · ${f.carrier} ${f.trackingNumber}` : ""}
              </p>
              {f.source === "supplier" && f.status === "awaiting_supplier" && (
                <p className="mt-1 text-sm text-ink-soft">Place this with the supplier yourself — nothing is ordered from suppliers automatically.</p>
              )}
              {order.status !== "canceled" && (order.paymentStatus === "paid" || order.paymentStatus === "partially_refunded") && (
                <form action={markShippedAction} className="mt-3 grid gap-2 sm:grid-cols-[8rem_1fr_1fr_auto] sm:items-end">
                  <input type="hidden" name="session" value={order.stripeCheckoutSessionId} />
                  <input type="hidden" name="group" value={f.id} />
                  <label className="grid gap-1 text-sm font-semibold text-ink">Carrier<input name="carrier" required defaultValue={f.carrier ?? "USPS"} className={input} /></label>
                  <label className="grid gap-1 text-sm font-semibold text-ink">Tracking number<input name="tracking" required defaultValue={f.trackingNumber ?? ""} className={input} /></label>
                  <label className="grid gap-1 text-sm font-semibold text-ink">Tracking link (optional)<input name="trackingUrl" type="url" defaultValue={f.trackingUrl ?? ""} placeholder="https://" className={input} /></label>
                  <button type="submit" className="min-h-11 rounded-full bg-royal px-4 font-display text-sm font-semibold text-white">{f.shippedAt ? "Update" : "Mark shipped"}</button>
                </form>
              )}
            </div>
          ))}
        </div>
      </section>

      {remaining > 0 && order.paymentStatus !== "processing" && (
        <section aria-labelledby="money" className="rounded-[2rem] bg-white p-6 ring-2 ring-inset ring-berry/40">
          <h2 id="money" className="font-display text-xl font-bold text-ink">Refund or cancel</h2>
          <p className="mt-1 text-sm text-ink-soft">Refunds go back to the customer&apos;s card through Stripe. Type the order number to confirm. Up to {usd(remaining)} can still be refunded.</p>
          <form action={refundAction} className="mt-3 flex flex-wrap items-end gap-3">
            <input type="hidden" name="session" value={order.stripeCheckoutSessionId} />
            <label className="grid gap-1 text-sm font-semibold text-ink">Amount (USD)<input name="amount" inputMode="decimal" required placeholder={(remaining / 100).toFixed(2)} className={input} /></label>
            <label className="grid gap-1 text-sm font-semibold text-ink">Order number<input name="confirm" autoComplete="off" required placeholder={order.id} className={`${input} font-mono`} /></label>
            <button type="submit" className="min-h-11 rounded-full bg-[#b8215a] px-5 font-display font-semibold text-white">Refund</button>
          </form>
          {!shipped && order.status !== "canceled" && (
            <form action={cancelAction} className="mt-4 flex flex-wrap items-end gap-3">
              <input type="hidden" name="session" value={order.stripeCheckoutSessionId} />
              <label className="grid gap-1 text-sm font-semibold text-ink">Order number<input name="confirm" autoComplete="off" required placeholder={order.id} className={`${input} font-mono`} /></label>
              <button type="submit" className="min-h-11 rounded-full bg-white px-5 font-display font-semibold text-[#b8215a] ring-2 ring-inset ring-[#b8215a]">Cancel order (refund all, return stock)</button>
            </form>
          )}
        </section>
      )}

      <details className={box}>
        <summary className="cursor-pointer font-semibold text-royal">History</summary>
        <ul className="mt-2 space-y-1 text-sm text-ink-soft">
          {order.history.map((h, i) => (
            <li key={i}>{fmt(h.at)}: {h.type} ({h.source})</li>
          ))}
          {order.refunds.map((r, i) => (
            <li key={`r${i}`}>{fmt(r.createdAt)}: refund {usd(r.amount)}{r.stripeRefundId ? ` (${r.stripeRefundId})` : ""}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}
