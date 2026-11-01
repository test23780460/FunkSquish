import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { reviewConfig } from "@/lib/partners/config";
import { requireReviewer } from "@/lib/partners/review-auth";
import { ownerDataStore } from "@/lib/owner/data";
import { listRecords } from "@/commerce/catalog-admin/store";
import { dollarsToCents } from "@/commerce/catalog-admin/record";
import { listSuppliers } from "@/commerce/suppliers/supplier";
import { estimatedMargin, offers, supplierFacts } from "@/commerce/suppliers/compare";
import { formatMoney } from "@/commerce/availability";
import { ReviewLogin } from "@/components/partners/ReviewLogin";
import { OwnerNav, OwnerSubNav, SUPPLIER_TABS } from "@/components/owner/OwnerNav";
import { Empty, Missing, OwnerShell, PageTitle, Pill, card, input, one, secondary } from "@/components/owner/OwnerUi";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Compare suppliers", robots: { index: false, follow: false } };

/** PRIVATE: suppliers side by side, from what you entered only. Margins are labeled estimates from your own numbers. */
export default function ComparePage({ searchParams }: PageProps<"/partners/review/suppliers/compare">) {
  if (!reviewConfig()) notFound();
  return (
    <OwnerShell>
      <Compare searchParams={searchParams} />
    </OwnerShell>
  );
}

const usd = (c: number | null) => (c === null ? null : formatMoney({ amount: c, currency: "USD" }));

