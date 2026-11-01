import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { reviewConfig } from "@/lib/partners/config";
import { requireReviewer } from "@/lib/partners/review-auth";
import { activeMode, orderDeps } from "@/commerce/checkout/service";
import { listOrders, orderAttention, refundedSoFar } from "@/commerce/orders/admin";
import { formatMoney } from "@/commerce/availability";
import { ReviewLogin } from "@/components/partners/ReviewLogin";
import { OwnerNav } from "@/components/owner/OwnerNav";
import { cn } from "@/components/owner/cn";
import { Chips, Empty, Flash, OwnerShell, PageTitle, Pill, SearchBar, card, dateTime, one, secondary, small, type PillTone } from "@/components/owner/OwnerUi";
import { reconcileAction } from "./actions";
import { SHIPPING_ORIGINS } from "@/commerce/origins";
import { SHIPPING_LOCK_TEXT, shippingApprovalStatus } from "@/commerce/shipping-approval";

export const metadata: Metadata = { title: "Orders", robots: { index: false, follow: false } };

/** PRIVATE owner area: orders for whichever Stripe mode is open here. */
export default function OrdersPage({ searchParams }: PageProps<"/partners/review/orders">) {
  if (!reviewConfig()) notFound();
  return (
    <OwnerShell>
      <Orders searchParams={searchParams} />
    </OwnerShell>
  );
}

const usd = (cents: number) => formatMoney({ amount: cents, currency: "USD" });
const STATUS: Record<string, { label: string; tone: PillTone }> = {
  open: { label: "Paid · to fulfill", tone: "info" },
  awaiting_payment: { label: "Awaiting payment", tone: "warn" },
  partially_fulfilled: { label: "Partly fulfilled", tone: "warn" },
  fulfilled: { label: "Fulfilled", tone: "good" },
  canceled: { label: "Canceled", tone: "plain" },
};
const words = (code: string) => code.replaceAll("_", " ").replaceAll("-", " ");

