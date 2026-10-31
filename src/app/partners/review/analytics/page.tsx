import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { reviewConfig } from "@/lib/partners/config";
import { requireReviewer } from "@/lib/partners/review-auth";
import { ownerDataStore } from "@/lib/owner/data";
import { analyticsActive } from "@/lib/integrations/status";
import { EVENT_MEANING, umamiApiConfigured, umamiStats } from "@/lib/integrations/umami-api";
import { inventoryContext } from "@/commerce/orders/inventory-context";
import { listOrders } from "@/commerce/orders/admin";
import { listRecords } from "@/commerce/catalog-admin/store";
import { salesReport } from "@/commerce/analytics/report";
import { formatMoney } from "@/commerce/availability";
import { ReviewLogin } from "@/components/partners/ReviewLogin";
import { OwnerNav } from "@/components/owner/OwnerNav";
import { Empty, OwnerShell, PageTitle, Pill, Stat, card, one } from "@/components/owner/OwnerUi";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Analytics", robots: { index: false, follow: false } };

/**
 * PRIVATE: sales facts from verified orders, clearly separated from
 * estimates; visitor numbers stay in Umami (cookieless, no personal data).
 */
export default function AnalyticsPage({ searchParams }: PageProps<"/partners/review/analytics">) {
  if (!reviewConfig()) notFound();
  return (
    <OwnerShell>
      <Analytics searchParams={searchParams} />
    </OwnerShell>
  );
}

const usd = (c: number) => formatMoney({ amount: c, currency: "USD" });
const RANGES = { "7": "7 days", "30": "30 days", "90": "90 days", "365": "12 months" } as const;

