import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { reviewConfig } from "@/lib/partners/config";
import { requireReviewer } from "@/lib/partners/review-auth";
import { ownerAuth } from "@/lib/owner/auth";
import { listAudit, ownerDataStore, type AuditEntry } from "@/lib/owner/data";
import { overviewExtras } from "@/lib/owner/overview";
import { inventoryContext } from "@/commerce/orders/inventory-context";
import { listOrders, orderAttention, refundedSoFar } from "@/commerce/orders/admin";
import { disputeAttentionLabel, disputeNeedsOwner } from "@/commerce/orders/dispute-status";
import { shipByState } from "@/commerce/orders/ship-by";
import { packageLabel } from "@/commerce/orders/notify";
import { ACTION_WARNINGS, KIND_LABEL, canceledCheckouts, currentLive, loadStockRows, recentActivity } from "@/commerce/orders/stock-admin";
import type { Order } from "@/commerce/orders/types";
import { formatMoney } from "@/commerce/availability";
import { SHIPPING_ORIGINS, originProblem } from "@/commerce/origins";
import { getSupplierStock, lastTikTokReconcile, supplierStockStale } from "@/commerce/orders/reconcile";
import { ReviewLogin } from "@/components/partners/ReviewLogin";
import { OwnerNav } from "@/components/owner/OwnerNav";
import { OwnerShell, PageTitle, Stat, card, dateTime } from "@/components/owner/OwnerUi";
import { SearchIcon } from "@/components/icons/Icons";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Overview", robots: { index: false, follow: false } };

/**
 * PRIVATE owner home ("Overview"; the URL stays /today so old links work).
 * Every number is counted from stored records — orders, the stock ledger,
 * the dashboard's own records. Nothing is estimated, and test-mode orders
 * are labeled as test money. Customer details stay on the order page.
 */
export default function OverviewPage() {
  if (!reviewConfig()) notFound();
  return (
    <OwnerShell>
      <Overview />
    </OwnerShell>
  );
}

const usd = (cents: number) => formatMoney({ amount: cents, currency: "USD" });
const orderHref = (o: Order) => `/partners/review/orders/${o.stripeCheckoutSessionId}`;
const day = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const UNSHIPPED = new Set(["unfulfilled", "awaiting_supplier", "sent_to_supplier", "packed"]);
const PAID = new Set(["paid", "partially_refunded", "refunded"]);

function failedEmails(o: Order): string[] {
  const n = o.notifications;
  const out: string[] = [];
  if (n?.customer?.status === "failed") out.push("order confirmation");
  if (n?.owner?.status === "failed") out.push("your new-order alert");
  for (const [id, r] of Object.entries(n?.shipping ?? {})) if (r.status === "failed") out.push(`shipping email (${id.split("~")[0]})`);
  for (const g of o.fulfillments) for (const d of g.delayNotices ?? []) if (d.email === "failed") out.push("delay notice");
  for (const [k, r] of Object.entries(n?.other ?? {})) if (r.status === "failed") out.push(k === "canceled" ? "cancellation email" : k.startsWith("refund-") ? "refund email" : "tracking update email");
  return out;
}

type Activity = { at: string; text: string; href?: string };

