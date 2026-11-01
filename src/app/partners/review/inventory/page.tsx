import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { reviewConfig } from "@/lib/partners/config";
import { requireReviewer } from "@/lib/partners/review-auth";
import { inventoryContext } from "@/commerce/orders/inventory-context";
import { listOrders } from "@/commerce/orders/admin";
import { ACTION_WARNINGS, canceledCheckouts, currentLive, loadStockRows } from "@/commerce/orders/stock-admin";
import { Container } from "@/components/ui/Primitives";
import { ReviewLogin } from "@/components/partners/ReviewLogin";
import { INVENTORY_TABS, OwnerNav, OwnerSubNav } from "@/components/owner/OwnerNav";
import { StockCard } from "@/components/owner/StockCard";
import { SearchIcon } from "@/components/icons/Icons";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Inventory", robots: { index: false, follow: false } };

/** PRIVATE owner area: one shared stock for the website and TikTok Shop. */
export default function InventoryPage({ searchParams }: PageProps<"/partners/review/inventory">) {
  if (!reviewConfig()) notFound();
  return (
    <section className="min-h-screen bg-ice-50 pb-24 pt-28 sm:pt-32">
      <Container className="max-w-3xl">
        <Suspense fallback={<p className="text-ink-soft">Loading…</p>}>
          <Inventory searchParams={searchParams} />
        </Suspense>
      </Container>
    </section>
  );
}

const FILTERS = { all: "All", attention: "Needs attention", low: "Low or sold out", paused: "Paused", tiktok: "On TikTok", ours: "Ships from you", supplier: "Supplier ships" } as const;
type Filter = keyof typeof FILTERS;

