import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { reviewConfig } from "@/lib/partners/config";
import { requireReviewer } from "@/lib/partners/review-auth";
import { inventoryContext } from "@/commerce/orders/inventory-context";
import { listOrders, orderAttention, refundedSoFar } from "@/commerce/orders/admin";
import { disputeAttentionLabel, disputeNeedsOwner } from "@/commerce/orders/dispute-status";
import { shipByState } from "@/commerce/orders/ship-by";
import { packageLabel } from "@/commerce/orders/notify";
import { ACTION_WARNINGS, canceledCheckouts, currentLive, loadStockRows } from "@/commerce/orders/stock-admin";
import type { Order } from "@/commerce/orders/types";
import { formatMoney } from "@/commerce/availability";
import { Container } from "@/components/ui/Primitives";
import { ReviewLogin } from "@/components/partners/ReviewLogin";
import { OwnerNav } from "@/components/owner/OwnerNav";
import { SearchIcon } from "@/components/icons/Icons";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Today", robots: { index: false, follow: false } };

/**
 * PRIVATE owner home: what needs doing today, in plain words. Every number
 * links to the page where it's fixed. Customer details stay on the order page.
 */
export default function TodayPage() {
  if (!reviewConfig()) notFound();
  return (
    <section className="min-h-screen bg-ice-50 pb-24 pt-28 sm:pt-32">
      <Container className="max-w-3xl">
        <Suspense fallback={<p className="text-ink-soft">Loading…</p>}>
          <Today />
        </Suspense>
      </Container>
    </section>
  );
}

const usd = (cents: number) => formatMoney({ amount: cents, currency: "USD" });
const card = "rounded-[2rem] bg-white p-5 ring-1 ring-inset ring-sky-200";
const orderHref = (o: Order) => `/partners/review/orders/${o.stripeCheckoutSessionId}`;
const day = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const UNSHIPPED = new Set(["unfulfilled", "awaiting_supplier", "sent_to_supplier", "packed"]);

function failedEmails(o: Order): string[] {
  const n = o.notifications;
  const out: string[] = [];
  if (n?.customer?.status === "failed") out.push("order confirmation");
  if (n?.owner?.status === "failed") out.push("your new-order alert");
  for (const [id, r] of Object.entries(n?.shipping ?? {})) if (r.status === "failed") out.push(`shipping email (${id.split("~")[0]})`);
  for (const g of o.fulfillments) for (const d of g.delayNotices ?? []) if (d.email === "failed") out.push("delay notice");
  return out;
}