async function Compare({ searchParams }: { searchParams: PageProps<"/partners/review/suppliers/compare">["searchParams"] }) {
  await connection();
  const ctx = await requireReviewer();
  if (!ctx) return <ReviewLogin />;
  const sp = await searchParams;
  const data = await ownerDataStore(ctx.cfg);
  const [suppliers, records] = await Promise.all([listSuppliers(data).then((l) => l.filter((s) => !s.archived)), listRecords(data)]);
  const planned = dollarsToCents(one(sp.price));
  const plannedCents = planned !== null && !Number.isNaN(planned) ? planned : null;
  const type = (one(sp.type) ?? "").trim().toLowerCase();
  const list = offers(suppliers, records, plannedCents).filter((o) => !type || (o.productType ?? "").includes(type) || o.product.toLowerCase().includes(type));
  const types = [...new Set(suppliers.flatMap((s) => s.terms.productTypes))].sort();

  return (
    <div>
      <OwnerNav current="suppliers" />
      <OwnerSubNav label="Supplier pages" items={SUPPLIER_TABS} current="/partners/review/suppliers/compare" />
      <PageTitle title="Compare suppliers" lead="Built only from what you've entered. Empty facts say Missing — nothing is estimated as fact. Margins are estimates from your own price and cost entries, and say which cost they used." />

      {suppliers.length === 0 ? (
        <Empty>
          Add suppliers first (<Link href="/partners/review/suppliers" className="font-semibold text-royal underline">Suppliers</Link>), then their quotes or linked SKUs.
        </Empty>
      ) : (
        <>
          <section className={cn(card, "mb-5 overflow-x-auto")} aria-labelledby="t">
            <h2 id="t" className="font-display text-xl font-bold text-ink">Terms side by side</h2>
            <table className="mt-3 w-full min-w-[52rem] text-left text-sm">
              <thead className="text-ink-soft">
                <tr>
                  {["Supplier", "Product types", "MOQ", "Processing", "Shipping (1st / extra)", "Dropship", "Tracking", "Compliance", "Agreement", "Facts missing"].map((h) => (
                    <th key={h} className="py-1 pr-3 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-sky-100">
                {suppliers.map((s) => {
                  const f = supplierFacts(s, records);
                  return (
                    <tr key={s.id}>
                      <td className="py-2 pr-3">
                        <Link href={`/partners/review/suppliers/${s.id}`} className="font-semibold text-ink underline">
                          {s.name}
                        </Link>
                      </td>
                      <td className="py-2 pr-3">{s.terms.productTypes.join(", ") || <Missing />}</td>
                      <td className="py-2 pr-3">{s.terms.moq ?? <Missing />}</td>
                      <td className="py-2 pr-3">{s.terms.processingDays !== null ? `${s.terms.processingDays} bd` : <Missing />}</td>
                      <td className="py-2 pr-3">{s.terms.firstItemShippingCents !== null ? `${usd(s.terms.firstItemShippingCents)} / ${usd(s.terms.additionalItemShippingCents) ?? "?"}` : <Missing />}</td>
                      <td className="py-2 pr-3">{s.terms.dropship === "unknown" ? <Missing what="?" /> : s.terms.dropship}</td>
                      <td className="py-2 pr-3">{s.terms.tracking === "unknown" ? <Missing what="?" /> : s.terms.tracking}</td>
                      <td className="py-2 pr-3">
                        <Pill tone={s.compliance.status === "verified" ? "good" : "plain"}>{s.compliance.status}</Pill>
                      </td>
                      <td className="py-2 pr-3">
                        <Pill tone={s.agreement.status === "signed" ? "good" : "plain"}>{s.agreement.status}</Pill>
                      </td>
                      <td className="py-2 pr-3 text-ink-soft">{f.missing.length}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <form className={cn(card, "mb-4 flex flex-wrap items-end gap-3")} action="/partners/review/suppliers/compare">
            <label className="grid gap-1 text-sm font-semibold text-ink">
              Product type or name
              <input name="type" defaultValue={type} list="types" className={input} placeholder="jelly" />
              <datalist id="types">
                {types.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </label>
            <label className="grid gap-1 text-sm font-semibold text-ink">
              Planned selling price for quotes ($)
              <input name="price" defaultValue={one(sp.price) ?? ""} inputMode="decimal" className={input} placeholder="12.99" />
            </label>
            <button className={secondary}>Compare</button>
          </form>

          <section className={cn(card, "overflow-x-auto")} aria-labelledby="o">
            <h2 id="o" className="font-display text-xl font-bold text-ink">Costs and estimated margins ({list.length})</h2>
            {list.length === 0 ? (
              <p className="mt-2 text-sm text-ink-soft">No quotes or linked SKUs match.</p>
            ) : (
              <table className="mt-3 w-full min-w-[52rem] text-left text-sm">
                <thead className="text-ink-soft">
                  <tr>
                    {["Product", "Supplier", "Unit cost", "Landed cost", "MOQ", "Price", "Est. margin", "Source"].map((h) => (
                      <th key={h} className="py-1 pr-3 font-semibold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-sky-100">
                  {list.map((o, i) => {
                    const m = estimatedMargin(o);
                    return (
                      <tr key={i}>
                        <td className="py-2 pr-3 text-ink">
                          {o.product} <Pill>{o.kind === "linked" ? "your SKU" : "quote"}</Pill>
                          {o.supplierSku && <span className="block font-mono text-xs text-ink-soft">{o.supplierSku}</span>}
                        </td>
                        <td className="py-2 pr-3">{o.supplierName}</td>
                        <td className="py-2 pr-3">
                          {usd(o.unitCostCents) ?? <Missing />}
                          {o.kind === "linked" && o.unitCostCents !== null && !o.costVerified && <span className="block text-xs text-ink-soft">not verified</span>}
                        </td>
                        <td className="py-2 pr-3">{usd(o.landedCostCents) ?? <Missing />}</td>
                        <td className="py-2 pr-3">{o.moq ?? <Missing />}</td>
                        <td className="py-2 pr-3">
                          {usd(o.priceCents) ?? <Missing what={o.kind === "quote" ? "Type a planned price" : "Missing"} />}
                          {o.priceIsPlanned && <span className="block text-xs text-ink-soft">planned</span>}
                        </td>
                        <td className="py-2 pr-3">
                          {m ? (
                            <>
                              {(m.margin * 100).toFixed(0)}%<span className="block text-xs text-ink-soft">estimate, {m.basis === "landed" ? "after landed cost" : "unit cost only (no freight/duties)"}</span>
                            </>
                          ) : (
                            <Missing what="Can't estimate" />
                          )}
                        </td>
                        <td className="py-2 pr-3 text-ink-soft">{o.source ?? <Missing />}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            <p className="mt-3 text-xs text-ink-soft">Estimated margin = (price − cost) ÷ price, using landed cost when you entered it. It leaves out payment fees, packaging and shipping you pay but don&apos;t charge — it&apos;s a starting point, not your profit.</p>
          </section>
        </>
      )}
    </div>
  );
}
