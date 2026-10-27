import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { reviewConfig } from "@/lib/partners/config";
import { requireReviewer } from "@/lib/partners/review-auth";
import { activeMode, orderDeps } from "@/commerce/checkout/service";
import { listOrders, refundedSoFar } from "@/commerce/orders/admin";
import { formatMoney } from "@/commerce/availability";
import { Container } from "@/components/ui/Primitives";
import { ReviewLogin } from "@/components/partners/ReviewLogin";
import { ArrowLeftIcon } from "@/components/icons/Icons";
import { cn } from "@/lib/cn";
import { reconcileAction } from "./actions";

export const metadata: Metadata = { title: "Orders", robots: { index: false, follow: false } };

/** PRIVATE owner area: orders for whichever Stripe mode is open here. */
export default function OrdersPage({ searchParams }: PageProps<"/partners/review/orders">) {
  if (!reviewConfig()) notFound();
  return (
    <section className="min-h-screen bg-ice-50 pb-24 pt-28 sm:pt-32">
      <Container>
        <Suspense fallback={<p className="text-ink-soft">Loading…</p>}>
          <Orders searchParams={searchParams} />
        </Suspense>
      </Container>
    </section>
  );
}

const usd = (cents: number) => formatMoney({ amount: cents, currency: "USD" });
const statusTone: Record<string, string> = {
  open: "bg-royal text-white",
  awaiting_payment: "bg-lemon-soft text-ink",
  partially_fulfilled: "bg-peach-soft text-ink",
  fulfilled: "bg-mint-soft text-ink",
  canceled: "bg-white text-ink-soft ring-1 ring-inset ring-sky-200",
};

async function Orders({ searchParams }: { searchParams: PageProps<"/partners/review/orders">["searchParams"] }) {
  await connection();
  const ctx = await requireReviewer();
  if (!ctx) return <ReviewLogin />;
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const mode = activeMode();
  const deps = mode ? await orderDeps(mode) : null;
  const orders = deps ? await listOrders(deps.store) : [];
  const reconciled = one(sp.reconciled)?.split("-");

  return (
    <div className="space-y-6">
      <Link href="/partners/review" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-4 font-display font-semibold text-ink ring-1 ring-inset ring-sky-200">
        <ArrowLeftIcon className="size-4" /> Partner applications
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink sm:text-4xl">Orders</h1>
          <p className="text-ink-soft">
            {mode === "live" ? "LIVE orders — real money." : mode === "test" ? "Stripe TEST mode — no real money." : "Checkout isn't switched on here."}
          </p>
        </div>
        {deps && (
          <form action={reconcileAction}>
            <button type="submit" className="rounded-full bg-white px-4 py-2 font-display text-sm font-semibold text-ink ring-1 ring-inset ring-sky-200 hover:bg-ice">
              Check Stripe for missed orders (last 3 days)
            </button>
          </form>
        )}
      </div>
      {reconciled && (
        <p role="status" className="rounded-2xl bg-mint-soft px-4 py-3 font-semibold text-ink">
          Checked {reconciled[0]} paid checkout(s) in Stripe; {reconciled[1]} missing order(s) recorded.
        </p>
      )}
      {one(sp.error) && <p role="alert" className="rounded-2xl bg-berry-soft px-4 py-3 font-semibold text-ink">{one(sp.error) === "closed" ? "Checkout isn't switched on here." : one(sp.error)}</p>}

      {orders.length === 0 ? (
        <p className="rounded-[2rem] bg-white p-8 text-center text-ink-soft ring-1 ring-inset ring-sky-200">No orders yet.</p>
      ) : (
        <ul className="grid gap-3">
          {orders.map((o) => (
            <li key={o.stripeCheckoutSessionId}>
              <Link href={`/partners/review/orders/${o.stripeCheckoutSessionId}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[1.5rem] bg-white p-4 ring-1 ring-inset ring-sky-200 hover:ring-royal">
                <span className={cn("rounded-full px-3 py-1 font-display text-xs font-bold", statusTone[o.status] ?? "bg-ice text-ink")}>{o.status.replace("_", " ")}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-lg font-bold text-ink">{o.id}</span>
                  <span className="block text-sm text-ink-soft">
                    {o.lineItems.reduce((n, l) => n + l.quantity, 0)} item(s) · {usd(o.amounts.total)}
                    {refundedSoFar(o) ? ` · refunded ${usd(refundedSoFar(o))}` : ""}
                  </span>
                </span>
                <span className="text-sm text-ink-soft">{new Date(o.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" })}</span>
                {o.flags.map((f) => (
                  <span key={f} className="rounded-full bg-berry-soft px-2.5 py-1 text-xs font-bold text-ink">{f.replace("_", " ")}</span>
                ))}
                {o.fulfillments.some((f) => f.status === "awaiting_supplier") && <span className="rounded-full bg-lemon-soft px-2.5 py-1 text-xs font-bold text-ink">place with supplier</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