async function Inventory({ searchParams }: { searchParams: PageProps<"/partners/review/inventory">["searchParams"] }) {
  await connection();
  if (!(await requireReviewer())) return <ReviewLogin />;
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const ctx = await inventoryContext();
  const now = new Date();
  const [live, orders] = await Promise.all([currentLive(ctx.store), listOrders(ctx.store)]);
  const rows = await loadStockRows(ctx.store, ctx.items, { now, liveVariantIds: new Set(live?.variantIds ?? []), canceledCheckouts: canceledCheckouts(orders) });

  const query = (one(sp.q) ?? "").trim().toLowerCase().slice(0, 60);
  const filter: Filter = (one(sp.f) ?? "all") in FILTERS ? (one(sp.f) as Filter) : "all";
  const shown = rows
    .filter((r) => !query || `${r.productName} ${r.variantName} ${r.sku}`.toLowerCase().includes(query))
    .filter((r) =>
      filter === "attention" ? r.warnings.some((w) => ACTION_WARNINGS.has(w.code)) :
      filter === "low" ? r.warnings.some((w) => ["low", "sold-out", "oversold"].includes(w.code)) :
      filter === "paused" ? !!r.paused :
      filter === "tiktok" ? r.tiktok :
      filter === "ours" ? !r.supplier :
      filter === "supplier" ? r.supplier : true,
    )
    // LIVE items first, then whatever needs attention.
    .sort((a, b) => Number(live?.variantIds.includes(b.variantId) ?? false) - Number(live?.variantIds.includes(a.variantId) ?? false) || b.warnings.length - a.warnings.length);
  const conflict = one(sp.conflict)
    ? { variantId: one(sp.conflict)!, kind: one(sp.kind) ?? "", quantity: one(sp.quantity) ?? "", requestId: one(sp.requestId) ?? "", error: one(sp.error) ?? "" }
    : null;
  const totals = { attention: rows.filter((r) => r.warnings.some((w) => ACTION_WARNINGS.has(w.code))).length, paused: rows.filter((r) => r.paused).length };
  const href = (f: Filter) => `/partners/review/inventory?${new URLSearchParams({ ...(query ? { q: query } : {}), ...(f !== "all" ? { f } : {}) })}`;

  return (
    <div>
      <OwnerNav current="/partners/review/inventory" />
      <OwnerSubNav label="Inventory pages" items={INVENTORY_TABS} current="/partners/review/inventory" />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink sm:text-4xl">Inventory</h1>
          <p className="text-ink-soft">{ctx.label}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/partners/review/inventory/live" className={cn("inline-flex min-h-11 items-center rounded-full px-4 font-display font-semibold", live ? "bg-berry text-white" : "bg-ink text-white")}>
            {live ? "LIVE running — open" : "Start a TikTok LIVE"}
          </Link>
          <Link href="/partners/review/inventory/activity" className="inline-flex min-h-11 items-center rounded-full bg-white px-4 font-display font-semibold text-ink ring-1 ring-inset ring-sky-200 hover:bg-ice">
            Activity
          </Link>
        </div>
      </div>

      <p className="mt-3 rounded-2xl bg-white p-3 text-sm text-ink-soft ring-1 ring-inset ring-sky-200">
        One stock for the website and TikTok Shop. Record each TikTok sale here as soon as you can — the website stops selling those units the moment you save.
        Recording by hand isn&apos;t instant, so during a LIVE pause items on the website (or use LIVE mode). <strong className="text-ink">This can&apos;t make overselling impossible.</strong>
      </p>

      {one(sp.saved) && <p role="status" className="mt-4 rounded-2xl bg-mint-soft px-4 py-3 font-semibold text-ink">{one(sp.saved)}</p>}
      {one(sp.error) && !conflict && <p role="alert" className="mt-4 rounded-2xl bg-berry-soft px-4 py-3 font-semibold text-ink">{one(sp.error)}</p>}

      <form className="sticky top-20 z-10 mt-4 flex gap-2 rounded-full bg-ice-50/90 py-2 backdrop-blur" action="/partners/review/inventory">
        <label className="sr-only" htmlFor="q">Find an item</label>
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ink-soft" />
          <input id="q" name="q" type="search" defaultValue={query} placeholder="Name or SKU" className="min-h-12 w-full rounded-full bg-white pl-11 pr-4 text-lg text-ink ring-2 ring-inset ring-sky-200 focus:outline-none focus:ring-royal" />
        </div>
        {filter !== "all" && <input type="hidden" name="f" value={filter} />}
        <button type="submit" className="min-h-12 rounded-full bg-royal px-5 font-display font-semibold text-white">Find</button>
      </form>

      <nav aria-label="Filter" className="-mx-4 mt-2 overflow-x-auto px-4">
        <ul className="flex min-w-max gap-2">
          {(Object.keys(FILTERS) as Filter[]).map((f) => (
            <li key={f}>
              <Link href={href(f)} aria-current={filter === f ? "true" : undefined} className={cn("inline-flex min-h-10 items-center rounded-full px-3.5 text-sm font-semibold ring-1 ring-inset", filter === f ? "bg-royal text-white ring-royal" : "bg-white text-ink ring-sky-200")}>
                {FILTERS[f]}
                {f === "attention" && totals.attention ? ` (${totals.attention})` : ""}
                {f === "paused" && totals.paused ? ` (${totals.paused})` : ""}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {rows.length === 0 ? (
        <p className="mt-6 rounded-[2rem] bg-white p-8 text-center text-ink-soft ring-1 ring-inset ring-sky-200">
          No real products in the catalog yet. Add them with <code>npm run catalog:import</code> (docs/CATALOG.md); they&apos;ll appear here, drafts included.
        </p>
      ) : shown.length === 0 ? (
        <p className="mt-6 rounded-[2rem] bg-white p-8 text-center text-ink-soft ring-1 ring-inset ring-sky-200">Nothing matches.</p>
      ) : (
        <ul className="mt-4 grid gap-4">
          {shown.map((r) => (
            <StockCard key={r.variantId} row={r} now={now.getTime()} back="/partners/review/inventory" conflict={conflict?.variantId === r.variantId ? conflict : undefined} />
          ))}
        </ul>
      )}
    </div>
  );
}
