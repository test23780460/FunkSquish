import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { randomUUID } from "node:crypto";
import { reviewConfig } from "@/lib/partners/config";
import { requireReviewer } from "@/lib/partners/review-auth";
import { ownerDataStore } from "@/lib/owner/data";
import { inventoryContext } from "@/commerce/orders/inventory-context";
import { getSupplierStock, lastTikTokReconcile, SUPPLIER_STOCK, supplierStockStale, TIKTOK_COLUMNS } from "@/commerce/orders/reconcile";
import { listSuppliers } from "@/commerce/suppliers/supplier";
import { formatMoney } from "@/commerce/availability";
import { ReviewLogin } from "@/components/partners/ReviewLogin";
import { INVENTORY_TABS, OwnerNav, OwnerSubNav } from "@/components/owner/OwnerNav";
import { Select, Text } from "@/components/owner/Fields";
import { Flash, OwnerShell, PageTitle, Pill, card, dateTime, label, one, primary, secondary } from "@/components/owner/OwnerUi";
import { cn } from "@/lib/cn";
import { importCountsAction, importTikTokAction, restockAction, supplierStockAction } from "../actions";

export const metadata: Metadata = { title: "Reconcile stock", robots: { index: false, follow: false } };

/** PRIVATE: bring stock up to date from TikTok Shop, shelf counts, deliveries and suppliers. */
export default function ReconcilePage({ searchParams }: PageProps<"/partners/review/inventory/reconcile">) {
  if (!reviewConfig()) notFound();
  return (
    <OwnerShell>
      <Reconcile searchParams={searchParams} />
    </OwnerShell>
  );
}

interface RestockRow {
  id: string;
  at: string;
  sku: string;
  quantity: number;
  supplierId: string | null;
  invoiceRef: string | null;
  unitCostCents: number | null;
  mode: string;
}