async function Analytics({ searchParams }: { searchParams: PageProps<"/partners/review/analytics">["searchParams"] }) {
  await connection();
  const ctx = await requireReviewer();
  if (!ctx) return <ReviewLogin />;
  const sp = await searchParams;
  const asked = one(sp.days) ?? "30";
  const days: keyof typeof RANGES = asked in RANGES ? (asked as keyof typeof RANGES) : "30";
  const to = new Date();
  const from = new Date(to.getTime() - Number(days) * 86_400_000);
  const inv = await inventoryContext();
  const [orders, records] = await Promise.all([listOrders(inv.store), listRecords(await ownerDataStore(ctx.cfg))]);
  const r = salesReport(orders, records, { from, to });
  const test = inv.mode === "test";
  const umami = umamiApiConfigured() ? await umamiStats(from, to) : null;

  return (
    <div>
      <OwnerNav current="analytics" />
      <PageTitle title="Analytics" lead={<>{inv.label} Sales numbers come only from verified orders. Visitor numbers come from Umami and never include who anyone is.</>} />
      <nav aria-label="Period" className="mb-4 flex flex-wrap gap-2">
        {(Object.keys(RANGES) as (keyof typeof RANGES)[]).map((k) => (
          <Link key={k} href={`/partners/review/analytics?days=${k}`} aria-current={days === k ? "page" : undefined} className={cn("inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold", days === k ? "bg-ink text-white" : "bg-white text-ink ring-1 ring-inset ring-sky-200")}>
            {RANGES[k]}
          </Link>
        ))}
        <a href={`/partners/review/analytics/export?days=${days}`} download className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold text-royal underline">
          Download sales (.csv, no customer details)
        </a>
      </nav>
      {test && <p role="note" className="mb-4 rounded-2xl bg-lemon-soft px-4 py-3 text-sm font-semibold text-ink">Test mode: these are sandbox orders with made-up cards — not real sales.</p>}

      <h2 className="mb-2 font-display text-xl font-bold text-ink">Facts (from orders)</h2>
      {r.facts.orders === 0 && r.facts.refundsCount === 0 ? (
        <Empty>No paid orders in this period{orders.length ? "" : " — none at all yet. Sales appear here once checkout is open and orders come in"}.</Empty>
      ) : (
        <section aria-label="Sales facts" className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label={test ? "Test orders" : "Paid orders"} value={r.facts.orders} />
          <Stat label="Units sold" value={r.facts.unitsSold} />
          <Stat label="Paid, incl. shipping & tax" value={usd(r.facts.gross)} />
          <Stat label="Refunded" value={usd(r.facts.refunded)} note={`${r.facts.refundsCount} refund(s)`} />
          <Stat label="Net revenue" value={usd(r.facts.netRevenue)} note="Paid − refunds − sales tax" />
          <Stat label="Shipping collected" value={usd(r.facts.shippingCollected)} />
          <Stat label="Sales tax collected" value={usd(r.facts.taxCollected)} note="Owed to the state, not yours" />
          <Stat label="Canceled / disputes" value={`${r.facts.canceledOrders} / ${r.facts.disputes}`} />
        </section>
      )}

      <h2 className="mb-2 mt-6 font-display text-xl font-bold text-ink">Estimates (from your cost entries)</h2>
      <section className={card} aria-label="Estimates">
        {r.facts.unitsSold === 0 ? (
          <p className="text-sm text-ink-soft">Nothing to estimate yet.</p>
        ) : (
          <dl className="grid gap-x-4 gap-y-1.5 text-sm text-ink sm:grid-cols-[auto_1fr]">
            <dt className="font-semibold">Product cost (estimate)</dt>
            <dd>
              {usd(r.estimates.productCost)} — units sold × the unit (or landed) cost you entered
              {!r.estimates.complete && <span className="font-semibold text-[#b8215a]"> · incomplete: {r.estimates.unitsWithoutCost} unit(s) have no cost entered</span>}
            </dd>
            <dt className="font-semibold">Gross profit before shipping labels (estimate)</dt>
            <dd>
              {r.estimates.grossProfitBeforeShipping === null ? "—" : usd(r.estimates.grossProfitBeforeShipping)} — net revenue − shipping collected − product cost. Not included: what you paid for labels, Stripe fees, packaging, supplier shipping.
            </dd>
          </dl>
        )}
      </section>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <section className={card} aria-labelledby="top">
          <h2 id="top" className="font-display text-xl font-bold text-ink">Best sellers</h2>
          {r.products.length === 0 ? (
            <p className="mt-1 text-sm text-ink-soft">No sales in this period.</p>
          ) : (
            <ol className="mt-2 divide-y divide-sky-100 text-sm">
              {r.products.slice(0, 10).map((p) => (
                <li key={p.sku} className="flex justify-between gap-2 py-1.5">
                  <span>
                    {p.name} <span className="font-mono text-xs text-ink-soft">{p.sku}</span>
                  </span>
                  <span className="tabular-nums">
                    {p.units} · {usd(p.revenue)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
        <section className={card} aria-labelledby="slow">
          <h2 id="slow" className="font-display text-xl font-bold text-ink">No sales in this period</h2>
          {r.noSales.length === 0 ? (
            <p className="mt-1 text-sm text-ink-soft">{records.some((x) => x.status === "published") ? "Every published product sold at least once." : "No products are published yet."}</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {r.noSales.map((p) => (
                <li key={p.productId}>
                  <Link href={`/partners/review/products/${p.productId}`} className="text-ink underline">
                    {p.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className={cn(card, "mt-6")} aria-labelledby="visits">
        <h2 id="visits" className="font-display text-xl font-bold text-ink">Visitors &amp; actions (Umami)</h2>
        <p className="mt-1 text-sm text-ink">
          Umami is {analyticsActive() ? <Pill tone="good">counting on funksquish.com</Pill> : <Pill>only active on the production site</Pill>}. It&apos;s cookieless and the site strips URL details before sending; owner and checkout pages are never counted.
        </p>
        {umami && "pageviews" in umami ? (
          <div className="mt-3 grid grid-cols-3 gap-3">
            <Stat label="Visitors" value={umami.visitors} note="Unique (Umami's count)" />
            <Stat label="Visits" value={umami.visits} />
            <Stat label="Page views" value={umami.pageviews} />
          </div>
        ) : (
          <p className="mt-2 text-sm text-ink-soft">
            {umami && "error" in umami ? `Couldn't read Umami (${umami.error}). ` : ""}
            See visitors, product page views and the actions below in the Umami dashboard (cloud.umami.is). To show totals here too, add a read-only <span className="font-mono">UMAMI_API_KEY</span> for Production.
          </p>
        )}
        <h3 className="mt-4 font-display font-semibold text-ink">Actions the site counts</h3>
        <ul className="mt-1 grid gap-1 text-sm sm:grid-cols-2">
          {Object.entries(EVENT_MEANING).map(([name, meaning]) => {
            const count = umami && "events" in umami ? umami.events.find((e) => e.name === name)?.count : undefined;
            return (
              <li key={name} className="flex justify-between gap-2 rounded-xl bg-ice-50 px-3 py-1.5">
                <span>
                  <span className="font-mono text-xs text-ink-soft">{name}</span> — {meaning}
                </span>
                {count !== undefined && <span className="tabular-nums">{count}</span>}
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-xs text-ink-soft">Product views are page views of /shop/… in Umami. Checkout and purchases are counted here from orders, not by analytics.</p>
      </section>
    </div>
  );
}
