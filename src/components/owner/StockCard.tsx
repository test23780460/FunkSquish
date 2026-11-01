import { randomUUID } from "node:crypto";
import { adjustAction, pauseAction, releaseCanceledAction, resumeAction, tiktokListedAction, undoAction } from "@/app/partners/review/inventory/actions";
import { ACTION_WARNINGS, KIND_LABEL, type StockRow } from "@/commerce/orders/stock-admin";
import { cn } from "@/lib/cn";
import { Pill, card, danger as dangerBtn, input, primary, secondary } from "./OwnerUi";

/**
 * One item on the private inventory page (server component: plain forms, no
 * client JavaScript needed, works on a phone during a TikTok LIVE). Every
 * form carries a fresh random request id, so a double-tap records once.
 */

const field = cn(input, "min-h-12 text-lg");
const small = "min-h-11 px-4 text-sm";
const fmt = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });

function Hidden({ row, back }: { row: StockRow; back: string }) {
  return (
    <>
      <input type="hidden" name="variant" value={row.variantId} />
      <input type="hidden" name="back" value={back} />
    </>
  );
}

function Adjust({ row, back, kind, label, hint, tone = "plain" }: { row: StockRow; back: string; kind: string; label: string; hint?: string; tone?: "plain" | "danger" }) {
  return (
    <form action={adjustAction} className="grid gap-1.5">
      <Hidden row={row} back={back} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="requestId" value={randomUUID()} />
      <label className="text-sm font-semibold text-ink" htmlFor={`${kind}-${row.variantId}`}>
        {label}
      </label>
      <div className="flex gap-2">
        <input id={`${kind}-${row.variantId}`} name="quantity" type="number" inputMode="numeric" min={kind === "count" ? 0 : 1} max={10000} required defaultValue={kind === "count" ? (row.onHand ?? "") : undefined} placeholder={kind === "count" ? "Counted" : "Units"} className={cn(field, "w-28")} />
        <input name="note" maxLength={200} placeholder="Note (optional)" aria-label={`${label}: note`} className={field} />
        <button type="submit" className={cn(tone === "danger" ? dangerBtn : primary, small, "min-h-12 shrink-0")}>
          Save
        </button>
      </div>
      {hint && <p className="text-xs text-ink-soft">{hint}</p>}
    </form>
  );
}