async function Today() {
  await connection();
  if (!(await requireReviewer())) return <ReviewLogin />;
  const ctx = await inventoryContext();
  const now = new Date();
  const [orders, live] = await Promise.all([listOrders(ctx.store), currentLive(ctx.store)]);
  const rows = await loadStockRows(ctx.store, ctx.items, { now, liveVariantIds: new Set(live?.variantIds ?? []), canceledCheckouts: canceledCheckouts(orders) });

  const attention = orders.flatMap((o) => orderAttention(o, now).map((a) => ({ o, a })));
  const toShip = orders
    .filter((o) => o.status !== "canceled" && (o.paymentStatus === "paid" || o.paymentStatus === "partially_refunded"))
    .flatMap((o) => o.fulfillments.filter((g) => UNSHIPPED.has(g.status)).map((g) => ({ o, g })))
    .sort((x, y) => (x.g.shipBy ?? "9999").localeCompare(y.g.shipBy ?? "9999"));
  const emails = orders.map((o) => ({ o, failed: failedEmails(o) })).filter((x) => x.failed.length);
  const disputes = orders.flatMap((o) => (o.disputes ?? []).filter(disputeNeedsOwner).map((d) => ({ o, d })));
  const monthAgo = now.getTime() - 30 * 86_400_000;
  const refunds = orders.flatMap((o) => o.refunds.filter((r) => Date.parse(r.createdAt) >= monthAgo).map((r) => ({ o, r })));
  const stock = rows.filter((r) => r.warnings.some((w) => ACTION_WARNINGS.has(w.code)));
  const paused = rows.filter((r) => r.paused);
  const nothing = !attention.length && !toShip.length && !emails.length && !disputes.length && !stock.length;

  return (
    <div className="space-y-5">
      <OwnerNav current="/partners/review/today" />
      <div>
        <h1 className="font-display text-3xl font-bold text-ink sm:text-4xl">Today</h1>
        <p className="text-ink-soft">{ctx.label}</p>
      </div>

      <form action="/partners/review/inventory" className={cn(card, "flex flex-wrap items-end gap-2")}>
        <label className="grid w-full gap-1 font-display font-semibold text-ink sm:w-auto sm:min-w-0 sm:flex-1" htmlFor="tq">
          Record a TikTok sale
          <span className="relative">
            <SearchIcon className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ink-soft" />
            <input id="tq" name="q" type="search" placeholder="Item name or SKU" className="min-h-12 w-full rounded-full bg-ice-50 pl-11 pr-4 text-lg font-normal ring-2 ring-inset ring-sky-200 focus:outline-none focus:ring-royal" />
          </span>
        </label>
        <button type="submit" className="min-h-12 rounded-full bg-ink px-5 font-display font-semibold text-white">Find</button>
        <Link href="/partners/review/inventory/live" className={cn("inline-flex min-h-12 items-center rounded-full px-5 font-display font-semibold", live ? "bg-berry text-white" : "bg-white text-ink ring-1 ring-inset ring-sky-200")}>
          {live ? "LIVE running" : "Start a LIVE"}
        </Link>
      </form>

      {nothing && <p className={cn(card, "text-center text-ink-soft")}>Nothing needs you right now.</p>}

      {attention.length > 0 && (
        <section aria-labelledby="att" className={cn(card, "ring-2 ring-[#d62f6d]")}>
          <h2 id="att" className="font-display text-xl font-bold text-ink">Orders that need you ({attention.length})</h2>
          <ul className="mt-2 space-y-1.5">
            {attention.slice(0, 12).map(({ o, a }, i) => (
              <li key={i}>
                <Link href={orderHref(o)} className="block rounded-xl bg-berry-soft px-3 py-2 text-sm text-ink hover:ring-2 hover:ring-royal">
                  <strong>{o.id}</strong> — {a.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="ship" className={card}>
        <h2 id="ship" className="font-display text-xl font-bold text-ink">Packages to ship ({toShip.length})</h2>
        {toShip.length === 0 ? (
          <p className="mt-1 text-sm text-ink-soft">None waiting.</p>
        ) : (
          <ul className="mt-2 divide-y divide-sky-100">
            {toShip.slice(0, 15).map(({ o, g }) => {
              const state = g.shipBy ? shipByState(g.shipBy, now) : null;
              return (
                <li key={`${o.id}-${g.id}`}>
                  <Link href={orderHref(o)} className="flex flex-wrap items-center justify-between gap-2 py-2 text-ink">
                    <span className="min-w-0">
                      <strong>{o.id}</strong> · {packageLabel(o, g.id)}
                      {g.status === "awaiting_supplier" && <span className="text-sm text-ink-soft"> · place with supplier</span>}
                    </span>
                    <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold", state === "overdue" ? "bg-[#b8215a] text-white" : state === "due-today" ? "bg-lemon-soft text-ink" : "bg-ice text-ink")}>
                      {g.shipBy ? `${state === "overdue" ? "Late — was due" : state === "due-today" ? "Due today" : "Ship by"} ${day(g.shipBy)}` : "No ship-by date"}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {stock.length > 0 && (
        <section aria-labelledby="stock" className={card}>
          <h2 id="stock" className="font-display text-xl font-bold text-ink">Stock to check ({stock.length})</h2>
          <ul className="mt-2 space-y-1.5">
            {stock.slice(0, 12).map((r) => (
              <li key={r.variantId}>
                <Link href={`/partners/review/inventory?q=${encodeURIComponent(r.sku)}#v-${encodeURIComponent(r.variantId)}`} className="block rounded-xl bg-ice-50 px-3 py-2 text-sm text-ink hover:ring-2 hover:ring-royal">
                  <strong>{r.productName} · {r.variantName}</strong> ({r.free} free) — {r.warnings.filter((w) => ACTION_WARNINGS.has(w.code)).map((w) => w.text).join(" ")}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {paused.length > 0 && (
        <section aria-labelledby="paused" className={card}>
          <h2 id="paused" className="font-display text-xl font-bold text-ink">Paused on the website ({paused.length})</h2>
          <p className="mt-1 text-sm text-ink-soft">{paused.map((r) => `${r.productName} · ${r.variantName}`).join(", ")}</p>
          <Link href="/partners/review/inventory?f=paused" className="mt-2 inline-block text-sm font-semibold text-royal underline">Review paused items</Link>
        </section>
      )}

      {emails.length > 0 && (
        <section aria-labelledby="mail" className={card}>
          <h2 id="mail" className="font-display text-xl font-bold text-ink">Emails that didn&apos;t send ({emails.length})</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {emails.map(({ o, failed }) => (
              <li key={o.id}>
                <Link href={orderHref(o)} className="text-ink underline">{o.id}</Link>: {failed.join(", ")} — open the order and press &ldquo;Retry failed emails&rdquo;.
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="money" className={card}>
        <h2 id="money" className="font-display text-xl font-bold text-ink">Refunds &amp; card disputes</h2>
        {disputes.length > 0 ? (
          <ul className="mt-2 space-y-1 text-sm">
            {disputes.map(({ o, d }) => (
              <li key={d.stripeDisputeId} className="font-semibold text-[#b8215a]">
                <Link href={orderHref(o)} className="underline">{o.id}</Link>: {usd(d.amount)} — {disputeAttentionLabel(d)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-ink-soft">No open card disputes.</p>
        )}
        <p className="mt-2 text-sm text-ink">
          Refunds in the last 30 days: {refunds.length} · {usd(refunds.reduce((n, x) => n + x.r.amount, 0))}
          {refunds.length > 0 && ` (${[...new Set(refunds.map((x) => x.o.id))].slice(0, 5).join(", ")})`}
        </p>
        <p className="mt-1 text-sm text-ink-soft">
          Open orders: {orders.filter((o) => o.status === "open" || o.status === "partially_fulfilled").length} · refunded or partly refunded:{" "}
          {orders.filter((o) => refundedSoFar(o) > 0).length}
        </p>
      </section>
    </div>
  );
}
