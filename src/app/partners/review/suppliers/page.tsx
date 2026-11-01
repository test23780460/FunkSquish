import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { reviewConfig } from "@/lib/partners/config";
import { requireReviewer } from "@/lib/partners/review-auth";
import { ownerDataStore } from "@/lib/owner/data";
import { inventoryContext } from "@/commerce/orders/inventory-context";
import { listOrders } from "@/commerce/orders/admin";
import { supplierAttention } from "@/commerce/orders/supplier-orders";
import { listRecords } from "@/commerce/catalog-admin/store";
import { listSuppliers, SUPPLIER_STATUSES, type Supplier } from "@/commerce/suppliers/supplier";
import { supplierFacts } from "@/commerce/suppliers/compare";
import { packageSupplierId } from "@/commerce/suppliers/export";
import { ReviewLogin } from "@/components/partners/ReviewLogin";
import { OwnerNav, OwnerSubNav, SUPPLIER_TABS } from "@/components/owner/OwnerNav";
import { Chips, Count, Empty, Flash, OwnerShell, PageTitle, Pill, card, input, label, one, primary, secondary, small } from "@/components/owner/OwnerUi";
import { cn } from "@/lib/cn";
import { createSupplierAction } from "./actions";

export const metadata: Metadata = { title: "Suppliers", robots: { index: false, follow: false } };

/** PRIVATE: every supplier, how complete their facts are, and packages waiting on them. */
export default function SuppliersPage({ searchParams }: PageProps<"/partners/review/suppliers">) {
  if (!reviewConfig()) notFound();
  return (
    <OwnerShell>
      <Suppliers searchParams={searchParams} />
    </OwnerShell>
  );
}

const statusTone: Record<Supplier["status"], "plain" | "good" | "warn" | "alert" | "dark"> = { prospect: "plain", sampling: "warn", negotiating: "warn", approved: "good", paused: "alert", ended: "plain" };

async function Suppliers({ searchParams }: { searchParams: PageProps<"/partners/review/suppliers">["searchParams"] }) {
  await connection();
  const ctx = await requireReviewer();
  if (!ctx) return <ReviewLogin />;
  const sp = await searchParams;
  const data = await ownerDataStore(ctx.cfg);
  const inv = await inventoryContext();
  const [suppliers, records, orders] = await Promise.all([listSuppliers(data), listRecords(data), listOrders(inv.store)]);
  const status = one(sp.status);
  const showArchived = one(sp.archived) === "1";
  const shown = suppliers.filter((s) => (showArchived ? s.archived : !s.archived) && (!status || s.status === status));
  const waiting = supplierAttention(orders);

  return (
    <div>
      <OwnerNav current="suppliers" />
      <OwnerSubNav label="Supplier pages" items={SUPPLIER_TABS} current="/partners/review/suppliers" />
      <PageTitle title="Suppliers" lead="Private: who makes or ships your products, their terms, agreements and documents. Only facts you enter from the supplier's own documents — anything missing is shown as missing." />
      <Flash ok={one(sp.ok)} error={one(sp.error)} />

      {waiting.length > 0 && (
        <section aria-labelledby="w" className={cn(card, "mb-5 ring-2 ring-lemon")}>
          <h2 id="w" className="flex items-center gap-2 font-display text-lg font-bold text-ink sm:text-xl">Supplier packages that need you <Count n={waiting.length} tone="warn" /></h2>
          <ul className="mt-2 space-y-1.5 text-sm">
            {waiting.slice(0, 15).map(({ order, group, why }) => {
              const sid = packageSupplierId(group, records, suppliers);
              return (
                <li key={`${order.id}-${group.id}`}>
                  <Link href={`/partners/review/orders/${order.stripeCheckoutSessionId}#pkg-${encodeURIComponent(group.id)}`} className="block rounded-xl bg-lemon-soft/60 px-3 py-2.5 text-ink ring-1 ring-inset ring-[#f3dd8a] hover:ring-2 hover:ring-royal">
                    <strong>{order.id}</strong> · {suppliers.find((s) => s.id === sid)?.name ?? "supplier not linked"} — {why}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div>
          <div className="mb-4">
            <Chips
              label="Filter suppliers"
              items={[
                { href: "/partners/review/suppliers", label: "All", count: suppliers.filter((s) => !s.archived).length, active: !status && !showArchived },
                ...SUPPLIER_STATUSES.map((st) => ({ href: `/partners/review/suppliers?status=${st}`, label: <span className="capitalize">{st}</span>, count: suppliers.filter((x) => !x.archived && x.status === st).length, active: status === st })),
                { href: "/partners/review/suppliers?archived=1", label: "Archived", count: suppliers.filter((s) => s.archived).length, active: showArchived },
              ]}
            />
          </div>
          {suppliers.length === 0 ? (
            <Empty title="No suppliers yet">Add one with the form beside this list. (Partner applications from the public form are under &ldquo;Partner applications&rdquo; above.)</Empty>
          ) : shown.length === 0 ? (
            <Empty compact title="No suppliers here" action={<Link href="/partners/review/suppliers" className={cn(secondary, small)}>Show all</Link>} />
          ) : (
            <ul className="grid gap-3">
              {shown.map((s) => {
                const f = supplierFacts(s, records);
                return (
                  <li key={s.id}>
                    <Link href={`/partners/review/suppliers/${s.id}`} className={cn(card, "flex flex-wrap items-center gap-3 p-4 hover:ring-royal")}>
                      <span className="min-w-0 flex-1">
                        <span className="block font-display text-lg font-bold text-ink">{s.name}</span>
                        <span className="block text-sm text-ink-soft">
                          {[s.country, s.terms.productTypes.join(", ") || null, `${f.linkedSkus} linked SKU(s)`, `${s.quotes.length} quote(s)`].filter(Boolean).join(" · ")}
                        </span>
                        {f.missing.length > 0 && <span className="mt-1 block text-xs text-ink-soft">Missing: {f.missing.slice(0, 5).join(", ")}{f.missing.length > 5 ? "…" : ""}</span>}
                      </span>
                      <span className="flex flex-wrap gap-1.5">
                        <Pill tone={statusTone[s.status]}>{s.status}</Pill>
                        <Pill tone={s.agreement.status === "signed" ? "good" : "plain"}>agreement: {s.agreement.status}</Pill>
                        {s.terms.dropship === "yes" && <Pill>dropships</Pill>}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <aside>
          <form action={createSupplierAction} className={cn(card, "grid gap-3")}>
            <h2 className="font-display text-lg font-bold text-ink">Add a supplier</h2>
            <label className={label}>
              Business name
              <input name="name" required maxLength={100} className={input} />
            </label>
            <button className={primary}>Add supplier</button>
            <p className="text-xs text-ink-soft">Kept private. Never shown on the website — customers only ever see &ldquo;a FunkSquish supplier partner&rdquo;.</p>
          </form>
        </aside>
      </div>
    </div>
  );
}
