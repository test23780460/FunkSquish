import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { reviewConfig } from "@/lib/partners/config";
import { requireReviewer } from "@/lib/partners/review-auth";
import { inventoryContext } from "@/commerce/orders/inventory-context";
import { getLedger } from "@/commerce/orders/inventory";
import { BOTH_CHANNELS_WARNING_UNITS, currentLive, lastLive, loadStockRows, salesSince } from "@/commerce/orders/stock-admin";
import { Container } from "@/components/ui/Primitives";
import { ReviewLogin } from "@/components/partners/ReviewLogin";
import { OwnerNav } from "@/components/owner/OwnerNav";
import { StockCard } from "@/components/owner/StockCard";
import { endLiveAction, startLiveAction } from "../actions";

export const metadata: Metadata = { title: "TikTok LIVE", robots: { index: false, follow: false } };

export default function LivePage({ searchParams }: PageProps<"/partners/review/inventory/live">) {
  if (!reviewConfig()) notFound();
  return (
    <section className="min-h-screen bg-ice-50 pb-24 pt-28 sm:pt-32">
      <Container className="max-w-3xl">
        <Suspense fallback={<p className="text-ink-soft">Loading…</p>}>
          <Live searchParams={searchParams} />
        </Suspense>
      </Container>
    </section>
  );
}

const fmt = (iso: string) => new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" });
const field = "min-h-12 w-24 rounded-2xl bg-ice-50 px-3 text-lg text-ink ring-2 ring-inset ring-sky-200 focus:outline-none focus:ring-royal";