export function StockCard({ row, back, now, conflict }: { row: StockRow; back: string; /** Render time (ms), from the page. */ now: number; conflict?: { kind: string; quantity: string; requestId: string; error: string } }) {
  const urgent = row.warnings.filter((w) => ACTION_WARNINGS.has(w.code));
  const reminders = row.warnings.filter((w) => !ACTION_WARNINGS.has(w.code));
  return (
    <li id={`v-${row.variantId}`} className={cn(card, "scroll-mt-28 p-4 sm:p-5", urgent.some((w) => w.code === "oversold" || w.code === "both-channels-low") && "ring-2 ring-[#d62f6d]")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display text-lg font-bold leading-tight text-ink">{row.productName}</p>
          <p className="text-sm text-ink-soft">
            {row.variantName} · <span className="font-mono">{row.sku}</span>
            {row.supplier ? " · supplier stock" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {row.paused && <Pill tone="warn">Paused on website</Pill>}
          {row.tiktok && <Pill tone="dark">On TikTok</Pill>}
          {!row.published && <Pill>Draft</Pill>}
          {!row.websiteSellable && <Pill>Not for sale on website</Pill>}
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-ice-50 p-2.5 ring-1 ring-inset ring-sky-100">
          <dt className="text-xs font-semibold text-ink-soft">On the shelf</dt>
          <dd className="font-display text-2xl font-bold tabular-nums text-ink">{row.onHand ?? "?"}</dd>
        </div>
        <div className="rounded-2xl bg-ice-50 p-2.5 ring-1 ring-inset ring-sky-100">
          <dt className="text-xs font-semibold text-ink-soft">Website orders</dt>
          <dd className="font-display text-2xl font-bold tabular-nums text-ink">{row.sold}</dd>
          <dd className="text-xs text-ink-soft">to ship{row.held ? ` · ${row.held} in checkout` : ""}</dd>
        </div>
        <div className={cn("rounded-2xl p-2.5 ring-1 ring-inset", row.free === 0 ? "bg-berry-soft ring-[#f2b9cd]" : row.free <= 3 ? "bg-lemon-soft ring-[#f3dd8a]" : "bg-mint-soft ring-[#9fe3cf]")}>
          <dt className="text-xs font-semibold text-ink">Free to sell</dt>
          <dd className="font-display text-2xl font-bold tabular-nums text-ink">{row.free}</dd>
        </div>
      </dl>
      {!row.managed && row.onHand !== null && <p className="mt-2 text-xs text-ink-soft">Using the catalog&apos;s count until you change it here.</p>}

      {urgent.length > 0 && (
        <ul className="mt-3 space-y-1" aria-label="Needs attention">
          {urgent.map((w) => (
            <li key={w.code} className="rounded-xl bg-berry-soft px-3 py-2 text-sm font-semibold text-ink ring-1 ring-inset ring-[#f2b9cd]">
              {w.text}
            </li>
          ))}
        </ul>
      )}

      {conflict && (
        <form action={adjustAction} className="mt-3 grid gap-2 rounded-2xl bg-lemon-soft p-3 ring-1 ring-inset ring-[#f3dd8a]" aria-label="Confirm">
          <p role="alert" className="text-sm font-semibold text-ink">
            {conflict.error} Record it anyway? Those website customers may need a refund.
          </p>
          <Hidden row={row} back={back} />
          <input type="hidden" name="kind" value={conflict.kind} />
          <input type="hidden" name="quantity" value={conflict.quantity} />
          <input type="hidden" name="requestId" value={conflict.requestId} />
          <input type="hidden" name="force" value="yes" />
          <button type="submit" className={cn(primary, small, "justify-self-start bg-[#a3174f] shadow-[0_2px_0_#6b0f34]")}>
            Yes, record {KIND_LABEL[conflict.kind as keyof typeof KIND_LABEL]?.toLowerCase() ?? "it"} ({conflict.quantity})
          </button>
        </form>
      )}

      <div className="mt-3 grid gap-2 sm:grid-cols-[auto_1fr] sm:items-end">
        <form action={adjustAction}>
          <Hidden row={row} back={back} />
          <input type="hidden" name="kind" value="tiktok-sale" />
          <input type="hidden" name="quantity" value="1" />
          <input type="hidden" name="requestId" value={randomUUID()} />
          <button type="submit" className="inline-flex min-h-14 w-full items-center justify-center rounded-full bg-ink px-6 font-display text-lg font-semibold text-white shadow-[0_5px_0_#000c24] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-royal active:translate-y-1 active:shadow-[0_1px_0_#000c24] motion-reduce:active:translate-y-0 sm:w-auto">
            Sold 1 on TikTok
          </button>
        </form>
        <Adjust row={row} back={back} kind="tiktok-sale" label="Sold more than one on TikTok" />
      </div>

      <details className="mt-3 rounded-2xl bg-ice-50/80 p-3 ring-1 ring-inset ring-sky-100">
        <summary className="flex min-h-9 cursor-pointer items-center font-display font-semibold text-royal">Update stock, pause, history</summary>
        <div className="mt-3 grid gap-4">
          <Adjust row={row} back={back} kind="received" label="Stock arrived" />
          <Adjust row={row} back={back} kind="returned" label="Returned to stock (inspected, can be resold)" />
          <Adjust row={row} back={back} kind="damaged" label="Damaged (can't sell)" tone="danger" />
          <Adjust row={row} back={back} kind="lost" label="Lost or missing" tone="danger" />
          <Adjust row={row} back={back} kind="count" label="Set count (what's physically on the shelf)" hint="Count every unit, including ones for website orders that haven't shipped yet. Leave out anything already packed for a TikTok order." />

          <div className="flex flex-wrap gap-2">
            {row.paused ? (
              <form action={resumeAction}>
                <Hidden row={row} back={back} />
                <button type="submit" className={cn(secondary, small, "bg-mint-soft ring-[#9fe3cf]")}>Put back on sale on the website</button>
              </form>
            ) : (
              <form action={pauseAction} className="flex flex-wrap gap-2">
                <Hidden row={row} back={back} />
                <input name="reason" maxLength={120} placeholder="Why (optional)" aria-label="Why pause" className={cn(input, "w-44")} />
                <button type="submit" className={cn(secondary, small, "bg-lemon-soft ring-[#f3dd8a]")}>Pause on website</button>
              </form>
            )}
            <form action={tiktokListedAction}>
              <Hidden row={row} back={back} />
              <input type="hidden" name="listed" value={row.tiktok ? "no" : "yes"} />
              <button type="submit" className={cn(secondary, small)}>{row.tiktok ? "Not listed on TikTok Shop" : "Listed on TikTok Shop"}</button>
            </form>
            {row.warnings.some((w) => w.code === "reserved-for-canceled") && (
              <form action={releaseCanceledAction}>
                <Hidden row={row} back={back} />
                <button type="submit" className={cn(secondary, small)}>Release units from canceled orders</button>
              </form>
            )}
          </div>

          {reminders.length > 0 && <p className="text-sm text-ink-soft">{reminders.map((w) => w.text).join(" ")}</p>}

          <div>
            <p className="text-sm font-semibold text-ink">Recent changes</p>
            {row.recent.length === 0 ? (
              <p className="text-sm text-ink-soft">None yet.</p>
            ) : (
              <ul className="mt-1 divide-y divide-sky-100 text-sm">
                {row.recent.slice(0, 8).map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                    <span className={cn("text-ink", a.undoneBy && "line-through opacity-60")}>
                      {fmt(a.at)} · {KIND_LABEL[a.kind]} {a.delta > 0 ? `+${a.delta}` : a.delta} → {a.onHandAfter}
                      {a.source === "live" ? " · LIVE" : a.source === "website" ? ` · ${a.orderId ?? "website"}` : ""}
                      {a.note ? ` · ${a.note}` : ""}
                    </span>
                    {!a.undoneBy && a.source !== "website" && a.kind !== "undo" && now - Date.parse(a.at) < 86_400_000 && (
                      <form action={undoAction}>
                        <Hidden row={row} back={back} />
                        <input type="hidden" name="adjustment" value={a.id} />
                        <button type="submit" className="min-h-9 rounded-full px-2 text-sm font-semibold text-royal underline-offset-4 hover:underline">Undo</button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </details>
    </li>
  );
}