async function Reconcile({ searchParams }: { searchParams: PageProps<"/partners/review/inventory/reconcile">["searchParams"] }) {
  await connection();
  const reviewer = await requireReviewer();
  if (!reviewer) return <ReviewLogin />;
  const sp = await searchParams;
  const ctx = await inventoryContext();
  const data = await ownerDataStore(reviewer.cfg);
  const now = new Date();
  const [last, suppliers, restockKeys] = await Promise.all([lastTikTokReconcile(ctx.store), listSuppliers(data), data.list("restock/")]);
  const restocks = (await Promise.all(restockKeys.slice(-30).reverse().map(async (k) => (await data.get<RestockRow>(k))?.value)))
    .filter((r): r is RestockRow => !!r && r.mode === ctx.mode)
    .slice(0, 20);
  const supplierItems = ctx.items.filter((i) => i.supplier);
  const supplierStock = await Promise.all(supplierItems.map(async (i) => ({ i, s: await getSupplierStock(ctx.store, i.variantId) })));
  const lastDays = last ? Math.floor((now.getTime() - Date.parse(last.at)) / 86_400_000) : null;

  return (
    <div>
      <OwnerNav current="inventory" />
      <OwnerSubNav label="Inventory pages" items={INVENTORY_TABS} current="/partners/review/inventory/reconcile" />
      <PageTitle title="TikTok, counts & restocks" lead={ctx.label} />
      <Flash ok={one(sp.ok)} error={one(sp.error)} />

      <section className={cn(card, "mb-5")} aria-labelledby="how">
        <h2 id="how" className="font-display text-xl font-bold text-ink">How stock stays in one place</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink">
          <li>
            <strong>This site&apos;s count is the only real count.</strong> Website orders take units automatically. TikTok Shop sales only count here once you record them — one by one on the Stock page, during a LIVE, or by uploading TikTok&apos;s order export below.
          </li>
          <li>Set TikTok Shop&apos;s own stock number in Seller Center from the &ldquo;free&rdquo; count on the Stock page, and keep it a little lower than what you have (a buffer covers sales you haven&apos;t uploaded yet).</li>
          <li>When few are left, pause the item on the website while you sell it on TikTok (the Stock page warns you).</li>
          <li>
            There is <strong>no automatic connection to TikTok Shop</strong>. Nothing here changes TikTok&apos;s stock, and late uploads are fine: each order line counts once, whenever it arrives.
          </li>
        </ul>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section id="tiktok" className={cn(card, "scroll-mt-28")} aria-labelledby="tt">
          <h2 id="tt" className="font-display text-xl font-bold text-ink">Upload TikTok Shop orders</h2>
          <p className={cn("mt-1 text-sm", lastDays !== null && lastDays <= 2 ? "text-ink-soft" : "font-semibold text-[#b8215a]")}>
            {last ? `Last upload ${dateTime(last.at)} (${lastDays} day${lastDays === 1 ? "" : "s"} ago): ${last.applied} change(s), ${last.held} held.` : "Never uploaded."}
            {lastDays !== null && lastDays > 2 && " Stock may be out of date — upload the latest export."}
          </p>
          <form action={importTikTokAction} className="mt-3 grid gap-2">
            <label className={label}>
              Order export (.csv) from TikTok Seller Center
              <input name="file" type="file" accept=".csv,text/csv" required className="text-sm" />
            </label>
            <p className="text-xs text-ink-soft">
              Needs columns for {TIKTOK_COLUMNS.orderId[0]}, {TIKTOK_COLUMNS.sku[0]} and {TIKTOK_COLUMNS.quantity[0]} ({TIKTOK_COLUMNS.status[0]} optional). Your TikTok seller SKUs must match the SKUs here. Canceled lines put stock back once. Checked against TikTok&apos;s documented export, not yet a real file from your account — press &ldquo;Check only&rdquo; first.
            </p>
            <div className="flex flex-wrap gap-2">
              <button name="intent" value="check" className={secondary}>Check only</button>
              <button name="intent" value="apply" className={primary}>Record sales</button>
            </div>
          </form>
        </section>

        <section id="counts" className={cn(card, "scroll-mt-28")} aria-labelledby="ct">
          <h2 id="ct" className="font-display text-xl font-bold text-ink">Upload shelf counts</h2>
          <p className="mt-1 text-sm text-ink-soft">A spreadsheet with columns <span className="font-mono">sku,count</span> (and optional <span className="font-mono">note</span>) sets each count. Counts lower than what website orders need are refused unless you tick the box.</p>
          <form action={importCountsAction} className="mt-3 grid gap-2">
            <label className={label}>
              Counts (.csv)
              <input name="file" type="file" accept=".csv,text/csv" required className="text-sm" />
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" name="force" className="size-5" /> I counted the shelf; set it even if website orders need more
            </label>
            <div className="flex flex-wrap gap-2">
              <button name="intent" value="check" className={secondary}>Check only</button>
              <button name="intent" value="apply" className={primary}>Set counts</button>
            </div>
          </form>
          <a href="/partners/review/inventory/export" download className="mt-3 inline-block text-sm font-semibold text-royal underline">
            Download current stock (.csv) to start from
          </a>
        </section>

        <section id="restock" className={cn(card, "scroll-mt-28")} aria-labelledby="rs">
          <h2 id="rs" className="font-display text-xl font-bold text-ink">Record a delivery (restock)</h2>
          <form action={restockAction} className="mt-3 grid gap-2 sm:grid-cols-2">
            <input type="hidden" name="requestId" value={randomUUID()} />
            <Select name="variant" title="Item" value="" options={[{ value: "", label: "Choose" }, ...ctx.items.filter((i) => !i.supplier).map((i) => ({ value: i.variantId, label: `${i.productName} · ${i.variantName} (${i.sku})` }))]} className="sm:col-span-2" />
            <Text name="quantity" title="Units that arrived" required inputMode="numeric" />
            <Text name="unitCost" title="Unit cost ($, private)" inputMode="decimal" />
            <Select name="supplierId" title="From supplier" value="" options={[{ value: "", label: "—" }, ...suppliers.filter((s) => !s.archived).map((s) => ({ value: s.id, label: s.name }))]} />
            <Text name="invoiceRef" title="Invoice / packing slip ref" maxLength={120} />
            <div className="sm:col-span-2">
              <button className={primary}>Add to stock</button>
            </div>
          </form>
          {restocks.length > 0 && (
            <ul className="mt-3 divide-y divide-sky-100 text-sm">
              {restocks.map((r) => (
                <li key={r.id} className="flex flex-wrap justify-between gap-2 py-1.5">
                  <span>
                    +{r.quantity} <span className="font-mono">{r.sku}</span>
                    {r.unitCostCents !== null && ` @ ${formatMoney({ amount: r.unitCostCents, currency: "USD" })}`}
                    {r.supplierId && ` · ${suppliers.find((s) => s.id === r.supplierId)?.name ?? "supplier"}`}
                    {r.invoiceRef && ` · ${r.invoiceRef}`}
                  </span>
                  <span className="text-ink-soft">{dateTime(r.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section id="supplier-stock" className={cn(card, "scroll-mt-28")} aria-labelledby="ss">
          <h2 id="ss" className="font-display text-xl font-bold text-ink">Supplier stock</h2>
          <p className="mt-1 text-sm text-ink-soft">For items a supplier ships: what they last told you. &ldquo;Out&rdquo; or &ldquo;discontinued&rdquo; pauses the item on the website. Older than 7 days is shown as stale.</p>
          {supplierItems.length === 0 ? (
            <p className="mt-2 text-sm text-ink-soft">No supplier-shipped items here.</p>
          ) : (
            <ul className="mt-3 grid gap-3">
              {supplierStock.map(({ i, s }) => (
                <li key={i.variantId} className="rounded-2xl bg-ice-50 p-3">
                  <p className="text-sm font-semibold text-ink">
                    {i.productName} · {i.variantName} <span className="font-mono text-ink-soft">{i.sku}</span>{" "}
                    {s ? <Pill tone={s.state === "in-stock" ? "good" : s.state === "low" ? "warn" : s.state === "unknown" ? "plain" : "alert"}>{SUPPLIER_STOCK[s.state]}</Pill> : <Pill>never checked</Pill>}{" "}
                    {supplierStockStale(s, now) && <Pill tone="warn">stale</Pill>}
                  </p>
                  {s && (
                    <p className="text-xs text-ink-soft">
                      Checked {dateTime(s.checkedAt)}
                      {s.quantity !== null ? ` · ${s.quantity} available` : ""}
                      {s.note ? ` · ${s.note}` : ""}
                    </p>
                  )}
                  <form action={supplierStockAction} className="mt-2 flex flex-wrap items-end gap-2">
                    <input type="hidden" name="variant" value={i.variantId} />
                    <Select name="state" title="They said" value={s?.state ?? "in-stock"} options={Object.entries(SUPPLIER_STOCK).map(([k, v]) => ({ value: k, label: v }))} />
                    <Text name="quantity" title="Units (optional)" inputMode="numeric" className="w-28" />
                    <Text name="note" title="Note" maxLength={200} />
                    <button className={secondary}>Save</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <p className="mt-5 text-sm text-ink-soft">
        Every change here also appears in <Link href="/partners/review/inventory/activity" className="font-semibold text-royal underline">Activity</Link>.
      </p>
    </div>
  );
}
