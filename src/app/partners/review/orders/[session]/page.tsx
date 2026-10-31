import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { reviewConfig } from "@/lib/partners/config";
import { requireReviewer } from "@/lib/partners/review-auth";
import { activeMode, orderDeps } from "@/commerce/checkout/service";
import { RETURN_CAUSES, getOrder, orderAttention, packageAmounts, refundedSoFar } from "@/commerce/orders/admin";
import { packageLabel } from "@/commerce/orders/notify";
import { signatureRecommended, SIGNATURE_POLICY } from "@/commerce/signature";
import { formatMoney } from "@/commerce/availability";
import { Container } from "@/components/ui/Primitives";
import { ReviewLogin } from "@/components/partners/ReviewLogin";
import { ArrowLeftIcon } from "@/components/icons/Icons";
import { OwnerNav } from "@/components/owner/OwnerNav";
import {
  cancelAction,
  cancelPackageAction,
  delayNoticeAction,
  markLostAction,
  markReturnedAction,
  markShippedAction,
  refundAction,
  refundPackageAction,
  resendEmailsAction,
  reshipAction,
  setShipByAction,
} from "../actions";

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
const saved: Record<string, string> = {
  shipped: "Marked shipped — tracking email handled.",
  refund: "Refund sent to Stripe.",
  canceled: "Order canceled.",
  emails: "Emails retried.",
  "ship-by": "Ship-by date saved.",
  delay: "Delay notice recorded.",
  "package-canceled": "Package canceled — refunded in full and its stock returned.",
  "package-refund": "Package refunded in full (items, its shipping and tax).",
  lost: "Package marked lost. Send a replacement or refund it.",
  returned: "Return recorded. Refund or reship before the deadline shown.",
  reship: "Replacement started — ship it and add the new tracking number.",
};
const canShip = (status: string) => !["canceled", "lost", "returned"].includes(status);
const notShipped = (status: string) => !["shipped", "delivered", "canceled", "lost", "returned"].includes(status);

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
  const attention = orderAttention(order);

  return (
    <div className="space-y-6">
      <OwnerNav current="/partners/review/orders" />
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
        {attention.length > 0 && (
          <ul className="mt-3 space-y-1" aria-label="Needs your attention">
            {attention.map((x, i) => (
              <li key={i} className="rounded-xl bg-berry-soft px-3 py-2 text-sm font-semibold text-ink">{x.label}</li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-sm text-ink-soft">Policies shown at checkout: {order.policyVersions ?? "not recorded (order placed before versions were recorded)"}</p>
        {signatureRecommended(order.amounts.total) && order.status !== "canceled" && (
          <p className="mt-2 rounded-xl bg-lemon-soft px-3 py-2 text-sm text-ink">
            Order is {usd(SIGNATURE_POLICY.recommendAtOrAboveCents)} or more: consider adding signature confirmation when you buy the label. It&apos;s your cost — never charge the customer for it.
          </p>
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
        <h2 id="ship" className="font-display text-xl font-bold text-ink">Packages</h2>
        <p className="mt-1 text-sm text-ink-soft">Each package has its own ship-by date, tracking and email. The customer paid {usd(order.amounts.shipping)} shipping in total at checkout.</p>
        <div className="mt-3 space-y-4">
          {order.fulfillments.map((f) => {
            const money = packageAmounts(order, f.id);
            const items = order.lineItems.filter((l) => f.variantIds.includes(l.variantId));
            const open = order.status !== "canceled";
            return (
            <div key={f.id} className="rounded-2xl bg-ice-50 p-4">
              <p className="font-semibold text-ink">
                {packageLabel(order, f.id)} · <span className="uppercase tracking-wide">{f.status.replace("_", " ")}</span>
                {f.trackingNumber ? ` · ${f.carrier} ${f.trackingNumber}` : ""}
              </p>
              <p className="mt-1 text-sm text-ink-soft">
                {items.map((l) => `${l.name} × ${l.quantity}`).join(", ")}
                {f.origin ? ` · ships from ${f.origin}` : ""}
              </p>
              {money && (
                <p className="mt-1 text-sm text-ink">
                  Shipping charged {usd(money.shipping)} · package total {usd(money.total)}
                  {money.refunded ? ` · refunded ${usd(money.refunded)}` : ""}
                </p>
              )}
              {f.militaryAddresses === false && <p className="mt-1 text-sm text-ink-soft">This origin can&apos;t ship to APO/FPO/DPO addresses.</p>}
              {f.source === "supplier" && f.status === "awaiting_supplier" && (
                <p className="mt-1 text-sm text-ink-soft">Place this with the supplier yourself — nothing is ordered from suppliers automatically.</p>
              )}
              <p className="mt-1 text-sm text-ink">
                Ship by: <strong>{f.shipBy ?? "not set"}</strong>
                {(f.delayNotices?.length ?? 0) > 0 && ` · ${f.delayNotices!.length} delay notice(s), last ${fmt(f.delayNotices!.at(-1)!.at)} (${f.delayNotices!.at(-1)!.email})`}
              </p>
              {(f.previousShipments?.length ?? 0) > 0 && (
                <p className="mt-1 text-sm text-ink-soft">
                  Earlier: {f.previousShipments!.map((x) => `${x.carrier ?? ""} ${x.trackingNumber ?? ""} (${x.outcome})`).join("; ")}
                </p>
              )}
              {!f.shippedAt && open && notShipped(f.status) && !f.shipBy && (
                <form action={setShipByAction} className="mt-2 flex flex-wrap items-end gap-2">
                  <input type="hidden" name="session" value={order.stripeCheckoutSessionId} />
                  <input type="hidden" name="group" value={f.id} />
                  <label className="grid gap-1 text-sm font-semibold text-ink">Ship-by date (from the product&apos;s stated processing time)<input name="shipBy" type="date" required className={input} /></label>
                  <button type="submit" className="min-h-11 rounded-full bg-white px-4 font-display text-sm font-semibold text-ink ring-1 ring-inset ring-sky-200">Save</button>
                </form>
              )}
              {!f.shippedAt && open && notShipped(f.status) && f.shipBy && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm font-semibold text-royal">Can&apos;t ship by {f.shipBy}? Send a delay notice</summary>
                  <form action={delayNoticeAction} className="mt-2 grid gap-2 rounded-xl bg-white p-3">
                    <input type="hidden" name="session" value={order.stripeCheckoutSessionId} />
                    <input type="hidden" name="group" value={f.id} />
                    <p className="text-sm text-ink-soft">Send it <strong>before</strong> the ship-by date. The email offers a free cancel-and-refund for this package. Over 30 days late, no date, or a second delay: the customer must say yes, or you cancel and refund.</p>
                    <label className="grid gap-1 text-sm font-semibold text-ink">New ship-by date<input name="newShipBy" type="date" className={input} /></label>
                    <label className="flex items-center gap-2 text-sm text-ink"><input type="checkbox" name="unknown" value="yes" /> We can&apos;t give a date yet</label>
                    <button type="submit" className="justify-self-start rounded-full bg-royal px-4 py-2 font-display text-sm font-semibold text-white">Email delay notice</button>
                  </form>
                </details>
              )}
              {open && canShip(f.status) && (order.paymentStatus === "paid" || order.paymentStatus === "partially_refunded") && (
                <form action={markShippedAction} className="mt-3 grid gap-2 sm:grid-cols-[8rem_1fr_1fr_auto] sm:items-end">
                  <input type="hidden" name="session" value={order.stripeCheckoutSessionId} />
                  <input type="hidden" name="group" value={f.id} />
                  <label className="grid gap-1 text-sm font-semibold text-ink">Carrier<input name="carrier" required defaultValue={f.carrier ?? "USPS"} className={input} /></label>
                  <label className="grid gap-1 text-sm font-semibold text-ink">Tracking number<input name="tracking" required defaultValue={f.trackingNumber ?? ""} className={input} /></label>
                  <label className="grid gap-1 text-sm font-semibold text-ink">Tracking link (optional)<input name="trackingUrl" type="url" defaultValue={f.trackingUrl ?? ""} placeholder="https://" className={input} /></label>
                  <button type="submit" className="min-h-11 rounded-full bg-royal px-4 font-display text-sm font-semibold text-white">{f.shippedAt ? "Update" : "Mark shipped"}</button>
                </form>
              )}
              {open && notShipped(f.status) && money && order.fulfillments.length > 1 && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm font-semibold text-[#b8215a]">Cancel just this package (refund {usd(money.refundable)})</summary>
                  <form action={cancelPackageAction} className="mt-2 grid gap-2 rounded-xl bg-white p-3">
                    <input type="hidden" name="session" value={order.stripeCheckoutSessionId} />
                    <input type="hidden" name="group" value={f.id} />
                    <p className="text-sm text-ink-soft">Refunds this package&apos;s items, its shipping and tax, and puts its stock back. The other packages carry on.</p>
                    {f.status === "sent_to_supplier" && (
                      <label className="flex items-center gap-2 text-sm text-ink"><input type="checkbox" name="supplierCanceled" value="yes" /> I&apos;ve canceled it with the supplier</label>
                    )}
                    <label className="grid gap-1 text-sm font-semibold text-ink">Order number<input name="confirm" autoComplete="off" required placeholder={order.id} className={`${input} font-mono`} /></label>
                    <button type="submit" className="justify-self-start rounded-full bg-white px-4 py-2 font-display text-sm font-semibold text-[#b8215a] ring-2 ring-inset ring-[#b8215a]">Cancel package</button>
                  </form>
                </details>
              )}
              {f.status === "shipped" && open && (
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <form action={markLostAction}>
                    <input type="hidden" name="session" value={order.stripeCheckoutSessionId} />
                    <input type="hidden" name="group" value={f.id} />
                    <button type="submit" className="min-h-11 rounded-full bg-white px-4 font-display text-sm font-semibold text-ink ring-1 ring-inset ring-sky-200">Carrier confirmed it lost</button>
                  </form>
                  <form action={markReturnedAction} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="session" value={order.stripeCheckoutSessionId} />
                    <input type="hidden" name="group" value={f.id} />
                    <label className="grid gap-1 text-sm font-semibold text-ink">
                      It came back to us because…
                      <select name="cause" required className={input} defaultValue="">
                        <option value="" disabled>Choose</option>
                        {Object.entries(RETURN_CAUSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </label>
                    <button type="submit" className="min-h-11 rounded-full bg-white px-4 font-display text-sm font-semibold text-ink ring-1 ring-inset ring-sky-200">Record return</button>
                  </form>
                </div>
              )}
              {(f.status === "lost" || f.status === "returned") && !f.resolution && (
                <div className="mt-3 grid gap-2 rounded-xl bg-white p-3">
                  <p className="text-sm text-ink">
                    {f.status === "lost" ? "Lost in transit:" : "Came back undeliverable:"} send a free replacement, or refund this package in full.
                    {f.status === "returned" && f.returnCause === "address" && " The address was wrong at checkout — a refund is the default; reship only if the customer gives a corrected address."}
                  </p>
                  <form action={reshipAction}>
                    <input type="hidden" name="session" value={order.stripeCheckoutSessionId} />
                    <input type="hidden" name="group" value={f.id} />
                    <button type="submit" className="min-h-11 rounded-full bg-royal px-4 font-display text-sm font-semibold text-white">Send a free replacement</button>
                  </form>
                  {money && money.refundable > 0 && (
                    <form action={refundPackageAction} className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="session" value={order.stripeCheckoutSessionId} />
                      <input type="hidden" name="group" value={f.id} />
                      <label className="grid gap-1 text-sm font-semibold text-ink">Order number<input name="confirm" autoComplete="off" required placeholder={order.id} className={`${input} font-mono`} /></label>
                      <button type="submit" className="min-h-11 rounded-full bg-[#b8215a] px-4 font-display text-sm font-semibold text-white">Refund package ({usd(money.refundable)})</button>
                    </form>
                  )}
                </div>
              )}
            </div>
            );
          })}
        </div>
      </section>

      {(order.disputes?.length ?? 0) > 0 && (
        <section aria-labelledby="disputes" className={box}>
          <h2 id="disputes" className="font-display text-xl font-bold text-ink">Card disputes</h2>
          <p className="mt-1 text-sm text-ink-soft">Respond in the Stripe Dashboard before the deadline with the order, delivery tracking and your messages with the customer (see docs/COMPLIANCE-LAUNCH-GATES.md, chargeback evidence).</p>
          <ul className="mt-2 space-y-1 text-ink">
            {order.disputes!.map((d) => (
              <li key={d.stripeDisputeId}>{d.stripeDisputeId}: {usd(d.amount)} · {d.reason ?? "no reason"} · <strong>{d.status.replaceAll("_", " ")}</strong>{d.evidenceDueBy ? ` · evidence due ${fmt(d.evidenceDueBy)}` : ""}{d.needsCheck ? " · Stripe sent conflicting updates: check this dispute in Stripe" : ""}</li>
            ))}
          </ul>
        </section>
      )}

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
