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
import { ReviewLogin } from "@/components/partners/ReviewLogin";
import { ArrowLeftIcon } from "@/components/icons/Icons";
import { OwnerNav } from "@/components/owner/OwnerNav";
import { Callout, Empty, Flash, OwnerShell, Pill, button, card, danger, input as field, label as labelCls, one, panel, primary, secondary, small, type PillTone } from "@/components/owner/OwnerUi";
import { cn } from "@/components/owner/cn";
import { SupplierPackagePanel } from "@/components/owner/SupplierPackagePanel";
import { ownerDataStore } from "@/lib/owner/data";
import { listSuppliers } from "@/commerce/suppliers/supplier";
import { listRecords } from "@/commerce/catalog-admin/store";
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
    <OwnerShell>
      <Detail params={params} searchParams={searchParams} />
    </OwnerShell>
  );
}

const usd = (cents: number) => formatMoney({ amount: cents, currency: "USD" });
const fmt = (iso: string) => new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" });
const box = card;
const input = field;
const lbl = labelCls;
const h2 = "font-display text-lg font-bold leading-snug text-ink sm:text-xl";
const words = (s: string) => s.replaceAll("_", " ");
const ORDER_TONE: Record<string, PillTone> = { open: "info", awaiting_payment: "warn", partially_fulfilled: "warn", fulfilled: "good", canceled: "plain" };
const PKG_TONE: Record<string, PillTone> = { shipped: "good", delivered: "good", canceled: "plain", lost: "alert", returned: "alert", awaiting_supplier: "warn", unfulfilled: "info" };
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
  supplier: "Supplier order saved.",
};
const canShip = (status: string) => !["canceled", "lost", "returned"].includes(status);
const notShipped = (status: string) => !["shipped", "delivered", "canceled", "lost", "returned"].includes(status);

