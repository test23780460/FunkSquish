import Link from "next/link";
import type { FulfillmentGroup, Order } from "@/commerce/orders/types";
import { EXCEPTION_KINDS } from "@/commerce/orders/supplier-orders";
import { mayShareCustomerData, type Supplier } from "@/commerce/suppliers/supplier";
import { placeWithSupplierAction, supplierCanceledAction, supplierExceptionAction, supplierUpdateAction } from "@/app/partners/review/orders/actions";
import { Pill, input, label, primary, secondary } from "./OwnerUi";

/**
 * The manual supplier steps for one supplier-shipped package, on the order
 * page: record the order you placed, the supplier's updates and problems,
 * then their tracking (in the usual "Mark shipped" form below).
 */
export function SupplierPackagePanel({ order, group, suppliers, suggested }: { order: Order; group: FulfillmentGroup; suppliers: Supplier[]; suggested: string | null }) {
  const so = group.supplierOrder;
  const supplier = so ? suppliers.find((s) => s.id === so.supplierId) : null;
  const paid = order.status !== "canceled" && (order.paymentStatus === "paid" || order.paymentStatus === "partially_refunded");
  const hidden = (
    <>
      <input type="hidden" name="session" value={order.stripeCheckoutSessionId} />
      <input type="hidden" name="group" value={group.id} />
    </>
  );
  const share = supplier ? mayShareCustomerData(supplier) : null;

  return (
    <div className="mt-3 grid gap-3 rounded-xl bg-white p-3 ring-1 ring-inset ring-lemon">
      <p className="font-display font-semibold text-ink">
        Supplier order {so ? <Pill tone={so.status === "problem" ? "alert" : so.status === "canceled" ? "plain" : "warn"}>{so.status}</Pill> : <Pill tone="warn">not placed yet</Pill>}
      </p>
      {!so || so.status === "canceled" ? (
        paid ? (
          <form action={placeWithSupplierAction} className="grid gap-2 sm:grid-cols-2">
            {hidden}
            <p className="text-sm text-ink-soft sm:col-span-2">
              Nothing is ordered from suppliers automatically. Place it on their site or by email, then record it here. Share only what they need to ship (name and address) and only with a supplier whose signed agreement limits how they use it.
            </p>
            <label className={label}>
              Supplier
              <select name="supplierId" required defaultValue={suggested ?? ""} className={input}>
                <option value="" disabled>
                  {suppliers.length ? "Choose" : "Add the supplier first"}
                </option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={label}>
              Their order number
              <input name="reference" required maxLength={60} className={input} placeholder="e.g. PO-10432" />
            </label>
            <label className={label}>
              They&apos;ll ship by (optional)
              <input name="expectedShipBy" type="date" className={input} />
            </label>
            <label className="flex items-start gap-2 text-sm text-ink sm:col-span-2">
              <input type="checkbox" name="placed" className="mt-0.5 size-5" /> I placed this order with the supplier myself, once (check you haven&apos;t already).
            </label>
            <div className="sm:col-span-2">
              <button className={primary}>Record supplier order</button>
            </div>
          </form>
        ) : (
          <p className="text-sm font-semibold text-[#b8215a]">This order isn&apos;t paid or was canceled — don&apos;t place it with a supplier.</p>
        )
      ) : (
        <>
          <p className="text-sm text-ink">
            {supplier ? (
              <Link href={`/partners/review/suppliers/${supplier.id}`} className="font-semibold underline">
                {supplier.name}
              </Link>
            ) : (
              "Supplier (removed)"
            )}{" "}
            · order <span className="font-mono">{so.reference}</span> · placed {so.placedAt.slice(0, 10)}
            {so.expectedShipBy ? ` · they said they'd ship by ${so.expectedShipBy}` : ""}
          </p>
          {share && !share.ok && <p className="text-sm font-semibold text-[#b8215a]">Customer details: {share.reason} Don&apos;t send them this customer&apos;s name or address until that&apos;s fixed.</p>}
          {so.updates.length > 1 && (
            <ul className="text-xs text-ink-soft">
              {so.updates.slice(1).map((u, i) => (
                <li key={i}>
                  {u.at.slice(0, 10)} · {u.status}
                  {u.note ? ` — ${u.note}` : ""}
                </li>
              ))}
            </ul>
          )}
          {so.exceptions.length > 0 && (
            <ul className="grid gap-1">
              {so.exceptions.map((x) => (
                <li key={x.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <Pill tone={x.resolvedAt ? "plain" : "alert"}>{EXCEPTION_KINDS[x.kind]}</Pill>
                  <span className="text-ink">{x.note}</span>
                  {!x.resolvedAt ? (
                    <form action={supplierExceptionAction}>
                      {hidden}
                      <input type="hidden" name="exception" value={x.id} />
                      <button className="text-xs font-semibold text-royal underline">Mark resolved</button>
                    </form>
                  ) : (
                    <span className="text-xs text-ink-soft">resolved {x.resolvedAt.slice(0, 10)}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {so.status !== "shipped" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <form action={supplierUpdateAction} className="grid gap-2">
                {hidden}
                <label className={label}>
                  Supplier update
                  <select name="status" className={input} defaultValue="confirmed">
                    <option value="confirmed">They confirmed it</option>
                    <option value="processing">They&apos;re preparing it</option>
                    <option value="problem">There&apos;s a problem</option>
                  </select>
                </label>
                <input name="note" maxLength={300} placeholder="Note (no customer details)" aria-label="Update note" className={input} />
                <input name="expectedShipBy" type="date" aria-label="New expected ship date" className={input} />
                <button className={secondary}>Save update</button>
              </form>
              <form action={supplierExceptionAction} className="grid gap-2">
                {hidden}
                <label className={label}>
                  Flag a problem
                  <select name="kind" className={input} defaultValue="delay">
                    {Object.entries(EXCEPTION_KINDS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
                <input name="note" required maxLength={300} placeholder="What happened" aria-label="Problem description" className={input} />
                <button className={secondary}>Flag problem</button>
              </form>
              <form action={supplierCanceledAction} className="grid gap-2 sm:col-span-2">
                {hidden}
                <label className="flex items-start gap-2 text-sm text-ink">
                  <input type="checkbox" name="confirm" className="mt-0.5 size-5" /> The supplier order was canceled (they canceled, or I canceled it with them)
                </label>
                <button className="justify-self-start text-sm font-semibold text-[#b8215a] underline">Record supplier cancellation</button>
              </form>
            </div>
          )}
          {so.status !== "shipped" && <p className="text-xs text-ink-soft">When they send tracking, enter it in &ldquo;Mark shipped&rdquo; below — the customer gets the shipping email for this package.</p>}
        </>
      )}
    </div>
  );
}
