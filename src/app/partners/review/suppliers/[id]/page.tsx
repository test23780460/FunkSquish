import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { reviewConfig } from "@/lib/partners/config";
import { requireReviewer } from "@/lib/partners/review-auth";
import { ownerDataStore } from "@/lib/owner/data";
import { inventoryContext } from "@/commerce/orders/inventory-context";
import { listOrders } from "@/commerce/orders/admin";
import { listRecords } from "@/commerce/catalog-admin/store";
import { AGREEMENT_STATUSES, CHANNELS, getSupplier, listSuppliers, mayShareCustomerData, SUPPLIER_STATUSES, type Supplier } from "@/commerce/suppliers/supplier";
import { supplierFacts } from "@/commerce/suppliers/compare";
import { CAPABILITY_LABEL, capabilityStates } from "@/commerce/suppliers/integrations";
import { DOC_KINDS, type SupplierDoc } from "@/commerce/suppliers/documents";
import { packagesFor } from "@/commerce/suppliers/export";
import { formatMoney } from "@/commerce/availability";
import { ReviewLogin } from "@/components/partners/ReviewLogin";
import { OwnerNav } from "@/components/owner/OwnerNav";
import { Area, Check, Select, Text } from "@/components/owner/Fields";
import { card, danger, dateTime, fileInput, Flash, input, label, Missing, one, OwnerShell, Pill, primary, secondary } from "@/components/owner/OwnerUi";
import { cn } from "@/components/owner/cn";
import { addLogAction, addQuoteAction, archiveSupplierAction, deleteDocAction, logDoneAction, removeQuoteAction, saveSupplierAction, uploadDocAction } from "../actions";

export const metadata: Metadata = { title: "Supplier", robots: { index: false, follow: false } };

// Private, per-request page: no shared instant-navigation shell needed.
export const instant = false;

/** PRIVATE: one supplier — terms, agreement, documents, quotes, contact history, linked SKUs, open packages. */
export default function SupplierPage({ params, searchParams }: PageProps<"/partners/review/suppliers/[id]">) {
  if (!reviewConfig()) notFound();
  return (
    <OwnerShell>
      <Detail params={params} searchParams={searchParams} />
    </OwnerShell>
  );
}

const usd = (c: number | null) => (c === null ? null : formatMoney({ amount: c, currency: "USD" }));
const dollars = (c: number | null) => (c === null ? "" : (c / 100).toFixed(2));

