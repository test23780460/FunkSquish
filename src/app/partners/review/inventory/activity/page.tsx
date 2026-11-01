import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { reviewConfig } from "@/lib/partners/config";
import { requireReviewer } from "@/lib/partners/review-auth";
import { inventoryContext } from "@/commerce/orders/inventory-context";
import { KIND_LABEL, recentActivity } from "@/commerce/orders/stock-admin";
import { MAX_EXPORT_DAYS, parseExportRange } from "@/commerce/orders/stock-export";
import { ReviewLogin } from "@/components/partners/ReviewLogin";
import { INVENTORY_TABS, OwnerNav, OwnerSubNav } from "@/components/owner/OwnerNav";
import { Empty, OwnerShell, PageTitle, Pill, card, input, label, primary } from "@/components/owner/OwnerUi";
import { cn } from "@/components/owner/cn";

export const metadata: Metadata = { title: "Inventory activity", robots: { index: false, follow: false } };

export default function ActivityPage() {
  if (!reviewConfig()) notFound();
  return (
    <OwnerShell>
      <Activity />
    </OwnerShell>
  );
}

const fmt = (iso: string) => new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
const SOURCE = { owner: "You", live: "You (LIVE)", website: "Website" } as const;

async function Activity() {
  await connection();
  if (!(await requireReviewer())) return <ReviewLogin />;
  const ctx = await inventoryContext();
  const rows = await recentActivity(ctx.store);
  const names = new Map(ctx.items.map((i) => [i.variantId, `${i.productName} · ${i.variantName}`]));
  return (
    <div>
      <OwnerNav current="/partners/review/inventory" />
      <OwnerSubNav label="Inventory pages" items={INVENTORY_TABS} current="/partners/review/inventory/activity" />
      <PageTitle title="Inventory activity" lead={<>Every stock change in the last 14 days, newest first. {ctx.label}</>} />
      {rows.length === 0 ? (
        <Empty title="No changes yet">Sales, deliveries, counts and corrections show up here as they happen.</Empty>
      ) : (
        <ul className={cn(card, "divide-y divide-sky-100 px-4 py-1 sm:px-6 sm:py-1")}>
          {rows.map((a) => (
            <li key={a.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-3.5">
              <span className="min-w-0">
                <span className={cn("flex flex-wrap items-center gap-2 font-semibold text-ink", a.undoneBy && "line-through opacity-60")}>
                  <Pill tone={a.delta > 0 ? "good" : a.delta < 0 ? "warn" : "plain"}>
                    {KIND_LABEL[a.kind]} {a.delta > 0 ? `+${a.delta}` : a.delta}
                  </Pill>
                  {names.get(a.variantId) ?? a.sku}
                </span>
                <span className="block text-sm text-ink-soft">
                  {fmt(a.at)} · {SOURCE[a.source]} · {a.onHandBefore} → {a.onHandAfter} on the shelf
                  {a.orderId ? ` · order ${a.orderId}` : ""}
                  {a.note ? ` · ${a.note}` : ""}
                  {a.undoneBy ? " · undone" : ""}
                </span>
              </span>
              <span className="font-mono text-xs text-ink-soft">{a.sku}</span>
            </li>
          ))}
        </ul>
      )}
      <ExportForm />
    </div>
  );
}

/** Download the full history as a spreadsheet (CSV). A plain GET form: works without JavaScript. */
function ExportForm() {
  const range = parseExportRange(null, null);
  const defaults = range.ok ? range : { from: "", to: "" };
  return (
    <form method="get" action="/partners/review/inventory/export" className={cn(card, "mt-5")}>
      <h2 className="font-display text-lg font-bold text-ink sm:text-xl">Download stock history (CSV)</h2>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className={label}>
          From
          <input type="date" name="from" defaultValue={defaults.from} required className={input} />
        </label>
        <label className={label}>
          To
          <input type="date" name="to" defaultValue={defaults.to} required className={input} />
        </label>
        <button type="submit" className={primary}>
          Download CSV
        </button>
      </div>
      <p className="mt-2 text-sm text-ink-soft">
        Up to {MAX_EXPORT_DAYS} days per file (Eastern Time dates). Stock changes only — no customer details. Stock history is kept;
        nothing is deleted automatically until the record-keeping period is confirmed.
      </p>
    </form>
  );
}
