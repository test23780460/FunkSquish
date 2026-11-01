import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { reviewConfig } from "@/lib/partners/config";
import { requireReviewer } from "@/lib/partners/review-auth";
import { inventoryContext } from "@/commerce/orders/inventory-context";
import { listOrders } from "@/commerce/orders/admin";
import { shipByState } from "@/commerce/orders/ship-by";
import { packageLabel } from "@/commerce/orders/notify";
import { fulfillmentQueue, QUEUE_LABEL, QUEUES, type QueueId } from "@/commerce/orders/fulfillment-queue";
import { ReviewLogin } from "@/components/partners/ReviewLogin";
import { OwnerNav } from "@/components/owner/OwnerNav";
import { Empty, OwnerShell, PageTitle, Pill, card, one } from "@/components/owner/OwnerUi";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Fulfillment", robots: { index: false, follow: false } };

/**
 * PRIVATE: every package across orders, by what has to happen next — ours
 * to pack, ones a supplier ships, in transit, and problems. Actions (mark
 * shipped, delay notice, refund) stay on the order page, where the checks are.
 */
export default function FulfillmentPage({ searchParams }: PageProps<"/partners/review/fulfillment">) {
  if (!reviewConfig()) notFound();
  return (
    <OwnerShell>
      <Fulfillment searchParams={searchParams} />
    </OwnerShell>
  );
}

const day = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

async function Fulfillment({ searchParams }: { searchParams: PageProps<"/partners/review/fulfillment">["searchParams"] }) {
  await connection();
  if (!(await requireReviewer())) return <ReviewLogin />;
  const sp = await searchParams;
  const ctx = await inventoryContext();
  const now = new Date();
  const orders = await listOrders(ctx.store);
  const queue = fulfillmentQueue(orders, now);
  const q = one(sp.q) as QueueId | undefined;
  const active: QueueId = q && (QUEUES as readonly string[]).includes(q) ? q : "ours";
  const rows = queue[active];

  return (
    <div>
      <OwnerNav current="fulfillment" />
      <PageTitle
        title="Fulfillment"
        lead={
          <>
            {ctx.label} Each package is one origin (your studio or one supplier) with its own ship-by date and tracking. Open an order to mark it shipped, send a delay notice or refund.
          </>
        }
      />
      <nav aria-label="Package queues" className="mb-4 flex flex-wrap gap-2">
        {QUEUES.map((id) => (
          <Link
            key={id}
            href={`/partners/review/fulfillment?q=${id}`}
            aria-current={active === id ? "page" : undefined}
            className={cn("inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold", active === id ? "bg-ink text-white" : "bg-white text-ink ring-1 ring-inset ring-sky-200")}
          >
            {QUEUE_LABEL[id]} ({queue[id].length})
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <Empty>{orders.length ? "No packages here." : "No orders yet — packages appear here once orders come in."}</Empty>
      ) : (
        <ul className="grid gap-3">
          {rows.map(({ order: o, group: g, items }) => {
            const state = g.shipBy ? shipByState(g.shipBy, now) : null;
            return (
              <li key={`${o.id}-${g.id}`} className={cn(card, "p-4")}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link href={`/partners/review/orders/${o.stripeCheckoutSessionId}#pkg-${encodeURIComponent(g.id)}`} className="font-display text-lg font-bold text-ink underline decoration-sky-300 underline-offset-4">
                    {o.id} · {packageLabel(o, g.id)}
                  </Link>
                  <span className="flex flex-wrap gap-1.5">
                    <Pill tone={g.source === "supplier" ? "warn" : "plain"}>{g.source === "supplier" ? "Supplier ships" : "We ship"}</Pill>
                    <Pill>{g.status.replaceAll("_", " ")}</Pill>
                    {g.shipBy && ["ours", "supplier", "sent"].includes(active) && (
                      <Pill tone={state === "overdue" ? "alert" : state === "due-today" ? "warn" : "plain"}>
                        {state === "overdue" ? "Late — was due" : state === "due-today" ? "Due today" : "Ship by"} {day(g.shipBy)}
                      </Pill>
                    )}
                    {!g.shipBy && ["ours", "supplier", "sent"].includes(active) && <Pill tone="warn">No ship-by date</Pill>}
                  </span>
                </div>
                <ul className="mt-2 text-sm text-ink">
                  {items.map((l) => (
                    <li key={l.variantId}>
                      {l.quantity} × {l.name} <span className="font-mono text-ink-soft">{l.sku}</span>
                    </li>
                  ))}
                </ul>
                {(g.trackingNumber || g.carrier) && (
                  <p className="mt-1 text-sm text-ink-soft">
                    {g.carrier ?? "Carrier?"} · <span className="font-mono">{g.trackingNumber ?? "no tracking"}</span>
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