async function Live({ searchParams }: { searchParams: PageProps<"/partners/review/inventory/live">["searchParams"] }) {
  await connection();
  if (!(await requireReviewer())) return <ReviewLogin />;
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
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
      <Link href="/partners/review/inventory" className="text-sm font-semibold text-royal underline">← All inventory</Link>
      <h1 className="mt-2 font-display text-3xl font-bold text-ink sm:text-4xl">TikTok LIVE</h1>
      <p className="text-ink-soft">{ctx.label}</p>
      {one(sp.saved) && <p role="status" className="mt-4 rounded-2xl bg-mint-soft px-4 py-3 font-semibold text-ink">{one(sp.saved)}</p>}
      {one(sp.error) && <p role="alert" className="mt-4 rounded-2xl bg-berry-soft px-4 py-3 font-semibold text-ink">{one(sp.error)}</p>}

      {!live ? (
        <>
          {previous?.reconciliation && (
            <section aria-labelledby="last" className="mt-6 rounded-[2rem] bg-white p-5 ring-1 ring-inset ring-sky-200">
              <h2 id="last" className="font-display text-xl font-bold text-ink">Last LIVE ({fmt(previous.startedAt)})</h2>
              <ul className="mt-2 space-y-1 text-sm text-ink">
                {previous.reconciliation.map((r) => {
                  const row = rows.find((x) => x.variantId === r.variantId);
                  return (
                    <li key={r.variantId}>
                      {row?.sku ?? r.variantId}: recorded {r.recordedSales}, TikTok says {r.tiktokSales}
                      {r.difference ? ` → fixed by ${r.difference > 0 ? "+" : ""}${r.difference}` : " ✓"}
                      {r.counted !== null ? ` · counted ${r.counted}` : ""}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          <form action={startLiveAction} className="mt-6 rounded-[2rem] bg-white p-5 ring-1 ring-inset ring-sky-200">
            <h2 className="font-display text-xl font-bold text-ink">Start a LIVE</h2>
            <p className="mt-1 text-sm text-ink-soft">Tick the items you&apos;ll show. They move to the top, and you can pause them on the website so nobody buys a unit you&apos;re selling on TikTok.</p>
            {rows.length === 0 ? (
              <p className="mt-3 text-ink-soft">No products yet.</p>
            ) : (
              <ul className="mt-3 grid gap-2">
                {rows.map((r) => (
                  <li key={r.variantId}>
                    <label className="flex min-h-12 items-center gap-3 rounded-2xl bg-ice-50 px-3 py-2 text-ink">
                      <input type="checkbox" name="variant" value={r.variantId} className="size-5" />
                      <span className="flex-1">
                        <span className="font-semibold">{r.productName}</span> · {r.variantName} <span className="font-mono text-sm text-ink-soft">{r.sku}</span>
                      </span>
                      <span className="text-sm font-semibold">{r.free} free</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            <label className="mt-4 flex items-start gap-3 text-ink">
              <input type="checkbox" name="pause" value="yes" defaultChecked className="mt-1 size-5" />
              <span>
                <strong>Pause these on the website during the LIVE</strong> (recommended). The rest of the store stays open.
              </span>
            </label>
            <button type="submit" className="mt-4 inline-flex min-h-14 w-full items-center justify-center rounded-full bg-ink px-6 font-display text-lg font-semibold text-white sm:w-auto">Start LIVE</button>
          </form>
        </>
      ) : (
        <>
          <p className="mt-4 rounded-2xl bg-ink px-4 py-3 font-semibold text-white">
            LIVE since {fmt(live.startedAt)} · {live.variantIds.length} item(s) · {live.pausedByLive.length} paused on the website
          </p>
          {featured.some((r) => !r.paused && r.websiteSellable && r.free <= BOTH_CHANNELS_WARNING_UNITS) && (
            <p role="alert" className="mt-3 rounded-2xl bg-berry-soft px-4 py-3 font-semibold text-ink">
              Some LIVE items are still for sale on the website with only a few left. Pause them below so the same unit can&apos;t sell twice.
            </p>
          )}
          <ul className="mt-4 grid gap-4">
            {featured.map((r) => (
              <StockCard key={r.variantId} row={r} now={now.getTime()} back="/partners/review/inventory/live" />
            ))}
          </ul>

          <form action={endLiveAction} className="mt-8 rounded-[2rem] bg-white p-5 ring-2 ring-inset ring-royal">
            <h2 className="font-display text-xl font-bold text-ink">End LIVE &amp; check the numbers</h2>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-ink-soft">
              <li>Open TikTok Seller Center → Orders for this LIVE and note how many of each item sold.</li>
              <li>Pack (or set aside) every TikTok order first.</li>
              <li>Optionally count what&apos;s left on the shelf — include units for website orders that haven&apos;t shipped.</li>
            </ol>
            <ul className="mt-4 grid gap-3">
              {featured.map((r, i) => (
                <li key={r.variantId} className="rounded-2xl bg-ice-50 p-3">
                  <p className="font-semibold text-ink">{r.productName} · {r.variantName} <span className="font-mono text-sm text-ink-soft">{r.sku}</span></p>
                  <p className="text-sm text-ink-soft">Recorded here during the LIVE: {recorded[i]}</p>
                  <div className="mt-2 flex flex-wrap gap-4">
                    <label className="grid gap-1 text-sm font-semibold text-ink">
                      TikTok says sold
                      <input name={`sales-${r.variantId}`} type="number" inputMode="numeric" min={0} defaultValue={recorded[i]} className={field} />
                    </label>
                    <label className="grid gap-1 text-sm font-semibold text-ink">
                      Shelf count (optional)
                      <input name={`count-${r.variantId}`} type="number" inputMode="numeric" min={0} placeholder="—" className={field} />
                    </label>
                  </div>
                </li>
              ))}
            </ul>
            <label className="mt-4 flex items-start gap-3 text-ink">
              <input type="checkbox" name="resume" value="yes" defaultChecked className="mt-1 size-5" />
              <span>Put the items this LIVE paused back on sale on the website</span>
            </label>
            <button type="submit" className="mt-4 inline-flex min-h-14 w-full items-center justify-center rounded-full bg-royal px-6 font-display text-lg font-semibold text-white sm:w-auto">End LIVE</button>
            <p className="mt-2 text-xs text-ink-soft">Differences are recorded as TikTok sales or corrections, each logged with the reason &ldquo;End-of-LIVE reconciliation&rdquo;.</p>
          </form>
        </>
      )}
    </div>
  );
}