async function Detail({ params, searchParams }: { params: PageProps<"/partners/review/suppliers/[id]">["params"]; searchParams: PageProps<"/partners/review/suppliers/[id]">["searchParams"] }) {
  await connection();
  const ctx = await requireReviewer();
  if (!ctx) return <ReviewLogin />;
  const { id } = await params;
  const sp = await searchParams;
  const data = await ownerDataStore(ctx.cfg);
  const s = await getSupplier(data, id);
  if (!s) notFound();
  const inv = await inventoryContext();
  const [records, orders, all, docKeys] = await Promise.all([listRecords(data), listOrders(inv.store), listSuppliers(data), data.list(`supplier-doc/${s.id}/`)]);
  const docs = (await Promise.all(docKeys.map(async (k) => (await data.get<SupplierDoc>(k))?.value))).filter((d): d is SupplierDoc => !!d).sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  const facts = supplierFacts(s, records);
  const linked = records.flatMap((r) => r.product.variants.filter((v) => r.private.variants[v.id]?.supplierId === s.id).map((v) => ({ r, v, x: r.private.variants[v.id] })));
  const open = packagesFor(s, orders, records, all, "open");
  const share = mayShareCustomerData(s);
  const caps = capabilityStates(s);
  const hidden = (
    <>
      <input type="hidden" name="id" value={s.id} />
      <input type="hidden" name="rev" value={s.rev} />
    </>
  );

  return (
    <div>
      <OwnerNav current="suppliers" />
      <nav aria-label="Breadcrumb" className="mb-3 text-sm">
        <ol className="flex flex-wrap items-center gap-1.5 text-ink-soft">
          <li>
            <Link href="/partners/review/suppliers" className="font-semibold text-royal hover:underline">
              Suppliers
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="truncate font-semibold text-ink">
            {s.name}
          </li>
        </ol>
      </nav>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[1.85rem] font-bold leading-tight text-ink sm:text-[2.25rem]">{s.name}</h1>
          <p className="mt-1 flex flex-wrap gap-2 text-sm">
            <Pill>{s.status}</Pill>
            <Pill tone={s.agreement.status === "signed" ? "good" : "plain"}>agreement: {s.agreement.status}</Pill>
            {s.archived && <Pill tone="dark">archived</Pill>}
            <span className="text-ink-soft">Saved {dateTime(s.updatedAt)}</span>
          </p>
        </div>
        <form action={archiveSupplierAction}>
          {hidden}
          <button name="archive" value={s.archived ? "no" : "yes"} className={s.archived ? secondary : danger}>
            {s.archived ? "Restore" : "Archive"}
          </button>
        </form>
      </div>
      <Flash ok={one(sp.ok)} error={one(sp.error)} />

      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0 space-y-5">
          <section id="details" className={cn(card, "scroll-mt-28")} aria-labelledby="d">
            <h2 id="d" className="font-display text-lg font-bold text-ink sm:text-xl">Details, terms &amp; agreement</h2>
            <form action={saveSupplierAction} className="mt-3 grid gap-3 sm:grid-cols-2">
              {hidden}
              <Text name="name" title="Business name" value={s.name} required maxLength={100} />
              <Text name="website" title="Website" value={s.website} type="url" placeholder="https://" />
              <Text name="country" title="Country" value={s.country} maxLength={60} />
              <Select name="status" title="Status" value={s.status} options={SUPPLIER_STATUSES.map((x) => ({ value: x, label: x[0].toUpperCase() + x.slice(1) }))} />
              <fieldset className="grid gap-2 sm:col-span-2">
                <legend className="text-sm font-semibold text-ink">Contacts (their business contacts)</legend>
                {[0, 1, 2].map((i) => {
                  const c = s.contacts[i];
                  return (
                    <div key={i} className="grid gap-2 rounded-2xl bg-ice-50 p-2 sm:grid-cols-5">
                      <input name={`c${i}name`} defaultValue={c?.name ?? ""} placeholder="Name" aria-label={`Contact ${i + 1} name`} className={input} />
                      <input name={`c${i}role`} defaultValue={c?.role ?? ""} placeholder="Role" aria-label={`Contact ${i + 1} role`} className={input} />
                      <input name={`c${i}email`} defaultValue={c?.email ?? ""} placeholder="Email" type="email" aria-label={`Contact ${i + 1} email`} className={input} />
                      <input name={`c${i}phone`} defaultValue={c?.phone ?? ""} placeholder="Phone" aria-label={`Contact ${i + 1} phone`} className={input} />
                      <input name={`c${i}channel`} defaultValue={c?.channel ?? ""} placeholder="WhatsApp, WeChat…" aria-label={`Contact ${i + 1} other channel`} className={input} />
                    </div>
                  );
                })}
              </fieldset>
              <Text name="productTypes" title="Product types (comma separated)" value={s.terms.productTypes.join(", ")} maxLength={300} placeholder="slushies, jelly, capsules" className="sm:col-span-2" />
              <Text name="moq" title="Minimum order (units)" value={s.terms.moq ?? ""} inputMode="numeric" />
              <Text name="samplePrice" title="Sample price ($)" value={dollars(s.terms.samplePriceCents)} inputMode="decimal" />
              <Text name="samplePolicy" title="Sample policy" value={s.terms.samplePolicy} maxLength={300} className="sm:col-span-2" />
              <Select name="dropship" title="Dropships to customers?" value={s.terms.dropship} options={[{ value: "unknown", label: "Not confirmed" }, { value: "yes", label: "Yes" }, { value: "no", label: "No" }]} />
              <Select name="tracking" title="Gives tracking numbers?" value={s.terms.tracking} options={[{ value: "unknown", label: "Not confirmed" }, { value: "yes", label: "Yes" }, { value: "no", label: "No" }]} />
              <Text name="processingDays" title="Processing time (business days)" value={s.terms.processingDays ?? ""} inputMode="numeric" />
              <Text name="shipsFrom" title="Ships from" value={s.terms.shipsFrom} maxLength={100} />
              <Text name="firstItemShipping" title="Shipping, first item ($)" value={dollars(s.terms.firstItemShippingCents)} inputMode="decimal" />
              <Text name="additionalItemShipping" title="Shipping, each extra item ($)" value={dollars(s.terms.additionalItemShippingCents)} inputMode="decimal" />
              <Text name="shippingNote" title="Shipping notes" value={s.terms.shippingNote} maxLength={300} className="sm:col-span-2" />
              <Area name="returnPolicy" title="Their return / damaged-item policy" value={s.terms.returnPolicy} maxLength={500} />
              <Area name="paymentTerms" title="Payment terms" value={s.terms.paymentTerms} maxLength={300} />
              <fieldset className="sm:col-span-2">
                <legend className="text-sm font-semibold text-ink">Channels they authorize you to sell on</legend>
                <div className="mt-1 flex flex-wrap gap-3">
                  {CHANNELS.map((c) => (
                    <Check key={c} name={`ch-${c}`} title={c} checked={s.terms.authorizedChannels.includes(c)} />
                  ))}
                </div>
              </fieldset>
              <Text name="termsSource" title="Where these terms came from" value={s.terms.source} maxLength={300} placeholder="e.g. price list PDF 2026-10-20; email from Amy" className="sm:col-span-2" />
              <Select name="agreementStatus" title="Agreement" value={s.agreement.status} options={AGREEMENT_STATUSES.map((x) => ({ value: x, label: x[0].toUpperCase() + x.slice(1) }))} />
              <Text name="signedOn" title="Signed on" value={s.agreement.signedOn} type="date" />
              <Text name="renewOn" title="Review / renew by" value={s.agreement.renewOn} type="date" />
              <Text name="agreementReference" title="Agreement file / reference (private)" value={s.agreement.reference} maxLength={200} />
              <div className="grid gap-2 rounded-2xl bg-ice-50 p-3 sm:col-span-2">
                <p className="text-sm font-semibold text-ink">The signed agreement covers… (only counts when the agreement is signed)</p>
                <Check name="coversCustomerData" title="How they may use customer names and addresses (only to ship our orders)" checked={s.agreement.coversCustomerData} />
                <Check name="coversShipTimes" title="Their processing / ship times" checked={s.agreement.coversShipTimes} />
                <Check name="coversRates" title="Their shipping rates" checked={s.agreement.coversRates} />
              </div>
              <Select name="complianceStatus" title="Compliance documents" value={s.compliance.status} options={["missing", "requested", "received", "verified"].map((x) => ({ value: x, label: x[0].toUpperCase() + x.slice(1) }))} />
              <Text name="originId" title="Shipping origin id (Shipping page)" value={s.originId} maxLength={32} placeholder="supplier-a" />
              <Area name="complianceNotes" title="Compliance notes" value={s.compliance.notes} maxLength={500} />
              <Area name="notes" title="Private notes" value={s.notes} maxLength={2000} />
              <div className="sm:col-span-2">
                <button className={primary}>Save supplier</button>
              </div>
            </form>
          </section>

          <section id="quotes" className={cn(card, "scroll-mt-28")} aria-labelledby="q">
            <h2 id="q" className="font-display text-lg font-bold text-ink sm:text-xl">Quotes ({s.quotes.length})</h2>
            <p className="mt-1 text-sm text-ink-soft">Written prices for products you haven&apos;t linked to a SKU yet. They feed the Compare page.</p>
            {s.quotes.length > 0 && (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[36rem] text-left text-sm">
                  <thead className="text-ink-soft">
                    <tr>
                      <th className="py-1 pr-3">Product</th>
                      <th className="py-1 pr-3">Unit cost</th>
                      <th className="py-1 pr-3">Landed</th>
                      <th className="py-1 pr-3">MOQ</th>
                      <th className="py-1 pr-3">Source</th>
                      <th className="py-1" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sky-100">
                    {s.quotes.map((q) => (
                      <tr key={q.id}>
                        <td className="py-1.5 pr-3 text-ink">
                          {q.product}
                          {q.supplierSku && <span className="block font-mono text-xs text-ink-soft">{q.supplierSku}</span>}
                        </td>
                        <td className="py-1.5 pr-3">{usd(q.unitCostCents) ?? <Missing />}</td>
                        <td className="py-1.5 pr-3">{usd(q.landedCostCents) ?? <Missing />}</td>
                        <td className="py-1.5 pr-3">{q.moq ?? <Missing />}</td>
                        <td className="py-1.5 pr-3 text-ink-soft">{[q.receivedOn, q.source].filter(Boolean).join(" · ") || <Missing />}</td>
                        <td className="py-1.5">
                          <form action={removeQuoteAction}>
                            {hidden}
                            <input type="hidden" name="quote" value={q.id} />
                            <button className="min-h-9 rounded-full px-2 text-xs font-semibold text-[#a3174f] underline-offset-4 hover:underline">Remove</button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <form action={addQuoteAction} className="mt-3 grid gap-2 rounded-2xl bg-ice-50 p-3 sm:grid-cols-4">
              {hidden}
              <Text name="qProduct" title="Product" required maxLength={120} className="sm:col-span-2" />
              <Text name="qSku" title="Their SKU" maxLength={60} />
              <Text name="qType" title="Type" maxLength={60} placeholder="jelly" />
              <Text name="qUnitCost" title="Unit cost ($)" inputMode="decimal" />
              <Text name="qLandedCost" title="Landed cost ($)" inputMode="decimal" />
              <Text name="qMoq" title="MOQ" inputMode="numeric" />
              <Text name="qReceived" title="Received" type="date" />
              <Text name="qSource" title="Source" maxLength={200} className="sm:col-span-3" placeholder="price list PDF, email…" />
              <div className="flex items-end">
                <button className={secondary}>Add quote</button>
              </div>
            </form>
          </section>

          <section id="log" className={cn(card, "scroll-mt-28")} aria-labelledby="l">
            <h2 id="l" className="font-display text-lg font-bold text-ink sm:text-xl">Contact history</h2>
            <form action={addLogAction} className="mt-3 grid gap-2 sm:grid-cols-[10rem_1fr_10rem_auto] sm:items-end">
              {hidden}
              <Select name="channel" title="How" value="email" options={["email", "call", "message", "meeting", "other"].map((x) => ({ value: x, label: x }))} />
              <Text name="summary" title="What was said or agreed" required maxLength={1000} />
              <Text name="followUpOn" title="Follow up on" type="date" />
              <button className={secondary}>Add note</button>
            </form>
            {s.log.length === 0 ? (
              <p className="mt-2 text-sm text-ink-soft">No notes yet.</p>
            ) : (
              <ol className="mt-3 divide-y divide-sky-100 text-sm">
                {s.log.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-start justify-between gap-2 py-2">
                    <span className="min-w-0">
                      <Pill>{e.channel}</Pill> <span className="text-ink">{e.summary}</span>
                      {e.followUpOn && <span className={cn("block text-xs", !e.done && e.followUpOn <= new Date().toISOString().slice(0, 10) ? "font-semibold text-[#a3174f]" : "text-ink-soft")}>Follow up {e.followUpOn}{e.done ? " · done" : ""}</span>}
                    </span>
                    <span className="flex items-center gap-2 text-ink-soft">
                      {dateTime(e.at)}
                      {e.followUpOn && !e.done && (
                        <form action={logDoneAction}>
                          {hidden}
                          <input type="hidden" name="entry" value={e.id} />
                          <button className="min-h-9 rounded-full px-2 text-xs font-semibold text-royal underline-offset-4 hover:underline">Done</button>
                        </form>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section id="docs" className={cn(card, "scroll-mt-28")} aria-labelledby="dc">
            <h2 id="dc" className="font-display text-lg font-bold text-ink sm:text-xl">Private documents ({docs.length})</h2>
            <p className="mt-1 text-sm text-ink-soft">Agreements, price lists, catalogs, certificates, invoices. Stored privately; only you can download them. PDF, photo/scan or CSV, up to 4 MB.</p>
            {docs.length > 0 && (
              <ul className="mt-3 divide-y divide-sky-100 text-sm">
                {docs.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>
                      <Pill>{DOC_KINDS[d.kind]}</Pill>{" "}
                      <a href={`/partners/review/suppliers/${s.id}/docs/${d.id}`} className="font-semibold text-ink underline">
                        {d.name}
                      </a>{" "}
                      <span className="text-ink-soft">
                        {Math.ceil(d.bytes / 1024)} KB · {d.uploadedAt.slice(0, 10)}
                        {d.note ? ` · ${d.note}` : ""}
                      </span>
                    </span>
                    <form action={deleteDocAction} className="flex items-center gap-2">
                      {hidden}
                      <input type="hidden" name="doc" value={d.id} />
                      <label className="flex items-center gap-1 text-xs text-ink">
                        <input type="checkbox" name="confirm" className="size-4" /> sure
                      </label>
                      <button className="min-h-9 rounded-full px-2 text-xs font-semibold text-[#a3174f] underline-offset-4 hover:underline">Delete</button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            <form action={uploadDocAction} className="mt-3 grid gap-2 rounded-2xl bg-ice-50 p-3 sm:grid-cols-3">
              {hidden}
              <label className={cn(label, "sm:col-span-3")}>
                File
                <input name="file" type="file" required accept="application/pdf,image/jpeg,image/png,image/webp,text/csv,.csv" className={fileInput} />
              </label>
              <Select name="kind" title="Kind" value="price-list" options={Object.entries(DOC_KINDS).map(([k, v]) => ({ value: k, label: v }))} />
              <Text name="note" title="Note" maxLength={200} />
              <div className="flex items-end">
                <button className={secondary}>Upload privately</button>
              </div>
            </form>
          </section>
        </div>

        <aside className="space-y-4">
          <section className={card} aria-labelledby="m">
            <h2 id="m" className="font-display text-lg font-bold text-ink">Missing facts ({facts.missing.length})</h2>
            {facts.missing.length ? (
              <ul className="mt-1 list-disc pl-5 text-sm text-ink">
                {facts.missing.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-ink-soft">Everything the comparison uses is filled in.</p>
            )}
          </section>
          <section className={card} aria-labelledby="sk">
            <h2 id="sk" className="font-display text-lg font-bold text-ink">Linked SKUs ({linked.length})</h2>
            {linked.length === 0 ? (
              <p className="mt-1 text-sm text-ink-soft">Link a product variant to this supplier in Products → Variants.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {linked.map(({ r, v, x }) => (
                  <li key={v.id}>
                    <Link href={`/partners/review/products/${r.id}#variants`} className="text-ink underline">
                      {r.product.name} · {v.name}
                    </Link>{" "}
                    <span className="font-mono text-xs text-ink-soft">{v.sku}{x.supplierSku ? ` ↔ ${x.supplierSku}` : ""}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className={card} aria-labelledby="op">
            <h2 id="op" className="font-display text-lg font-bold text-ink">Open packages ({open.length})</h2>
            {open.length === 0 ? (
              <p className="mt-1 text-sm text-ink-soft">None.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {open.map(({ order, group }) => (
                  <li key={`${order.id}-${group.id}`}>
                    <Link href={`/partners/review/orders/${order.stripeCheckoutSessionId}#pkg-${encodeURIComponent(group.id)}`} className="text-ink underline">
                      {order.id}
                    </Link>{" "}
                    <span className="text-ink-soft">{group.supplierOrder ? `placed · ${group.supplierOrder.reference}` : "to place"}</span>
                  </li>
                ))}
              </ul>
            )}
            {share.ok ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <a href={`/partners/review/suppliers/${s.id}/export`} className={secondary} download>
                  Download packages to place (CSV)
                </a>
                <a href={`/partners/review/suppliers/${s.id}/export?phone=1`} className="text-xs font-semibold text-royal underline" download>
                  …with phone numbers (only if they need them)
                </a>
              </div>
            ) : (
              <p className="mt-3 text-xs text-ink-soft">Bulk CSV export is off: {share.reason}</p>
            )}
          </section>
          <section className={card} aria-labelledby="int">
            <h2 id="int" className="font-display text-lg font-bold text-ink">Automation</h2>
            <p className="mt-1 text-xs text-ink-soft">All off. Each needs a signed agreement, a reviewed integration, their credentials as Netlify secrets and your approval. Nothing is sent to suppliers automatically.</p>
            <ul className="mt-2 space-y-1.5 text-sm">
              {caps.map((c) => (
                <li key={c.capability}>
                  <span className="font-semibold text-ink">{CAPABILITY_LABEL[c.capability]}</span> <Pill tone={c.enabled ? "good" : "plain"}>{c.enabled ? "available" : "off"}</Pill>
                  {!c.enabled && <span className="block text-xs text-ink-soft">{c.blockers.slice(0, 3).join(" · ")}</span>}
                </li>
              ))}
            </ul>
          </section>
          <SupplierSummary s={s} />
        </aside>
      </div>
    </div>
  );
}

function SupplierSummary({ s }: { s: Supplier }) {
  return (
    <section className={card} aria-labelledby="sum">
      <h2 id="sum" className="font-display text-lg font-bold text-ink">At a glance</h2>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm text-ink">
        <dt className="font-semibold">MOQ</dt>
        <dd>{s.terms.moq ?? <Missing />}</dd>
        <dt className="font-semibold">Processing</dt>
        <dd>{s.terms.processingDays !== null ? `${s.terms.processingDays} business days` : <Missing />}</dd>
        <dt className="font-semibold">Shipping</dt>
        <dd>{s.terms.firstItemShippingCents !== null ? `${usd(s.terms.firstItemShippingCents)} + ${usd(s.terms.additionalItemShippingCents) ?? "?"} each extra` : <Missing />}</dd>
        <dt className="font-semibold">Dropship</dt>
        <dd>{s.terms.dropship === "unknown" ? <Missing what="Not confirmed" /> : s.terms.dropship}</dd>
        <dt className="font-semibold">Tracking</dt>
        <dd>{s.terms.tracking === "unknown" ? <Missing what="Not confirmed" /> : s.terms.tracking}</dd>
        <dt className="font-semibold">Agreement</dt>
        <dd>
          {s.agreement.status}
          {s.agreement.signedOn ? ` (${s.agreement.signedOn})` : ""}
        </dd>
      </dl>
    </section>
  );
}
