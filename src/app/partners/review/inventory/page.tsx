import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { reviewConfig } from "@/lib/partners/config";
import { requireReviewer } from "@/lib/partners/review-auth";
import { inventoryContext } from "@/commerce/orders/inventory-context";
import { listOrders } from "@/commerce/orders/admin";
import { ACTION_WARNINGS, canceledCheckouts, currentLive, loadStockRows } from "@/commerce/orders/stock-admin";
import { ReviewLogin } from "@/components/partners/ReviewLogin";
import { INVENTORY_TABS, OwnerNav, OwnerSubNav } from "@/components/owner/OwnerNav";
import { StockCard } from "@/components/owner/StockCard";
import { SearchIcon } from "@/components/icons/Icons";
import { cn } from "@/lib/cn";
import { Callout, Chips, Empty, Flash, OwnerShell, PageTitle, input, one, primary, secondary } from "@/components/owner/OwnerUi";

export const metadata: Metadata = { title: "Inventory", robots: { index: false, follow: false } };

/** PRIVATE owner area: one shared stock for the website and TikTok Shop. */
export default function InventoryPage({ searchParams }: PageProps<"/partners/review/inventory">) {
  if (!reviewConfig()) notFound();
  return (
    <OwnerShell narrow>
      <Inventory searchParams={searchParams} />
    </OwnerShell>
  );
}

const FILTERS = { all: "All", attention: "Needs attention", low: "Low or sold out", paused: "Paused", tiktok: "On TikTok", ours: "Ships from you", supplier: "Supplier ships" } as const;
type Filter = keyof typeof FILTERS;

async function Inventory({ searchParams }: { searchParams: PageProps<"/partners/review/inventory">["searchParams"] }) {
  await connection();
  if (!(await requireReviewer())) return <ReviewLogin />;
  const sp = await searchParams;
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
      <PageTitle
        title="Inventory"
        lead={ctx.label}
        actions={
          <>
            <Link href="/partners/review/inventory/live" className={cn(primary, live && "bg-[#a3174f] shadow-[0_2px_0_#6b0f34]")}>
              {live ? "LIVE running — open" : "Start a TikTok LIVE"}
            </Link>
            <Link href="/partners/review/inventory/activity" className={secondary}>
              Activity
            </Link>
          </>
        }
      />

      <Callout tone="info" className="mb-5">
        One stock for the website and TikTok Shop. Record each TikTok sale here as soon as you can — the website stops selling those units the moment you save.
        Recording by hand isn&apos;t instant, so during a LIVE pause items on the website (or use LIVE mode). <strong>This can&apos;t make overselling impossible.</strong>
      </Callout>

      <Flash ok={one(sp.saved)} error={one(sp.error) && !conflict ? one(sp.error) : null} />

      <form role="search" className="sticky top-[4.5rem] z-10 -mx-2 flex gap-2 rounded-full bg-ice-50/90 px-2 py-2 backdrop-blur sm:top-20" action="/partners/review/inventory">
        <label className="sr-only" htmlFor="q">Find an item</label>
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ink-soft" />
          <input id="q" name="q" type="search" defaultValue={query} placeholder="Name or SKU" className={cn(input, "min-h-12 rounded-full pl-11 text-lg")} />
        </div>
        {filter !== "all" && <input type="hidden" name="f" value={filter} />}
        <button type="submit" className={cn(primary, "min-h-12")}>Find</button>
      </form>

      <div className="mt-2">
        <Chips
          label="Filter"
          items={(Object.keys(FILTERS) as Filter[]).map((f) => ({
            href: href(f),
            label: FILTERS[f],
            count: f === "attention" && totals.attention ? totals.attention : f === "paused" && totals.paused ? totals.paused : undefined,
            active: filter === f,
          }))}
        />
      </div>

      {rows.length === 0 ? (
        <div className="mt-5">
          <Empty title="No products to count yet" action={<Link href="/partners/review/products#new" className={secondary}>Add a product</Link>}>
            Products you add (drafts included) appear here with their stock. You can also import them with <code>npm run catalog:import</code> (docs/CATALOG.md).
          </Empty>
        </div>
      ) : shown.length === 0 ? (
        <div className="mt-5">
          <Empty compact title="Nothing matches" action={<Link href="/partners/review/inventory" className={secondary}>Clear search and filters</Link>} />
        </div>
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
