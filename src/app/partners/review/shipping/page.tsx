import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { reviewConfig } from "@/lib/partners/config";
import { requireReviewer } from "@/lib/partners/review-auth";
import { ownerDataStore } from "@/lib/owner/data";
import { SHIPPING_ORIGINS, ORIGIN_PROBLEM_TEXT, originProblem, type ShippingOrigin } from "@/commerce/origins";
import { SHIPPING_LOCK_TEXT, shippingApprovalStatus } from "@/commerce/shipping-approval";
import { draftStatus, loadDraft, previewQuote, type DraftOrigin } from "@/commerce/shipping-admin";
import { formatMoney } from "@/commerce/availability";
import { ReviewLogin } from "@/components/partners/ReviewLogin";
import { OwnerNav } from "@/components/owner/OwnerNav";
import { Area, Check, Select, Text } from "@/components/owner/Fields";
import { Flash, Missing, OwnerShell, PageTitle, Pill, card, dateTime, input, one, primary, secondary } from "@/components/owner/OwnerUi";
import { cn } from "@/components/owner/cn";
import { removeOriginAction, resetDraftAction, saveOriginAction } from "./actions";

export const metadata: Metadata = { title: "Shipping", robots: { index: false, follow: false } };

/**
 * PRIVATE: where items ship from and what each place charges — the live table
 * customers are charged from, and a private draft to prepare changes in.
 * Nothing here is guessed: an origin with no verified rates can't be checked out.
 */
export default function ShippingPage({ searchParams }: PageProps<"/partners/review/shipping">) {
  if (!reviewConfig()) notFound();
  return (
    <OwnerShell>
      <Shipping searchParams={searchParams} />
    </OwnerShell>
  );
}

const usd = (cents: number) => formatMoney({ amount: cents, currency: "USD" });
const dollars = (c: number | undefined) => (c === undefined ? "" : (c / 100).toFixed(2));

function RuleText({ o }: { o: ShippingOrigin }) {
  const r = o.rule;
  if (!r) return <Missing what="No verified rates" />;
  if (r.kind === "per-item") return <>{usd(r.firstItemCents)} first item + {usd(r.additionalItemCents)} each extra (up to {r.maxItemsPerPackage} per package)</>;
  return <>By packed weight (+{r.packagingGrams} g packaging): {r.tiers.map((t) => `≤${t.upToGrams} g ${usd(t.cents)}`).join(" · ")}</>;
}

