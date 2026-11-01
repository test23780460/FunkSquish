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
import { Callout, Empty, Notices, OwnerShell, PageTitle, Pill, Section, Stat, StatGroup, button, card, dateTime, input, panel, primary, quiet, secondary } from "@/components/owner/OwnerUi";
import { SearchIcon } from "@/components/icons/Icons";
import { cn } from "@/components/owner/cn";

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

  const extraTiles = extras?.tiles ?? [];
  const shipRows = toShip.slice(0, 12);

  return (
    <div className="space-y-8">
      <OwnerNav current="overview" />
      <PageTitle
        eyebrow="Owner dashboard"
        title="Overview"
        meta={test ? undefined : <Pill tone="good">Live data</Pill>}
        lead={
          <>
            {ctx.label} Updated {dateTime(now.toISOString())}.
          </>
        }
      />

      {test && (
        <Callout tone="warn" title="These are test orders">
          They came from Stripe&apos;s sandbox with made-up cards. They are not real sales and no real money moved.
        </Callout>
      )}

      {/* Quick actions: the two things done most during a TikTok LIVE. */}
      <form action="/partners/review/inventory" className={cn(card, "flex flex-col gap-3 sm:flex-row sm:items-end")}>
        <label className="grid min-w-0 flex-1 gap-1.5" htmlFor="tq">
          <span className="font-display text-base font-bold text-ink">Record a TikTok sale</span>
          <span className="relative">
            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-ink-soft" />
            <input id="tq" name="q" type="search" placeholder="Item name or SKU" className={cn(input, "min-h-12 rounded-full pl-11 text-lg")} />
          </span>
        </label>
        <div className="flex gap-2">
          <button type="submit" className={cn(primary, "min-h-12 flex-1 sm:flex-none")}>Find item</button>
          <Link href="/partners/review/inventory/live" className={cn(live ? cn(button, "min-h-12 bg-berry text-ink") : cn(secondary, "min-h-12"), "flex-1 sm:flex-none")}>
            {live ? "LIVE running →" : "Start a LIVE"}
          </Link>
        </div>
      </form>

      <StatGroup id="g-orders" title="Orders & shipping">
        <Stat label={test ? "Test orders" : "Orders"} value={orders.length} note="All recorded orders" href="/partners/review/orders" />
        <Stat label="Waiting to ship" value={toShip.length} note={`Packages · ${late.length} late`} href="/partners/review/fulfillment" tone={late.length ? "alert" : toShip.length ? "warn" : "plain"} />
        <Stat label="Need attention" value={attention.length} note="Order problems to fix" href="/partners/review/orders" tone={attention.length ? "alert" : "plain"} />
        <Stat label="Payment pending" value={pending} note="Delayed payment methods" href="/partners/review/orders" />
      </StatGroup>

      <StatGroup id="g-money" title="Money · last 30 days" cols={3}>
        <Stat
          label={test ? "Test sales" : "Sales"}
          value={recentPaid.length ? usd(gross30) : "—"}
          note={recentPaid.length ? `${recentPaid.length} paid order(s), incl. shipping & tax` : "No paid orders yet"}
        />
        <Stat label="Refunded" value={refunds.length ? usd(refunded30) : "—"} note={`${refunds.length} refund(s)`} />
        <Stat label="Open card disputes" value={disputes.length} note="Need a response in Stripe" tone={disputes.length ? "alert" : "plain"} />
      </StatGroup>

      <StatGroup id="g-catalog" title="Catalog, stock & suppliers" cols={3}>
        <Stat label="Stock warnings" value={stock.length} note={`${rows.length} variant(s) tracked`} href="/partners/review/inventory" tone={stock.length ? "warn" : "plain"} />
        {extraTiles.map((t) => (
          <Stat key={t.label} {...t} />
        ))}
      </StatGroup>

      {(warnings.length > 0 || attention.length > 0) && (
        <div className="grid items-start gap-5 lg:grid-cols-2">
          {attention.length > 0 && (
            <Section id="att" title="Orders that need you" count={attention.length} tone="alert" className={warnings.length ? "" : "lg:col-span-2"}>
              <Notices tone="alert" items={attention.slice(0, 12).map(({ o, a }) => ({ text: <><strong>{o.id}</strong> — {a.label}</>, href: orderHref(o) }))} />
            </Section>
          )}
          {warnings.length > 0 && (
            <Section id="ops" title="Set-up and warnings" count={warnings.length} tone="warn" description="Things to sort out before (or while) selling." className={attention.length ? "" : "lg:col-span-2"}>
              <Notices items={warnings} />
            </Section>
          )}
        </div>
      )}

      {extras?.sections}

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Section id="ship" title="Shipping deadlines" count={toShip.length} actions={toShip.length ? <Link href="/partners/review/fulfillment" className={quiet}>All packages →</Link> : undefined}>
          {toShip.length === 0 ? (
            <Empty compact>No packages waiting to ship.</Empty>
          ) : (
            <ul className="divide-y divide-sky-100">
              {shipRows.map(({ o, g }) => {
                const state = g.shipBy ? shipByState(g.shipBy, now) : null;
                return (
                  <li key={`${o.id}-${g.id}`}>
                    <Link href={orderHref(o)} className="-mx-2 flex flex-wrap items-center justify-between gap-2 rounded-xl px-2 py-2.5 text-ink hover:bg-ice-50">
                      <span className="min-w-0 text-sm">
                        <strong className="font-display">{o.id}</strong> <span className="text-ink-soft">· {packageLabel(o, g.id)}</span>
                        {g.status === "awaiting_supplier" && <span className="text-ink-soft"> · place with supplier</span>}
                      </span>
                      <Pill tone={state === "overdue" ? "alert" : state === "due-today" ? "warn" : "plain"}>
                        {g.shipBy ? `${state === "overdue" ? "Late — was due" : state === "due-today" ? "Due today" : "Ship by"} ${day(g.shipBy)}` : "No ship-by date"}
                      </Pill>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        <Section
          id="stock"
          title="Stock to check"
          count={stock.length}
          tone={stock.length ? "plain" : "plain"}
          actions={paused.length > 0 ? <Link href="/partners/review/inventory?f=paused" className={quiet}>{paused.length} paused →</Link> : undefined}
        >
          {stock.length === 0 ? (
            <Empty compact>{rows.length ? "No stock warnings." : "No stock is tracked here yet."}</Empty>
          ) : (
            <ul className="divide-y divide-sky-100">
              {stock.slice(0, 10).map((r) => (
                <li key={r.variantId}>
                  <Link href={`/partners/review/inventory?q=${encodeURIComponent(r.sku)}#v-${encodeURIComponent(r.variantId)}`} className="-mx-2 flex items-start justify-between gap-3 rounded-xl px-2 py-2.5 text-sm text-ink hover:bg-ice-50">
                    <span className="min-w-0">
                      <span className="block font-semibold">
                        {r.productName} <span className="font-normal text-ink-soft">· {r.variantName}</span>
                      </span>
                      <span className="block text-xs text-ink-soft">{r.warnings.filter((w) => ACTION_WARNINGS.has(w.code)).map((w) => w.text).join(" ")}</span>
                    </span>
                    <Pill tone={r.free === 0 ? "alert" : "warn"}>{r.free} free</Pill>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section id="money" title="Refunds & card disputes">
          {disputes.length > 0 ? (
            <Notices
              tone="alert"
              items={disputes.map(({ o, d }) => ({ text: <><strong>{o.id}</strong>: {usd(d.amount)} — {disputeAttentionLabel(d)}</>, href: orderHref(o) }))}
            />
          ) : (
            <Empty compact>No open card disputes.</Empty>
          )}
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className={panel}>
              <dt className="text-xs font-semibold text-ink-soft">Refunds, last 30 days</dt>
              <dd className="mt-1 font-display text-lg font-bold tabular-nums text-ink">
                {refunds.length} · {usd(refunded30)}
              </dd>
              {refunds.length > 0 && <dd className="mt-0.5 truncate text-xs text-ink-soft">{[...new Set(refunds.map((x) => x.o.id))].slice(0, 5).join(", ")}</dd>}
            </div>
            <div className={panel}>
              <dt className="text-xs font-semibold text-ink-soft">Orders with any refund</dt>
              <dd className="mt-1 font-display text-lg font-bold tabular-nums text-ink">{orders.filter((o) => refundedSoFar(o) > 0).length}</dd>
            </div>
          </dl>
        </Section>

        <Section id="mail" title="Emails that didn't send" count={emails.length} tone={emails.length ? "alert" : "plain"}>
          {emails.length === 0 ? (
            <Empty compact>No failed order emails.</Empty>
          ) : (
            <Notices
              tone="alert"
              items={emails.map(({ o, failed }) => ({ text: <><strong>{o.id}</strong>: {failed.join(", ")} — open the order and press &ldquo;Retry failed emails&rdquo;.</>, href: orderHref(o) }))}
            />
          )}
        </Section>
      </div>

      <Section id="act" title="Recent activity" description="The last 7 days of changes in the dashboard and stock." actions={<Link href="/partners/review/settings/activity" className={quiet}>Full activity log →</Link>}>
        {activity.length === 0 ? (
          <Empty compact>Nothing recorded in the last 7 days.</Empty>
        ) : (
          <ol className="divide-y divide-sky-100 text-sm">
            {activity.map((a, i) => (
              <li key={i} className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                {a.href ? (
                  <Link href={a.href} className="min-w-0 text-ink hover:text-royal hover:underline">
                    {a.text}
                  </Link>
                ) : (
                  <span className="min-w-0 text-ink">{a.text}</span>
                )}
                <time dateTime={a.at} className="shrink-0 text-xs text-ink-soft sm:text-sm">
                  {dateTime(a.at)}
                </time>
              </li>
            ))}
          </ol>
        )}
      </Section>
    </div>
  );
}

function auditHref(e: AuditEntry): string | undefined {
  if (e.area === "products" && e.target) return `/partners/review/products/${encodeURIComponent(e.target)}`;
  if (e.area === "suppliers" && e.target) return `/partners/review/suppliers/${encodeURIComponent(e.target)}`;
  if (e.area === "shipping") return "/partners/review/shipping";
  return undefined;
}
