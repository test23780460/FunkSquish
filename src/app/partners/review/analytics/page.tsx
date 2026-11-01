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
import { Callout, Chips, Empty, OwnerShell, PageTitle, Pill, Section, Stat, StatGroup, one, panel, secondary, small } from "@/components/owner/OwnerUi";
import { cn } from "@/components/owner/cn";

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

  const topProducts = r.products.slice(0, 10);
  const topUnits = Math.max(1, ...topProducts.map((p) => p.units));
  const noOrders = r.facts.orders === 0 && r.facts.refundsCount === 0;

  return (
    <div>
      <OwnerNav current="analytics" />
      <PageTitle
        title="Analytics"
        meta={test ? <Pill tone="info">Test mode</Pill> : <Pill tone="good">Real orders</Pill>}
        lead={<>{inv.label} Sales numbers come only from verified orders. Visitor numbers come from Umami and never include who anyone is.</>}
        actions={
          <a href={`/partners/review/analytics/export?days=${days}`} download className={cn(secondary, small)}>
            Download sales (.csv, no customer details)
          </a>
        }
      />
      <div className="mb-6">
        <Chips
          label="Period"
          items={(Object.keys(RANGES) as (keyof typeof RANGES)[]).map((k) => ({ href: `/partners/review/analytics?days=${k}`, label: `Last ${RANGES[k]}`, active: days === k }))}
        />
      </div>
      {test && <Callout tone="warn" className="mb-6">Test mode: these are sandbox orders with made-up cards — not real sales.</Callout>}

      <div className="space-y-8">
        {noOrders ? (
          <section aria-labelledby="facts">
            <h2 id="facts" className="mb-2.5 font-display text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft">
              Facts · from orders
            </h2>
            <Empty title="No paid orders in this period">{orders.length ? "Try a longer period." : "None at all yet. Sales appear here once checkout is open and orders come in."}</Empty>
          </section>
        ) : (
            <StatGroup id="facts" title="Facts · from orders">
              <Stat label={test ? "Test orders" : "Paid orders"} value={r.facts.orders} />
              <Stat label="Units sold" value={r.facts.unitsSold} />
              <Stat label="Paid, incl. shipping & tax" value={usd(r.facts.gross)} />
              <Stat label="Net revenue" value={usd(r.facts.netRevenue)} note="Paid − refunds − sales tax" />
              <Stat label="Refunded" value={usd(r.facts.refunded)} note={`${r.facts.refundsCount} refund(s)`} tone={r.facts.refunded ? "warn" : "plain"} />
              <Stat label="Shipping collected" value={usd(r.facts.shippingCollected)} />
              <Stat label="Sales tax collected" value={usd(r.facts.taxCollected)} note="Owed to the state, not yours" />
              <Stat label="Canceled / disputes" value={`${r.facts.canceledOrders} / ${r.facts.disputes}`} tone={r.facts.disputes ? "alert" : "plain"} />
            </StatGroup>
        )}

        <Section id="estimates" title="Estimates" description="Worked out from the costs you entered on products — not facts. Shown separately on purpose.">
          {r.facts.unitsSold === 0 ? (
            <Empty compact>Nothing to estimate yet.</Empty>
          ) : (
            <dl className="grid gap-3 sm:grid-cols-2">
              <div className={panel}>
                <dt className="text-sm font-semibold text-ink-soft">Product cost (estimate)</dt>
                <dd className="mt-1 font-display text-2xl font-bold text-ink tabular-nums">{usd(r.estimates.productCost)}</dd>
                <dd className="mt-1 text-xs leading-relaxed text-ink-soft">Units sold × the unit (or landed) cost you entered.</dd>
                {!r.estimates.complete && (
                  <dd className="mt-2">
                    <Pill tone="warn">Incomplete: {r.estimates.unitsWithoutCost} unit(s) have no cost entered</Pill>
                  </dd>
                )}
              </div>
              <div className={panel}>
                <dt className="text-sm font-semibold text-ink-soft">Gross profit before shipping labels (estimate)</dt>
                <dd className="mt-1 font-display text-2xl font-bold text-ink tabular-nums">{r.estimates.grossProfitBeforeShipping === null ? "—" : usd(r.estimates.grossProfitBeforeShipping)}</dd>
                <dd className="mt-1 text-xs leading-relaxed text-ink-soft">Net revenue − shipping collected − product cost. Not included: what you paid for labels, Stripe fees, packaging, supplier shipping.</dd>
              </div>
            </dl>
          )}
        </Section>

        <div className="grid gap-5 lg:grid-cols-2">
          <Section id="top" title="Best sellers" description="Top 10 by units sold in this period.">
            {topProducts.length === 0 ? (
              <Empty compact>No sales in this period.</Empty>
            ) : (
              <ol className="space-y-3 text-sm">
                {topProducts.map((p, i) => (
                  <li key={p.sku}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate">
                        <span className="mr-2 font-semibold tabular-nums text-ink-soft">{i + 1}.</span>
                        <span className="font-semibold text-ink">{p.name}</span> <span className="font-mono text-xs text-ink-soft">{p.sku}</span>
                      </span>
                      <span className="shrink-0 tabular-nums text-ink">
                        {p.units} sold · <strong>{usd(p.revenue)}</strong>
                      </span>
                    </div>
                    <div aria-hidden="true" className="mt-1.5 h-2 rounded-full bg-ice">
                      <div className="h-full rounded-full bg-royal" style={{ width: `${Math.max(2, Math.round((p.units / topUnits) * 100))}%` }} />
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Section>
          <Section id="slow" title="No sales in this period" count={r.noSales.length} description="Published products nobody bought in this period.">
            {r.noSales.length === 0 ? (
              <Empty compact>{records.some((x) => x.status === "published") ? "Every published product sold at least once." : "No products are published yet."}</Empty>
            ) : (
              <ul className="divide-y divide-sky-100 overflow-hidden rounded-2xl text-sm ring-1 ring-inset ring-sky-100">
                {r.noSales.map((p) => (
                  <li key={p.productId}>
                    <Link href={`/partners/review/products/${p.productId}`} className="group flex items-center justify-between gap-3 bg-white px-4 py-3 font-semibold text-ink hover:bg-ice-50">
                      {p.name}
                      <span aria-hidden="true" className="text-ink-soft group-hover:text-royal">→</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <Section
          id="visits"
          title="Visitors & actions (Umami)"
          actions={analyticsActive() ? <Pill tone="good">counting on funksquish.com</Pill> : <Pill>only active on the production site</Pill>}
          description="Cookieless; the site strips URL details before sending. Owner and checkout pages are never counted."
        >
          {umami && "pageviews" in umami ? (
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Visitors" value={umami.visitors} note="Unique (Umami's count)" />
              <Stat label="Visits" value={umami.visits} />
              <Stat label="Page views" value={umami.pageviews} />
            </div>
          ) : (
            <Callout tone={umami && "error" in umami ? "warn" : "info"}>
              {umami && "error" in umami ? `Couldn't read Umami (${umami.error}). ` : ""}
              See visitors, product page views and the actions below in the Umami dashboard (cloud.umami.is). To show totals here too, add a read-only <span className="font-mono">UMAMI_API_KEY</span> for Production.
            </Callout>
          )}
          <h3 className="mb-2 mt-5 font-display font-semibold text-ink">Actions the site counts</h3>
          <ul className="grid gap-2 text-sm sm:grid-cols-2">
            {Object.entries(EVENT_MEANING).map(([name, meaning]) => {
              const count = umami && "events" in umami ? umami.events.find((e) => e.name === name)?.count : undefined;
              return (
                <li key={name} className={cn(panel, "flex items-start justify-between gap-3 px-3.5 py-2.5")}>
                  <span className="min-w-0">
                    <span className="block font-mono text-xs text-ink-soft">{name}</span>
                    <span className="block text-ink">{meaning}</span>
                  </span>
                  {count !== undefined && <span className="font-display text-lg font-bold tabular-nums text-ink">{count}</span>}
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-ink-soft">Product views are page views of /shop/… in Umami. Checkout and purchases are counted here from orders, not by analytics.</p>
        </Section>
      </div>
    </div>
  );
}