async function Orders({ searchParams }: { searchParams: PageProps<"/partners/review/orders">["searchParams"] }) {
  await connection();
  const ctx = await requireReviewer();
  if (!ctx) return <ReviewLogin />;
  const sp = await searchParams;
  const mode = activeMode();
  const deps = mode ? await orderDeps(mode) : null;
  const orders = deps ? await listOrders(deps.store) : [];
  const reconciled = one(sp.reconciled)?.split("-");
  const q = (one(sp.q) ?? "").trim().toLowerCase().slice(0, 80);
  const f = one(sp.f) ?? "all";
  const FILTERS: Record<string, { label: string; test: (o: (typeof orders)[number]) => boolean }> = {
    all: { label: "All", test: () => true },
    attention: { label: "Needs attention", test: (o) => orderAttention(o).length > 0 },
    open: { label: "To ship", test: (o) => o.status === "open" || o.status === "partially_fulfilled" },
    supplier: { label: "Supplier packages", test: (o) => o.fulfillments.some((g) => g.source === "supplier" && !["shipped", "delivered", "canceled"].includes(g.status)) },
    refunded: { label: "Refunded", test: (o) => refundedSoFar(o) > 0 },
    disputed: { label: "Disputed", test: (o) => (o.disputes ?? []).length > 0 },
    canceled: { label: "Canceled", test: (o) => o.status === "canceled" },
  };
  const filter = FILTERS[f] ? f : "all";
  const matches = (o: (typeof orders)[number]) =>
    !q ||
    [o.id, o.customer.email, o.customer.name, o.shippingAddress?.name, ...o.lineItems.map((l) => l.sku), ...o.fulfillments.map((g) => g.trackingNumber ?? ""), ...o.fulfillments.map((g) => g.supplierRef ?? "")]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q));
  const shown = orders.filter((o) => FILTERS[filter].test(o) && matches(o));
  const error = one(sp.error);

  return (
    <div>
      <OwnerNav current="/partners/review/orders" />
      <PageTitle
        title="Orders"
        meta={mode === "live" ? <Pill tone="alert">LIVE · real money</Pill> : mode === "test" ? <Pill tone="info">Stripe TEST mode · no real money</Pill> : <Pill>Checkout switched off here</Pill>}
        lead={mode ? "Every paid checkout, newest first. Open an order to ship it, add tracking, refund or answer a dispute." : "Checkout isn't switched on here, so there are no orders to show."}
        actions={
          <>
            <Link href="/partners/review/orders/emails" className={cn(secondary, small)}>
              Customer email previews
            </Link>
            {deps && (
              <form action={reconcileAction}>
                <button type="submit" className={cn(secondary, small)} title="Looks for paid checkouts from the last 3 days that never reached this list">
                  Check Stripe for missed orders (last 3 days)
                </button>
              </form>
            )}
          </>
        }
      />
      <Flash
        ok={reconciled ? `Checked ${reconciled[0]} paid checkout(s) in Stripe; ${reconciled[1]} missing order(s) recorded.` : null}
        error={error ? (error === "closed" ? "Checkout isn't switched on here." : error) : null}
      />
      {mode !== "test" && <LiveShippingApproval />}

      {orders.length > 0 && (
        <div className="mb-4 space-y-3">
          <SearchBar action="/partners/review/orders" value={q} label="Search orders" placeholder="Order number, customer, SKU, tracking or supplier ref" hidden={filter !== "all" ? { f: filter } : undefined} />
          <Chips
            label="Filter orders"
            items={Object.entries(FILTERS).map(([k, v]) => ({
              href: `/partners/review/orders?${new URLSearchParams({ ...(k !== "all" ? { f: k } : {}), ...(q ? { q } : {}) })}`,
              label: v.label,
              count: orders.filter(v.test).length,
              active: filter === k,
            }))}
          />
        </div>
      )}

      {shown.length === 0 ? (
        orders.length ? (
          <Empty title="No orders match" action={<Link href="/partners/review/orders" className={cn(secondary, small)}>Clear search and filters</Link>}>
            Try a different order number, email, SKU or tracking number.
          </Empty>
        ) : (
          <Empty title="No orders yet">
            {mode ? "Paid checkouts show up here automatically. If you think one is missing, use “Check Stripe for missed orders”." : "Orders appear here once checkout is switched on for this site."}
          </Empty>
        )
      ) : (
        <ul className={cn(card, "divide-y divide-sky-100 p-0 sm:p-0")} aria-label={`${shown.length} order${shown.length === 1 ? "" : "s"}`}>
          {shown.map((o) => {
            const st = STATUS[o.status] ?? { label: words(o.status), tone: "plain" as PillTone };
            const items = o.lineItems.reduce((n, l) => n + l.quantity, 0);
            const refunded = refundedSoFar(o);
            const flags = orderAttention(o);
            return (
              <li key={o.stripeCheckoutSessionId}>
                <Link
                  href={`/partners/review/orders/${o.stripeCheckoutSessionId}`}
                  className="group grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 px-4 py-4 hover:bg-ice-50 focus-visible:bg-ice-50 focus-visible:outline focus-visible:outline-[3px] focus-visible:-outline-offset-[3px] focus-visible:outline-royal sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:px-6 first:rounded-t-3xl last:rounded-b-3xl"
                >
                  <span className="col-span-2 min-w-0 sm:col-span-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-lg font-bold text-ink">{o.id}</span>
                      <Pill tone={st.tone}>{st.label}</Pill>
                    </span>
                    <span className="mt-0.5 block truncate text-sm text-ink-soft">
                      {o.customer.name || o.shippingAddress?.name || o.customer.email || "Customer"} · {items} item{items === 1 ? "" : "s"}
                    </span>
                    {(flags.length > 0 || o.fulfillments.some((g) => g.status === "awaiting_supplier")) && (
                      <span className="mt-2 flex flex-wrap gap-1.5">
                        {flags.map((x, i) => (
                          <Pill key={i} tone="alert">
                            {words(x.code)}
                          </Pill>
                        ))}
                        {o.fulfillments.some((g) => g.status === "awaiting_supplier") && <Pill tone="warn">place with supplier</Pill>}
                      </span>
                    )}
                  </span>
                  <span className="text-sm sm:text-right">
                    <span className="block font-display text-lg font-bold text-ink tabular-nums">{usd(o.amounts.total)}</span>
                    {refunded > 0 && <span className="block text-xs font-semibold text-[#a3174f]">refunded {usd(refunded)}</span>}
                  </span>
                  <span className="flex items-center justify-between gap-3 text-sm text-ink-soft sm:justify-end">
                    <time dateTime={o.createdAt}>{dateTime(o.createdAt)}</time>
                    <span aria-hidden="true" className="text-ink-soft/60 group-hover:text-royal">
                      →
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Live checkout's shipping lock: verified rates + the owner's approval of this exact table (D-SHIP-3). */
function LiveShippingApproval() {
  const st = shippingApprovalStatus(SHIPPING_ORIGINS);
  return (
    <details className={cn(card, "mb-5 py-4 sm:py-4")}>
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 font-display font-semibold text-ink [&::-webkit-details-marker]:hidden">
        <span>Shipping rates for live checkout</span>
        <span className="flex items-center gap-2">
          <Pill tone={st.problem ? "warn" : "good"}>{st.problem ? "not ready" : "approved"}</Pill>
          <span aria-hidden="true" className="text-ink-soft">▾</span>
        </span>
      </summary>
      <div className="mt-3 space-y-2 border-t border-sky-100 pt-3 text-sm leading-relaxed text-ink">
        <p>
          Places with verified, current rates: <strong>{st.verifiedOrigins}</strong> of {SHIPPING_ORIGINS.length}.{" "}
          {st.problem ? SHIPPING_LOCK_TEXT[st.problem] : "Live checkout may use this table."}
        </p>
        <p>
          This table&apos;s approval code: <span className="select-all font-mono">{st.fingerprint}</span>. After checking the rates, set{" "}
          <span className="font-mono">STRIPE_LIVE_SHIPPING_TABLE</span> to it for Production in Netlify (not a secret).
          Production value: {st.approval === "matches" ? "matches ✓" : st.approval === "different" ? "different — the rates changed since you approved them" : "not set"}.
        </p>
      </div>
    </details>
  );
}
