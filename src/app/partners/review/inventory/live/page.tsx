import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { reviewConfig } from "@/lib/partners/config";
import { requireReviewer } from "@/lib/partners/review-auth";
import { inventoryContext } from "@/commerce/orders/inventory-context";
import { getLedger } from "@/commerce/orders/inventory";
import { BOTH_CHANNELS_WARNING_UNITS, currentLive, lastLive, loadStockRows, salesSince } from "@/commerce/orders/stock-admin";
import { ReviewLogin } from "@/components/partners/ReviewLogin";
import { INVENTORY_TABS, OwnerNav, OwnerSubNav } from "@/components/owner/OwnerNav";
import { Callout, Empty, Flash, OwnerShell, PageTitle, Pill, card, input, label, one, panel } from "@/components/owner/OwnerUi";
import { cn } from "@/lib/cn";
import { StockCard } from "@/components/owner/StockCard";
import { endLiveAction, startLiveAction } from "../actions";

export const metadata: Metadata = { title: "TikTok LIVE", robots: { index: false, follow: false } };

export default function LivePage({ searchParams }: PageProps<"/partners/review/inventory/live">) {
  if (!reviewConfig()) notFound();
  return (
    <OwnerShell narrow>
      <Live searchParams={searchParams} />
    </OwnerShell>
  );
}

const fmt = (iso: string) => new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" });
const field = cn(input, "min-h-12 w-28 text-lg");
const h2 = "font-display text-lg font-bold text-ink sm:text-xl";
const big = "inline-flex min-h-14 w-full items-center justify-center rounded-full px-6 font-display text-lg font-semibold text-white focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-royal sm:w-auto";