async function Detail({ params, searchParams }: { params: PageProps<"/partners/review/orders/[session]">["params"]; searchParams: PageProps<"/partners/review/orders/[session]">["searchParams"] }) {
  await connection();
  const ctx = await requireReviewer();
  if (!ctx) return <ReviewLogin />;
  const { session } = await params;
  const sp = await searchParams;
  const mode = activeMode();
  const deps = mode ? await orderDeps(mode) : null;
  const order = deps ? await getOrder(deps.store, session) : null;
  if (!order)
    return (
      <div>
        <OwnerNav current="/partners/review/orders" />
        <Empty title="Order not found" action={<Link href="/partners/review/orders" className={cn(secondary, small)}>Back to orders</Link>}>
          It may belong to the other Stripe mode, or the link is incomplete.
        </Empty>
      </div>
    );

  const remaining = order.amounts.total - refundedSoFar(order);
  const a = order.shippingAddress;
  const n = order.notifications;
  const shipped = order.fulfillments.some((f) => f.shippedAt);
  const attention = orderAttention(order);
  const data = await ownerDataStore(ctx.cfg);
  const [suppliers, records] = order.fulfillments.some((f) => f.source === "supplier") ? await Promise.all([listSuppliers(data), listRecords(data)]) : [[], []];
  /** The supplier linked to a package's items in Products (first match), to preselect. */
  const suggestedSupplier = (variantIds: string[]) => {
    for (const r of records) for (const id of variantIds) if (r.private.variants[id]?.supplierId) return r.private.variants[id].supplierId;
    return null;
  };

  return (
    <div>
      <OwnerNav current="/partners/review/orders" />
      <Link href="/partners/review/orders" className={cn("-ml-1 mb-3 inline-flex min-h-11 items-center gap-2 rounded-full px-2 text-sm font-semibold text-royal hover:underline", "focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-royal")}>
        <ArrowLeftIcon className="size-4" /> All orders
      </Link>
      <Flash ok={one(sp.saved) ? (saved[one(sp.saved)!] ?? "Saved.") : null} error={one(sp.error)} />

      <header className="mb-6">
        <p className="mb-1 font-display text-xs font-semibold uppercase tracking-[0.14em] text-royal">{order.mode === "live" ? "Live order" : "TEST order"}</p>
        <h1 className="font-display text-[1.85rem] font-bold leading-tight text-ink sm:text-[2.25rem]">{order.id}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-sm text-ink-soft">
          <Pill tone={ORDER_TONE[order.status] ?? "plain"}>{words(order.status)}</Pill>
          <Pill tone={order.paymentStatus === "paid" ? "good" : "warn"}>payment {words(order.paymentStatus)}</Pill>
          <span className="ml-1">{fmt(order.createdAt)}</span>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <div className="space-y-5">
      {(attention.length > 0 || (signatureRecommended(order.amounts.total) && order.status !== "canceled")) && (
        <div className="space-y-3">
          {attention.length > 0 && (
            <Callout tone="alert" title="Needs your attention">
              <ul className="list-disc space-y-0.5 pl-4">
                {attention.map((x, i) => (
                  <li key={i}>{x.label}</li>
                ))}
              </ul>
            </Callout>
          )}
          {signatureRecommended(order.amounts.total) && order.status !== "canceled" && (
            <Callout tone="warn">
              Order is {usd(SIGNATURE_POLICY.recommendAtOrAboveCents)} or more: consider adding signature confirmation when you buy the label. It&apos;s your cost — never charge the customer for it.
            </Callout>
          )}
        </div>
      )}

      <section aria-labelledby="ship" className={box}>
        <h2 id="ship" className={h2}>Packages</h2>
        <p className="mt-1 text-sm text-ink-soft">Each package has its own ship-by date, tracking and email. The customer paid {usd(order.amounts.shipping)} shipping in total at checkout.</p>
        <div className="mt-3 space-y-4">
          {order.fulfillments.map((f) => {
            const money = packageAmounts(order, f.id);
            const items = order.lineItems.filter((l) => f.variantIds.includes(l.variantId));
            const open = order.status !== "canceled";
            return (
            <div key={f.id} id={`pkg-${f.id}`} className={cn(panel, "scroll-mt-2")}>
              <p className="flex flex-wrap items-center gap-2 font-display font-semibold text-ink">
                {packageLabel(order, f.id)}
                <Pill tone={PKG_TONE[f.status] ?? "plain"}>{words(f.status)}</Pill>
                {f.trackingNumber ? <span className="font-sans text-sm font-normal text-ink-soft">{f.carrier} <span className="font-mono">{f.trackingNumber}</span></span> : null}
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
              {f.source === "supplier" && <SupplierPackagePanel order={order} group={f} suppliers={suppliers.filter((x) => !x.archived)} suggested={suggestedSupplier(f.variantIds)} />}
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
                  <label className={lbl}>Ship-by date (from the product&apos;s stated processing time)<input name="shipBy" type="date" required className={input} /></label>
                  <button type="submit" className={cn(secondary, small)}>Save</button>
                </form>
              )}
              {!f.shippedAt && open && notShipped(f.status) && f.shipBy && (
                <details className="mt-2">
                  <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold text-royal">Can&apos;t ship by {f.shipBy}? Send a delay notice</summary>
                  <form action={delayNoticeAction} className="mt-2 grid gap-2 rounded-xl bg-white p-3 ring-1 ring-inset ring-sky-100">
                    <input type="hidden" name="session" value={order.stripeCheckoutSessionId} />
                    <input type="hidden" name="group" value={f.id} />
                    <p className="text-sm text-ink-soft">Send it <strong>before</strong> the ship-by date. The email offers a free cancel-and-refund for this package. Over 30 days late, no date, or a second delay: the customer must say yes, or you cancel and refund.</p>
                    <label className={lbl}>New ship-by date<input name="newShipBy" type="date" className={input} /></label>
                    <label className="flex items-center gap-2 text-sm text-ink"><input type="checkbox" className="size-4 accent-royal" name="unknown" value="yes" /> We can&apos;t give a date yet</label>
                    <button type="submit" className={cn(primary, small, "justify-self-start")}>Email delay notice</button>
                  </form>
                </details>
              )}
              {open && canShip(f.status) && (order.paymentStatus === "paid" || order.paymentStatus === "partially_refunded") && (
                <form action={markShippedAction} className="mt-3 grid gap-2 sm:grid-cols-[8rem_1fr_1fr_auto] sm:items-end">
                  <input type="hidden" name="session" value={order.stripeCheckoutSessionId} />
                  <input type="hidden" name="group" value={f.id} />
                  <label className={lbl}>Carrier<input name="carrier" required defaultValue={f.carrier ?? "USPS"} className={input} /></label>
                  <label className={lbl}>Tracking number<input name="tracking" required defaultValue={f.trackingNumber ?? ""} className={input} /></label>
                  <label className={lbl}>Tracking link (optional)<input name="trackingUrl" type="url" defaultValue={f.trackingUrl ?? ""} placeholder="https://" className={input} /></label>
                  <button type="submit" className={primary}>{f.shippedAt ? "Update" : "Mark shipped"}</button>
                </form>
              )}
              {open && notShipped(f.status) && money && order.fulfillments.length > 1 && (
                <details className="mt-3">
                  <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold text-[#a3174f]">Cancel just this package (refund {usd(money.refundable)})</summary>
                  <form action={cancelPackageAction} className="mt-2 grid gap-2 rounded-xl bg-white p-3 ring-1 ring-inset ring-sky-100">
                    <input type="hidden" name="session" value={order.stripeCheckoutSessionId} />
                    <input type="hidden" name="group" value={f.id} />
                    <p className="text-sm text-ink-soft">Refunds this package&apos;s items, its shipping and tax, and puts its stock back. The other packages carry on.</p>
                    {f.status === "sent_to_supplier" && (
                      <label className="flex items-center gap-2 text-sm text-ink"><input type="checkbox" className="size-4 accent-royal" name="supplierCanceled" value="yes" /> I&apos;ve canceled it with the supplier</label>
                    )}
                    <label className={lbl}>Order number<input name="confirm" autoComplete="off" required placeholder={order.id} className={cn(input, "font-mono")} /></label>
                    <button type="submit" className={cn(danger, small, "justify-self-start")}>Cancel package</button>
                  </form>
                </details>
              )}
              {f.status === "shipped" && open && (
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <form action={markLostAction}>
                    <input type="hidden" name="session" value={order.stripeCheckoutSessionId} />
                    <input type="hidden" name="group" value={f.id} />
                    <button type="submit" className={cn(secondary, small)}>Carrier confirmed it lost</button>
                  </form>
                  <form action={markReturnedAction} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="session" value={order.stripeCheckoutSessionId} />
                    <input type="hidden" name="group" value={f.id} />
                    <label className={lbl}>
                      It came back to us because…
                      <select name="cause" required className={input} defaultValue="">
                        <option value="" disabled>Choose</option>
                        {Object.entries(RETURN_CAUSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </label>
                    <button type="submit" className={cn(secondary, small)}>Record return</button>
                  </form>
                </div>
              )}
              {(f.status === "lost" || f.status === "returned") && !f.resolution && (
                <div className="mt-3 grid gap-2 rounded-xl bg-white p-3 ring-1 ring-inset ring-sky-100">
                  <p className="text-sm text-ink">
                    {f.status === "lost" ? "Lost in transit:" : "Came back undeliverable:"} send a free replacement, or refund this package in full.
                    {f.status === "returned" && f.returnCause === "address" && " The address was wrong at checkout — a refund is the default; reship only if the customer gives a corrected address."}
                  </p>
                  <form action={reshipAction}>
                    <input type="hidden" name="session" value={order.stripeCheckoutSessionId} />
                    <input type="hidden" name="group" value={f.id} />
                    <button type="submit" className={primary}>Send a free replacement</button>
                  </form>
                  {money && money.refundable > 0 && (
                    <form action={refundPackageAction} className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="session" value={order.stripeCheckoutSessionId} />
                      <input type="hidden" name="group" value={f.id} />
                      <label className={lbl}>Order number<input name="confirm" autoComplete="off" required placeholder={order.id} className={cn(input, "font-mono")} /></label>
                      <button type="submit" className={cn(button, "bg-[#a3174f] text-white hover:brightness-110")}>Refund package ({usd(money.refundable)})</button>
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
          <h2 id="disputes" className={h2}>Card disputes</h2>
          <p className="mt-1 text-sm text-ink-soft">Respond in the Stripe Dashboard before the deadline with the order, delivery tracking and your messages with the customer (see docs/COMPLIANCE-LAUNCH-GATES.md, chargeback evidence).</p>
          <ul className="mt-3 space-y-2 text-sm text-ink">
            {order.disputes!.map((d) => (
              <li key={d.stripeDisputeId} className={panel}>{d.stripeDisputeId}: {usd(d.amount)} · {d.reason ?? "no reason"} · <strong>{d.status.replaceAll("_", " ")}</strong>{d.evidenceDueBy ? ` · evidence due ${fmt(d.evidenceDueBy)}` : ""}{d.needsCheck ? " · Stripe sent conflicting updates: check this dispute in Stripe" : ""}</li>
            ))}
          </ul>
        </section>
      )}

      {remaining > 0 && order.paymentStatus !== "processing" && (
        <section aria-labelledby="money" className={cn(box, "ring-2 ring-[#f2b9cd]")}>
          <h2 id="money" className={h2}>Refund or cancel</h2>
          <p className="mt-1 text-sm text-ink-soft">Refunds go back to the customer&apos;s card through Stripe. Type the order number to confirm. Up to {usd(remaining)} can still be refunded.</p>
          <form action={refundAction} className="mt-3 flex flex-wrap items-end gap-3">
            <input type="hidden" name="session" value={order.stripeCheckoutSessionId} />
            <label className={lbl}>Amount (USD)<input name="amount" inputMode="decimal" required placeholder={(remaining / 100).toFixed(2)} className={input} /></label>
            <label className={lbl}>Order number<input name="confirm" autoComplete="off" required placeholder={order.id} className={cn(input, "font-mono")} /></label>
            <button type="submit" className={cn(button, "bg-[#a3174f] text-white hover:brightness-110")}>Refund</button>
          </form>
          {!shipped && order.status !== "canceled" && (
            <form action={cancelAction} className="mt-4 flex flex-wrap items-end gap-3 border-t border-sky-100 pt-4">
              <input type="hidden" name="session" value={order.stripeCheckoutSessionId} />
              <label className={lbl}>Order number<input name="confirm" autoComplete="off" required placeholder={order.id} className={cn(input, "font-mono")} /></label>
              <button type="submit" className={danger}>Cancel order (refund all, return stock)</button>
            </form>
          )}
        </section>
      )}

      <details className={box}>
        <summary className="cursor-pointer font-display font-semibold text-ink">History</summary>
        <ul className="mt-3 space-y-1.5 border-t border-sky-100 pt-3 text-sm text-ink-soft">
          {order.history.map((h, i) => (
            <li key={i}>{fmt(h.at)}: {h.type} ({h.source})</li>
          ))}
          {order.refunds.map((r, i) => (
            <li key={`r${i}`}>{fmt(r.createdAt)}: refund {usd(r.amount)}{r.stripeRefundId ? ` (${r.stripeRefundId})` : ""}</li>
          ))}
        </ul>
      </details>
      </div>
      <aside aria-label="Order summary" className="space-y-5 lg:sticky lg:top-24 lg:order-last">
      <section aria-labelledby="items" className={box}>
        <h2 id="items" className={h2}>Items and payment</h2>
        <ul className="mt-3 divide-y divide-sky-100 text-sm">
          {order.lineItems.map((l) => (
            <li key={l.variantId} className="flex justify-between gap-4 py-2.5 text-ink">
              <span className="min-w-0">
                <span className="block font-semibold">{l.name} × {l.quantity}</span>
                <span className="block text-xs text-ink-soft">{l.sku}{l.fulfillmentSource === "supplier" ? " · supplier-shipped" : ""}</span>
              </span>
              <span className="font-semibold tabular-nums">{usd(l.amountTotal)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 border-t border-sky-100 pt-3 text-sm text-ink-soft">
          <dt>Subtotal</dt><dd className="text-right tabular-nums">{usd(order.amounts.subtotal)}</dd>
          <dt>Shipping</dt><dd className="text-right tabular-nums">{usd(order.amounts.shipping)}</dd>
          <dt>Tax</dt><dd className="text-right tabular-nums">{usd(order.amounts.tax)}</dd>
          <dt className="font-bold text-ink">Total</dt><dd className="text-right font-bold text-ink tabular-nums">{usd(order.amounts.total)}</dd>
          {refundedSoFar(order) ? (
            <>
              <dt className="text-[#a3174f]">Refunded</dt><dd className="text-right font-semibold text-[#a3174f] tabular-nums">{usd(refundedSoFar(order))}</dd>
            </>
          ) : null}
        </dl>
      </section>

      <section aria-labelledby="customer" className={box}>
        <h2 id="customer" className={h2}>Customer</h2>
        <p className="mt-2 whitespace-pre-line break-words text-sm text-ink">
          {[order.customer.name, order.customer.email, order.customer.phone].filter(Boolean).join("\n")}
        </p>
        {a && <p className="mt-3 whitespace-pre-line border-t border-sky-100 pt-3 text-sm text-ink"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-soft">Ship to</span>{[a.name, a.line1, a.line2, `${a.city ?? ""}, ${a.state ?? ""} ${a.postalCode ?? ""}`, a.country].filter(Boolean).join("\n")}</p>}
        <p className="mt-3 border-t border-sky-100 pt-3 text-sm text-ink-soft">
          Emails: confirmation {n?.customer?.status ?? "not sent"}{n?.customer?.code ? ` (${n.customer.code})` : ""} · owner alert {n?.owner?.status ?? "not sent"}
        </p>
        <form action={resendEmailsAction} className="mt-3">
          <input type="hidden" name="session" value={order.stripeCheckoutSessionId} />
          <button type="submit" className={cn(secondary, small)}>Retry failed emails</button>
        </form>
        <p className="mt-3 text-xs text-ink-soft">Policies shown at checkout: {order.policyVersions ?? "not recorded (order placed before versions were recorded)"}</p>
      </section>

      </aside>
      </div>
    </div>
  );
}
