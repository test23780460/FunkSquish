import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { reviewConfig } from "@/lib/partners/config";
import { requireReviewer } from "@/lib/partners/review-auth";
import { inventoryContext } from "@/commerce/orders/inventory-context";
import { KIND_LABEL, recentActivity } from "@/commerce/orders/stock-admin";
import { Container } from "@/components/ui/Primitives";
import { ReviewLogin } from "@/components/partners/ReviewLogin";
import { OwnerNav } from "@/components/owner/OwnerNav";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Inventory activity", robots: { index: false, follow: false } };

export default function ActivityPage() {
  if (!reviewConfig()) notFound();
  return (
    <section className="min-h-screen bg-ice-50 pb-24 pt-28 sm:pt-32">
      <Container className="max-w-3xl">
        <Suspense fallback={<p className="text-ink-soft">Loading…</p>}>
          <Activity />
        </Suspense>
      </Container>
    </section>
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
      <Link href="/partners/review/inventory" className="text-sm font-semibold text-royal underline">← All inventory</Link>
      <h1 className="mt-2 font-display text-3xl font-bold text-ink sm:text-4xl">Inventory activity</h1>
      <p className="text-ink-soft">Every stock change in the last 14 days, newest first. {ctx.label}</p>
      {rows.length === 0 ? (
        <p className="mt-6 rounded-[2rem] bg-white p-8 text-center text-ink-soft ring-1 ring-inset ring-sky-200">No changes yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-sky-100 rounded-[2rem] bg-white px-4 ring-1 ring-inset ring-sky-200">
          {rows.map((a) => (
            <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
              <span className="min-w-0">
                <span className={cn("block font-semibold text-ink", a.undoneBy && "line-through opacity-60")}>
                  {KIND_LABEL[a.kind]} {a.delta > 0 ? `+${a.delta}` : a.delta} · {names.get(a.variantId) ?? a.sku}
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
    </div>
  );
}