async function Shipping({ searchParams }: { searchParams: PageProps<"/partners/review/shipping">["searchParams"] }) {
  await connection();
  const ctx = await requireReviewer();
  if (!ctx) return <ReviewLogin />;
  const sp = await searchParams;
  const now = new Date();
  const approval = shippingApprovalStatus(SHIPPING_ORIGINS, process.env, now);
  const draft = await loadDraft(await ownerDataStore(ctx.cfg), SHIPPING_ORIGINS);
  let status: ReturnType<typeof draftStatus> | null = null;
  let draftError: string | null = null;
  try {
    status = draftStatus(draft, SHIPPING_ORIGINS, now);
  } catch (e) {
    draftError = (e as Error).message;
  }

  // Example cart from the query string: ?o1=funksquish&g1=120&q1=2&o2=…
  const items = [1, 2, 3]
    .map((i) => ({ originId: one(sp[`o${i}`]) ?? "", grams: one(sp[`g${i}`]) ? Number(one(sp[`g${i}`])) : null, quantity: Number(one(sp[`q${i}`]) ?? "0") }))
    .filter((x) => x.originId && Number.isInteger(x.quantity) && x.quantity > 0 && x.quantity <= 50 && (x.grams === null || (Number.isInteger(x.grams) && x.grams > 0 && x.grams < 30_000)));
  const preview = items.length && !draftError ? previewQuote(draft, items, now) : null;

  return (
    <div>
      <OwnerNav current="shipping" />
      <PageTitle
        title="Shipping"
        lead="Each place items ship from (your studio, each supplier) is an origin with its own rates, processing time and verification. A cart with items from two origins ships as two packages, each charged separately and shown to the customer before they pay."
      />
      <Flash ok={one(sp.ok)} error={one(sp.error)} />

      <h2 className="mb-3 font-display text-2xl font-bold text-ink">Live table (what customers are charged)</h2>
      <ul className="grid gap-4">
        {SHIPPING_ORIGINS.map((o) => {
          const problem = originProblem(o, now, o.source);
          return (
            <li key={o.id} className={cn(card, problem ? "ring-2 ring-lemon" : "")}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-lg font-bold text-ink sm:text-xl">
                  {o.publicLabel} <span className="font-mono text-sm font-normal text-ink-soft">({o.id})</span>
                </h3>
                <Pill tone={problem ? "warn" : "good"}>{problem ? "Can't be checked out yet" : "Ready"}</Pill>
              </div>
              {problem && <p className="mt-1 text-sm font-semibold text-ink">{ORIGIN_PROBLEM_TEXT[problem]}</p>}
              <dl className="mt-3 grid gap-x-4 gap-y-1.5 text-sm text-ink sm:grid-cols-[auto_1fr]">
                <dt className="font-semibold">Ships</dt>
                <dd>{o.source === "in_house" ? "Your own stock" : "A supplier ships it"}</dd>
                <dt className="font-semibold">Rates</dt>
                <dd>
                  <RuleText o={o} />
                </dd>
                <dt className="font-semibold">Verified</dt>
                <dd>{o.verified ? `${o.verified.on} by ${o.verified.by} (evidence: ${o.verified.evidence}) · re-check every ${o.reviewEveryDays} days` : <Missing what="Not verified" />}</dd>
                <dt className="font-semibold">Processing time</dt>
                <dd>{o.processingBusinessDays ? `${o.processingBusinessDays} business day(s) from payment to the carrier` : <Missing />}</dd>
                <dt className="font-semibold">APO/FPO/DPO</dt>
                <dd>{o.militaryAddresses ? "Ships to military addresses" : "Doesn't ship to military addresses"}</dd>
                {o.source === "supplier" && (
                  <>
                    <dt className="font-semibold">Agreement</dt>
                    <dd>{o.agreementOnFile ? "Signed agreement on file" : <Missing what="No signed agreement" />}</dd>
                  </>
                )}
                <dt className="font-semibold">Free shipping</dt>
                <dd>{o.zeroCostConfirmed ? "A $0 charge is confirmed in writing" : "Never assumed — a $0 rate needs written confirmation"}</dd>
              </dl>
            </li>
          );
        })}
      </ul>

      <section aria-labelledby="appr" className={cn(card, "mt-5")}>
        <h2 id="appr" className="font-display text-lg font-bold text-ink sm:text-xl">Approval for live checkout</h2>
        <p className="mt-1 text-sm text-ink">
          Places with verified, current rates: <strong>{approval.verifiedOrigins}</strong> of {SHIPPING_ORIGINS.length}. {approval.problem ? SHIPPING_LOCK_TEXT[approval.problem] : "Live checkout may use this table."}
        </p>
        <p className="mt-2 text-sm text-ink">
          This table&apos;s approval code: <span className="select-all font-mono">{approval.fingerprint}</span>. Production value of <span className="font-mono">STRIPE_LIVE_SHIPPING_TABLE</span>:{" "}
          {approval.approval === "matches" ? "matches ✓" : approval.approval === "different" ? "different — rates changed since you approved them" : "not set"}.
        </p>
      </section>

      <section id="draft" aria-labelledby="dr" className={cn(card, "mt-8 scroll-mt-2 ring-2 ring-sky-300")}>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="dr" className="font-display text-2xl font-bold text-ink">Draft changes (private)</h2>
            <p className="text-sm text-ink-soft">{draft.rev ? `Saved ${dateTime(draft.updatedAt)} · revision ${draft.rev}` : "No changes yet — this is a copy of the live table."}</p>
          </div>
          {draft.rev > 0 && (
            <form action={resetDraftAction} className="flex items-center gap-2">
              <input type="hidden" name="rev" value={draft.rev} />
              <Check name="confirm" title="Throw away the draft" />
              <button className={secondary}>Reset</button>
            </form>
          )}
        </div>
        {draftError && <p className="mt-2 rounded-xl bg-berry-soft p-3 text-sm font-semibold text-ink">The draft isn&apos;t valid: {draftError}</p>}
        <div className="mt-4 grid gap-4">
          {draft.origins.map((o) => {
            const st = status?.origins.find((x) => x.origin.id === o.id);
            return (
              <details key={o.id} className="rounded-2xl bg-ice-50 p-3 ring-1 ring-inset ring-sky-200">
                <summary className="flex cursor-pointer flex-wrap items-center gap-2 font-semibold text-ink">
                  {o.publicLabel} <span className="font-mono text-sm text-ink-soft">({o.id})</span>
                  {st?.changed.length ? <Pill tone="warn">changed: {st.changed.join(", ")}</Pill> : <Pill>same as live</Pill>}
                  {st?.problem && <Pill tone="alert">not checkout-ready</Pill>}
                </summary>
                {st?.problem && <p className="mt-2 text-sm text-ink">{st.problem}</p>}
                <OriginForm o={o} rev={draft.rev} />
                {o.id !== "funksquish" && (
                  <form action={removeOriginAction} className="mt-2">
                    <input type="hidden" name="existingId" value={o.id} />
                    <input type="hidden" name="rev" value={draft.rev} />
                    <button className="text-sm font-semibold text-[#a3174f] underline">Remove from draft</button>
                  </form>
                )}
              </details>
            );
          })}
          <details className="rounded-2xl p-3 ring-2 ring-dashed ring-sky-200">
            <summary className="cursor-pointer font-display font-semibold text-royal">+ Add a supplier origin</summary>
            <p className="mt-2 text-sm text-ink-soft">Only after a signed agreement and a written rate card exist. The id and label are public: never use the supplier&apos;s name (e.g. id supplier-a, label &ldquo;a FunkSquish supplier partner&rdquo;).</p>
            <OriginForm rev={draft.rev} />
          </details>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <form action="/partners/review/shipping#preview" className="grid gap-2 rounded-2xl bg-white p-3 ring-1 ring-inset ring-sky-200" id="preview">
            <h3 className="font-display text-lg font-bold text-ink">Preview an example cart</h3>
            <p className="text-xs text-ink-soft">Example items only — type a weight and quantity per line. Prices come from the draft above.</p>
            {[1, 2, 3].map((i) => (
              <div key={i} className="grid grid-cols-3 gap-2">
                <select name={`o${i}`} defaultValue={one(sp[`o${i}`]) ?? (i === 1 ? "funksquish" : "")} aria-label={`Example item ${i} origin`} className={input}>
                  <option value="">—</option>
                  {draft.origins.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.id}
                    </option>
                  ))}
                </select>
                <input name={`g${i}`} defaultValue={one(sp[`g${i}`]) ?? ""} placeholder="grams" inputMode="numeric" aria-label={`Example item ${i} weight in grams`} className={input} />
                <input name={`q${i}`} defaultValue={one(sp[`q${i}`]) ?? ""} placeholder="qty" inputMode="numeric" aria-label={`Example item ${i} quantity`} className={input} />
              </div>
            ))}
            <button className={secondary}>Price example cart</button>
            {preview &&
              (preview.ok ? (
                <div className="rounded-xl bg-mint-soft/60 p-3 text-sm text-ink">
                  <p className="font-semibold">Example total shipping: {usd(preview.quote.totalCents)}</p>
                  {preview.unverified.length > 0 && <p className="font-semibold text-[#a3174f]">Not verified yet: {preview.unverified.join(", ")} — priced here for checking, but checkout won&apos;t use these rates until they&apos;re verified and applied.</p>}
                  <ul className="mt-1 list-disc pl-5">
                    {preview.quote.packages.map((p) => (
                      <li key={p.groupId}>
                        {p.label} ({p.originId}): {p.units} unit(s){p.packedGrams ? `, ${p.packedGrams} g packed` : ""} — {usd(p.cents)}, ships within {p.processingBusinessDays} business day(s)
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="rounded-xl bg-berry-soft p-3 text-sm text-ink">
                  <p className="font-semibold">{preview.message}</p>
                  <ul className="mt-1 list-disc pl-5">
                    {preview.blocked.map((b) => (
                      <li key={b.variantId}>
                        {b.name}: {b.ownerDetail}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
          </form>

          <section className="grid content-start gap-2 rounded-2xl bg-white p-3 ring-1 ring-inset ring-sky-200" aria-labelledby="apply">
            <h3 id="apply" className="font-display text-lg font-bold text-ink">Apply the draft</h3>
            {status?.unchanged ? (
              <p className="text-sm text-ink-soft">The draft matches the live table — nothing to apply.</p>
            ) : (
              <>
                <p className="text-sm text-ink">
                  New approval code: <span className="select-all font-mono">{status?.draftFingerprint ?? "—"}</span> (live: <span className="font-mono">{status?.liveFingerprint}</span>)
                </p>
                <ol className="list-decimal space-y-1 pl-5 text-sm text-ink">
                  <li>Check every change above against the carrier quote or the supplier&apos;s written rate card.</li>
                  <li>
                    <a href="/partners/review/shipping/export" download className="font-semibold text-royal underline">
                      Download shipping-origins.json
                    </a>{" "}
                    (public fields only — no names, costs or notes).
                  </li>
                  <li>
                    In GitHub, replace <span className="font-mono">src/commerce/data/shipping-origins.json</span> with it on a new branch and open a pull request. The site checks the file when it builds.
                  </li>
                  <li>
                    Once that&apos;s merged and deployed, set <span className="font-mono">STRIPE_LIVE_SHIPPING_TABLE</span> to the new code for Production (only when live checkout is approved). Until it matches, live checkout stays closed.
                  </li>
                </ol>
                {status?.removed.length ? <p className="text-sm font-semibold text-[#a3174f]">Removed in the draft: {status.removed.join(", ")} — products using them stop being checkout-ready.</p> : null}
              </>
            )}
            <p className="text-xs text-ink-soft">Why not instant? This changes what customers pay, so it goes through a reviewed deploy and your approval code — a rate can never change on customers without you seeing it first.</p>
          </section>
        </div>
      </section>
    </div>
  );
}

function OriginForm({ o, rev }: { o?: DraftOrigin; rev: number }) {
  const r = o?.rule;
  return (
    <form action={saveOriginAction} className="mt-3 grid gap-2 sm:grid-cols-3">
      <input type="hidden" name="rev" value={rev} />
      {o && <input type="hidden" name="existingId" value={o.id} />}
      {!o && <Text name="id" title="Origin id (public)" required maxLength={31} placeholder="supplier-a" />}
      {!o && <input type="hidden" name="source" value="supplier" />}
      <Text name="publicLabel" title="Label customers see" value={o?.publicLabel ?? "a FunkSquish supplier partner"} required maxLength={60} className={o ? "sm:col-span-2" : ""} />
      <Text name="carrierService" title="Carrier service (private)" value={o?.carrierService} maxLength={100} placeholder="USPS Ground Advantage" />
      <Select
        name="ruleKind"
        title="How it's priced"
        value={r?.kind ?? ""}
        options={[
          { value: "", label: "No rates yet (can't be checked out)" },
          { value: "per-item", label: "Per item (first + each extra)" },
          { value: "weight", label: "By packed weight (tiers)" },
        ]}
      />
      <Text name="firstItem" title="Per item: first ($)" value={r?.kind === "per-item" ? dollars(r.firstItemCents) : ""} inputMode="decimal" />
      <Text name="additionalItem" title="Per item: each extra ($)" value={r?.kind === "per-item" ? dollars(r.additionalItemCents) : ""} inputMode="decimal" />
      <Text name="maxItems" title="Per item: most per package" value={r?.kind === "per-item" ? r.maxItemsPerPackage : ""} inputMode="numeric" />
      <Text name="packagingGrams" title="Weight: packaging (g)" value={r?.kind === "weight" ? r.packagingGrams : ""} inputMode="numeric" />
      <Area name="tiers" title="Weight tiers (one per line: grams = $)" value={r?.kind === "weight" ? r.tiers.map((t) => `${t.upToGrams} = ${(t.cents / 100).toFixed(2)}`).join("\n") : ""} rows={3} />
      <Text name="processingBusinessDays" title="Processing time (business days)" value={o?.processingBusinessDays ?? ""} inputMode="numeric" />
      <Text name="reviewEveryDays" title="Re-check rates every (days)" value={o?.reviewEveryDays ?? 90} inputMode="numeric" />
      <Text name="verifiedOn" title="Rates verified on" value={o?.verified?.on} type="date" />
      <Text name="verifiedBy" title="Verified by" value={o?.verified?.by} maxLength={60} placeholder="owner" />
      <Text name="evidence" title="Evidence (where the quote/rate card is)" value={o?.verified?.evidence} maxLength={200} placeholder="private/shipping/usps-quote-2026-11.pdf" className="sm:col-span-2" />
      <div className="grid gap-2 sm:col-span-3">
        <Check name="militaryAddresses" title="Ships to APO/FPO/DPO addresses" checked={o?.militaryAddresses ?? false} />
        {(o?.source ?? "supplier") === "supplier" && <Check name="agreementOnFile" title="Signed agreement on file (ship times, rates, limited use of customer addresses)" checked={o?.agreementOnFile ?? false} />}
        <Check name="zeroCostConfirmed" title="A $0 (free) charge is confirmed in writing" checked={o?.zeroCostConfirmed ?? false} hint="Free shipping is never assumed. Tick only if a tier or rate is $0 and you have it in writing." />
      </div>
      <Area name="notes" title="Private notes (packaging, restrictions…)" value={o?.notes} rows={2} className="sm:col-span-3" />
      <div className="sm:col-span-3">
        <button className={primary}>{o ? "Save to draft" : "Add to draft"}</button>
      </div>
    </form>
  );
}