async function Live({ searchParams }: { searchParams: PageProps<"/partners/review/inventory/live">["searchParams"] }) {
  await connection();
  if (!(await requireReviewer())) return <ReviewLogin />;
  const sp = await searchParams;
  const ctx = await inventoryContext();
  const now = new Date();
  const live = await currentLive(ctx.store);
  const rows = await loadStockRows(ctx.store, ctx.items, { now, liveVariantIds: new Set(live?.variantIds ?? []) });
  const featured = live ? rows.filter((r) => live.variantIds.includes(r.variantId)) : [];
  const recorded = live ? await Promise.all(featured.map(async (r) => salesSince(await getLedger(ctx.store, r.variantId), live.startedAt))) : [];
  const previous = !live && one(sp.ended) ? await lastLive(ctx.store) : null;

  return (
    <div>
      <OwnerNav current="/partners/review/inventory" />
      <OwnerSubNav label="Inventory pages" items={INVENTORY_TABS} current="/partners/review/inventory/live" />
      <PageTitle title="TikTok LIVE" meta={live ? <Pill tone="alert">LIVE running</Pill> : undefined} lead={ctx.label} />
      <Flash ok={one(sp.saved)} error={one(sp.error)} />

      {!live ? (
        <>
          {previous?.reconciliation && (
            <section aria-labelledby="last" className={cn(card, "mb-5")}>
              <h2 id="last" className={h2}>Last LIVE ({fmt(previous.startedAt)})</h2>
              <ul className="mt-3 divide-y divide-sky-100 text-sm text-ink">
                {previous.reconciliation.map((r) => {
                  const row = rows.find((x) => x.variantId === r.variantId);
                  return (
                    <li key={r.variantId} className="py-2">
                      {row?.sku ?? r.variantId}: recorded {r.recordedSales}, TikTok says {r.tiktokSales}
                      {r.difference ? ` → fixed by ${r.difference > 0 ? "+" : ""}${r.difference}` : " ✓"}
                      {r.counted !== null ? ` · counted ${r.counted}` : ""}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          <form action={startLiveAction} className={card}>
            <h2 className={h2}>Start a LIVE</h2>
            <p className="mt-1 text-sm text-ink-soft">Tick the items you&apos;ll show. They move to the top, and you can pause them on the website so nobody buys a unit you&apos;re selling on TikTok.</p>
            {rows.length === 0 ? (
              <div className="mt-3">
                <Empty compact>No products yet.</Empty>
              </div>
            ) : (
              <ul className="mt-3 grid gap-2">
                {rows.map((r) => (
                  <li key={r.variantId}>
                    <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl bg-ice-50/80 px-3 py-2 text-ink ring-1 ring-inset ring-sky-100 hover:ring-sky-300 has-[:checked]:bg-[#eef3ff] has-[:checked]:ring-royal">
                      <input type="checkbox" name="variant" value={r.variantId} className="size-5 accent-royal" />
                      <span className="flex-1">
                        <span className="font-semibold">{r.productName}</span> · {r.variantName} <span className="font-mono text-sm text-ink-soft">{r.sku}</span>
                      </span>
                      <Pill tone={r.free === 0 ? "alert" : r.free <= 3 ? "warn" : "good"}>{r.free} free</Pill>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            <label className={cn(panel, "mt-4 flex cursor-pointer items-start gap-3 text-ink")}>
              <input type="checkbox" name="pause" value="yes" defaultChecked className="mt-1 size-5 accent-royal" />
              <span>
                <strong>Pause these on the website during the LIVE</strong> (recommended). The rest of the store stays open.
              </span>
            </label>
            <button type="submit" className={cn(big, "mt-4 bg-ink shadow-[0_4px_0_#000c24]")}>Start LIVE</button>
          </form>
        </>
      ) : (
        <>
          <p className="flex items-center gap-3 rounded-2xl bg-ink px-4 py-3 font-semibold text-white">
            <span aria-hidden="true" className="size-2.5 shrink-0 animate-pulse rounded-full bg-[#ff5c93] motion-reduce:animate-none" />
            LIVE since {fmt(live.startedAt)} · {live.variantIds.length} item(s) · {live.pausedByLive.length} paused on the website
          </p>
          {featured.some((r) => !r.paused && r.websiteSellable && r.free <= BOTH_CHANNELS_WARNING_UNITS) && (
            <div role="alert" className="mt-3">
              <Callout tone="alert">Some LIVE items are still for sale on the website with only a few left. Pause them below so the same unit can&apos;t sell twice.</Callout>
            </div>
          )}
          <ul className="mt-4 grid gap-4">
            {featured.map((r) => (
              <StockCard key={r.variantId} row={r} now={now.getTime()} back="/partners/review/inventory/live" />
            ))}
          </ul>

          <form action={endLiveAction} className={cn(card, "mt-8 ring-2 ring-royal")}>
            <h2 className={h2}>End LIVE &amp; check the numbers</h2>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-ink-soft">
              <li>Open TikTok Seller Center → Orders for this LIVE and note how many of each item sold.</li>
              <li>Pack (or set aside) every TikTok order first.</li>
              <li>Optionally count what&apos;s left on the shelf — include units for website orders that haven&apos;t shipped.</li>
            </ol>
            <ul className="mt-4 grid gap-3">
              {featured.map((r, i) => (
                <li key={r.variantId} className={panel}>
                  <p className="font-semibold text-ink">{r.productName} · {r.variantName} <span className="font-mono text-sm text-ink-soft">{r.sku}</span></p>
                  <p className="text-sm text-ink-soft">Recorded here during the LIVE: {recorded[i]}</p>
                  <div className="mt-2 flex flex-wrap gap-4">
                    <label className={label}>
                      TikTok says sold
                      <input name={`sales-${r.variantId}`} type="number" inputMode="numeric" min={0} defaultValue={recorded[i]} className={field} />
                    </label>
                    <label className={label}>
                      Shelf count (optional)
                      <input name={`count-${r.variantId}`} type="number" inputMode="numeric" min={0} placeholder="—" className={field} />
                    </label>
                  </div>
                </li>
              ))}
            </ul>
            <label className={cn(panel, "mt-4 flex cursor-pointer items-start gap-3 text-ink")}>
              <input type="checkbox" name="resume" value="yes" defaultChecked className="mt-1 size-5 accent-royal" />
              <span>Put the items this LIVE paused back on sale on the website</span>
            </label>
            <button type="submit" className={cn(big, "mt-4 bg-royal shadow-[0_4px_0_var(--color-navy)]")}>End LIVE</button>
            <p className="mt-2 text-xs text-ink-soft">Differences are recorded as TikTok sales or corrections, each logged with the reason &ldquo;End-of-LIVE reconciliation&rdquo;.</p>
          </form>
        </>
      )}
    </div>
  );
}