async function Overview() {
  await connection();
  const reviewer = await requireReviewer();
  if (!reviewer) return <ReviewLogin />;
  const auth = await ownerAuth();
  const ctx = await inventoryContext();
  const data = await ownerDataStore(reviewer.cfg);
  const now = new Date();
  const [orders, live, audit, moves] = await Promise.all([
    listOrders(ctx.store),
    currentLive(ctx.store),
    listAudit(data, { days: 7, limit: 15, now }).catch(() => null),
    recentActivity(ctx.store, now, 7, 15).catch(() => []),
  ]);
  const rows = await loadStockRows(ctx.store, ctx.items, { now, liveVariantIds: new Set(live?.variantIds ?? []), canceledCheckouts: canceledCheckouts(orders) });
  const extras = await overviewExtras({ cfg: reviewer.cfg, data, orders, now }).catch(() => null);

  const test = ctx.mode === "test";
  const paid = orders.filter((o) => PAID.has(o.paymentStatus));
  const attention = orders.flatMap((o) => orderAttention(o, now).map((a) => ({ o, a })));
  const toShip = orders
    .filter((o) => o.status !== "canceled" && (o.paymentStatus === "paid" || o.paymentStatus === "partially_refunded"))
    .flatMap((o) => o.fulfillments.filter((g) => UNSHIPPED.has(g.status)).map((g) => ({ o, g })))
    .sort((x, y) => (x.g.shipBy ?? "9999").localeCompare(y.g.shipBy ?? "9999"));
  const late = toShip.filter(({ g }) => g.shipBy && shipByState(g.shipBy, now) === "overdue");
  const emails = orders.map((o) => ({ o, failed: failedEmails(o) })).filter((x) => x.failed.length);
  const disputes = orders.flatMap((o) => (o.disputes ?? []).filter(disputeNeedsOwner).map((d) => ({ o, d })));
  const monthAgo = now.getTime() - 30 * 86_400_000;
  const recentPaid = paid.filter((o) => Date.parse(o.createdAt) >= monthAgo);
  const refunds = orders.flatMap((o) => o.refunds.filter((r) => Date.parse(r.createdAt) >= monthAgo).map((r) => ({ o, r })));
  const gross30 = recentPaid.reduce((n, o) => n + o.amounts.total, 0);
  const refunded30 = refunds.reduce((n, x) => n + x.r.amount, 0);
  const stock = rows.filter((r) => r.warnings.some((w) => ACTION_WARNINGS.has(w.code)));
  const paused = rows.filter((r) => r.paused);
  const pending = orders.filter((o) => o.status === "awaiting_payment").length;

  const activity: Activity[] = [
    ...(audit ?? []).map((e: AuditEntry) => ({ at: e.at, text: `${e.summary}`, href: auditHref(e) })),
    ...moves.map((m) => ({ at: m.at, text: `${KIND_LABEL[m.kind]}: ${m.sku} ${m.delta > 0 ? "+" : ""}${m.delta} (now ${m.onHandAfter})`, href: "/partners/review/inventory/activity" })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 15);

  const warnings: { text: string; href?: string }[] = [];
  if (!auth?.enrollment) warnings.push({ text: "Two-step sign-in isn't set up. It's required before live checkout or partner applications can open.", href: "/partners/review/security" });
  const verified = SHIPPING_ORIGINS.filter((o) => originProblem(o, now, o.source) === null).length;
  if (verified === 0) warnings.push({ text: "No shipping origin has verified rates yet, so real products can't be checked out on the website.", href: "/partners/review/shipping" });
  const tiktokItems = rows.filter((r) => r.tiktok);
  if (tiktokItems.length) {
    const last = await lastTikTokReconcile(ctx.store).catch(() => null);
    const days = last ? Math.floor((now.getTime() - Date.parse(last.at)) / 86_400_000) : null;
    if (days === null || days > 2)
      warnings.push({ text: last ? `TikTok Shop orders were last uploaded ${days} days ago — stock may be out of date.` : "TikTok Shop orders have never been uploaded here — stock only knows the TikTok sales you recorded by hand.", href: "/partners/review/inventory/reconcile#tiktok" });
  }
  const supplierRows = rows.filter((r) => r.supplier && r.published);
  const stale = (await Promise.all(supplierRows.map(async (r) => supplierStockStale(await getSupplierStock(ctx.store, r.variantId).catch(() => null), now)))).filter(Boolean).length;
  if (stale) warnings.push({ text: `${stale} supplier-shipped item(s) haven't had their supplier stock checked in 7 days.`, href: "/partners/review/inventory/reconcile#supplier-stock" });
  if (audit === null) warnings.push({ text: "The dashboard's activity log couldn't be read just now. Reload; if it keeps happening, check Netlify Blobs status." });
  for (const w of extras?.warnings ?? []) warnings.push(w);

  return (
    <div className="space-y-5">
      <OwnerNav current="overview" />
      <PageTitle
        title="Overview"
        lead={
          <>
            {ctx.label} Updated {dateTime(now.toISOString())}.
          </>
        }
      />

      {test && (
        <p role="note" className="rounded-2xl bg-lemon-soft px-4 py-3 text-sm font-semibold text-ink">
          Test mode: these orders came from Stripe&apos;s sandbox with made-up cards. They are not real sales and no real money moved.
        </p>
      )}

      <section aria-label="Key numbers" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={test ? "Test orders" : "Orders"} value={orders.length} note="All recorded orders" href="/partners/review/orders" />
        <Stat label="Waiting to ship" value={toShip.length} note={`Packages · ${late.length} late`} href="/partners/review/fulfillment" tone={late.length ? "alert" : toShip.length ? "warn" : "plain"} />
        <Stat label="Need attention" value={attention.length} note="Order problems to fix" href="/partners/review/orders" tone={attention.length ? "alert" : "plain"} />
        <Stat label="Payment pending" value={pending} note="Delayed payment methods" href="/partners/review/orders" />
        <Stat
          label={test ? "Test sales, 30 days" : "Sales, 30 days"}
          value={recentPaid.length ? usd(gross30) : "—"}
          note={recentPaid.length ? `${recentPaid.length} paid order(s), incl. shipping & tax` : "No paid orders yet"}
        />
        <Stat label="Refunded, 30 days" value={refunds.length ? usd(refunded30) : "—"} note={`${refunds.length} refund(s)`} />
        <Stat label="Open card disputes" value={disputes.length} note="Need a response in Stripe" tone={disputes.length ? "alert" : "plain"} />
        <Stat label="Stock warnings" value={stock.length} note={`${rows.length} variant(s) tracked`} href="/partners/review/inventory" tone={stock.length ? "warn" : "plain"} />
      </section>

      {extras && extras.tiles.length > 0 && (
        <section aria-label="Products and suppliers" className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {extras.tiles.map((t) => (
            <Stat key={t.label} {...t} />
          ))}
        </section>
      )}

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

      {warnings.length > 0 && (
        <section aria-labelledby="ops" className={cn(card, "ring-2 ring-lemon")}>
          <h2 id="ops" className="font-display text-xl font-bold text-ink">Set-up and warnings ({warnings.length})</h2>
          <ul className="mt-2 space-y-1.5 text-sm text-ink">
            {warnings.map((w, i) => (
              <li key={i} className="rounded-xl bg-lemon-soft/60 px-3 py-2">
                {w.href ? (
                  <Link href={w.href} className="underline decoration-2 underline-offset-2">
                    {w.text}
                  </Link>
                ) : (
                  w.text
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

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

      {extras?.sections}

      <div className="grid gap-5 lg:grid-cols-2">
        <section aria-labelledby="ship" className={card}>
          <h2 id="ship" className="font-display text-xl font-bold text-ink">Shipping deadlines ({toShip.length})</h2>
          {toShip.length === 0 ? (
            <p className="mt-1 text-sm text-ink-soft">No packages waiting to ship.</p>
          ) : (
            <ul className="mt-2 divide-y divide-sky-100">
              {toShip.slice(0, 12).map(({ o, g }) => {
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

        <section aria-labelledby="stock" className={card}>
          <h2 id="stock" className="font-display text-xl font-bold text-ink">Stock to check ({stock.length})</h2>
          {stock.length === 0 ? (
            <p className="mt-1 text-sm text-ink-soft">{rows.length ? "No stock warnings." : "No stock is tracked here yet."}</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {stock.slice(0, 10).map((r) => (
                <li key={r.variantId}>
                  <Link href={`/partners/review/inventory?q=${encodeURIComponent(r.sku)}#v-${encodeURIComponent(r.variantId)}`} className="block rounded-xl bg-ice-50 px-3 py-2 text-sm text-ink hover:ring-2 hover:ring-royal">
                    <strong>
                      {r.productName} · {r.variantName}
                    </strong>{" "}
                    ({r.free} free) — {r.warnings.filter((w) => ACTION_WARNINGS.has(w.code)).map((w) => w.text).join(" ")}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {paused.length > 0 && (
            <p className="mt-3 text-sm text-ink">
              Paused on the website: {paused.length}.{" "}
              <Link href="/partners/review/inventory?f=paused" className="font-semibold text-royal underline">
                Review paused items
              </Link>
            </p>
          )}
        </section>

        <section aria-labelledby="money" className={card}>
          <h2 id="money" className="font-display text-xl font-bold text-ink">Refunds &amp; card disputes</h2>
          {disputes.length > 0 ? (
            <ul className="mt-2 space-y-1 text-sm">
              {disputes.map(({ o, d }) => (
                <li key={d.stripeDisputeId} className="font-semibold text-[#b8215a]">
                  <Link href={orderHref(o)} className="underline">
                    {o.id}
                  </Link>
                  : {usd(d.amount)} — {disputeAttentionLabel(d)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-ink-soft">No open card disputes.</p>
          )}
          <p className="mt-2 text-sm text-ink">
            Refunds in the last 30 days: {refunds.length} · {usd(refunded30)}
            {refunds.length > 0 && ` (${[...new Set(refunds.map((x) => x.o.id))].slice(0, 5).join(", ")})`}
          </p>
          <p className="mt-1 text-sm text-ink-soft">Orders with any refund: {orders.filter((o) => refundedSoFar(o) > 0).length}</p>
        </section>

        <section aria-labelledby="mail" className={card}>
          <h2 id="mail" className="font-display text-xl font-bold text-ink">Emails that didn&apos;t send ({emails.length})</h2>
          {emails.length === 0 ? (
            <p className="mt-1 text-sm text-ink-soft">No failed order emails.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {emails.map(({ o, failed }) => (
                <li key={o.id}>
                  <Link href={orderHref(o)} className="text-ink underline">
                    {o.id}
                  </Link>
                  : {failed.join(", ")} — open the order and press &ldquo;Retry failed emails&rdquo;.
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section aria-labelledby="act" className={card}>
        <h2 id="act" className="font-display text-xl font-bold text-ink">Recent activity (7 days)</h2>
        {activity.length === 0 ? (
          <p className="mt-1 text-sm text-ink-soft">Nothing recorded in the last 7 days.</p>
        ) : (
          <ol className="mt-2 divide-y divide-sky-100 text-sm">
            {activity.map((a, i) => (
              <li key={i} className="flex flex-wrap justify-between gap-x-3 py-1.5">
                {a.href ? (
                  <Link href={a.href} className="min-w-0 text-ink underline decoration-sky-300 underline-offset-2">
                    {a.text}
                  </Link>
                ) : (
                  <span className="min-w-0 text-ink">{a.text}</span>
                )}
                <time dateTime={a.at} className="shrink-0 text-ink-soft">
                  {dateTime(a.at)}
                </time>
              </li>
            ))}
          </ol>
        )}
        <Link href="/partners/review/settings/activity" className="mt-2 inline-block text-sm font-semibold text-royal underline">
          Full activity log
        </Link>
      </section>
    </div>
  );
}

function auditHref(e: AuditEntry): string | undefined {
  if (e.area === "products" && e.target) return `/partners/review/products/${encodeURIComponent(e.target)}`;
  if (e.area === "suppliers" && e.target) return `/partners/review/suppliers/${encodeURIComponent(e.target)}`;
  if (e.area === "shipping") return "/partners/review/shipping";
  return undefined;
}
