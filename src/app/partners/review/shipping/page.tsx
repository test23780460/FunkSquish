import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { reviewConfig } from "@/lib/partners/config";
import { requireReviewer } from "@/lib/partners/review-auth";
import { SHIPPING_ORIGINS, ORIGIN_PROBLEM_TEXT, originProblem, type ShippingOrigin } from "@/commerce/origins";
import { SHIPPING_LOCK_TEXT, shippingApprovalStatus } from "@/commerce/shipping-approval";
import { formatMoney } from "@/commerce/availability";
import { ReviewLogin } from "@/components/partners/ReviewLogin";
import { OwnerNav } from "@/components/owner/OwnerNav";
import { Missing, OwnerShell, PageTitle, Pill, card } from "@/components/owner/OwnerUi";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Shipping", robots: { index: false, follow: false } };

/**
 * PRIVATE: where items ship from and what each place charges. Nothing here
 * is guessed: an origin with no verified rates simply can't be checked out.
 */
export default function ShippingPage() {
  if (!reviewConfig()) notFound();
  return (
    <OwnerShell>
      <Shipping />
    </OwnerShell>
  );
}

const usd = (cents: number) => formatMoney({ amount: cents, currency: "USD" });

function RuleText({ o }: { o: ShippingOrigin }) {
  const r = o.rule;
  if (!r) return <Missing what="No verified rates" />;
  if (r.kind === "per-item") return <>{usd(r.firstItemCents)} first item + {usd(r.additionalItemCents)} each extra (up to {r.maxItemsPerPackage} per package)</>;
  return (
    <>
      By packed weight (+{r.packagingGrams} g packaging): {r.tiers.map((t) => `≤${t.upToGrams} g ${usd(t.cents)}`).join(" · ")}
    </>
  );
}

async function Shipping() {
  await connection();
  if (!(await requireReviewer())) return <ReviewLogin />;
  const now = new Date();
  const approval = shippingApprovalStatus(SHIPPING_ORIGINS, process.env, now);
  return (
    <div>
      <OwnerNav current="shipping" />
      <PageTitle
        title="Shipping"
        lead="Each place items ship from (your studio, each supplier) is an origin with its own rates, processing time and verification. A cart with items from two origins ships as two packages, each charged separately and shown to the customer before they pay."
      />
      <ul className="grid gap-4">
        {SHIPPING_ORIGINS.map((o) => {
          const problem = originProblem(o, now, o.source);
          return (
            <li key={o.id} className={cn(card, problem ? "ring-2 ring-lemon" : "")}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-xl font-bold text-ink">
                  {o.publicLabel} <span className="font-mono text-sm font-normal text-ink-soft">({o.id})</span>
                </h2>
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
              </dl>
            </li>
          );
        })}
      </ul>

      <section aria-labelledby="appr" className={cn(card, "mt-5")}>
        <h2 id="appr" className="font-display text-xl font-bold text-ink">Approval for live checkout</h2>
        <p className="mt-1 text-sm text-ink">
          Places with verified, current rates: <strong>{approval.verifiedOrigins}</strong> of {SHIPPING_ORIGINS.length}. {approval.problem ? SHIPPING_LOCK_TEXT[approval.problem] : "Live checkout may use this table."}
        </p>
        <p className="mt-2 text-sm text-ink">
          This table&apos;s approval code: <span className="select-all font-mono">{approval.fingerprint}</span>. Any change to rates, times or verification gives a new code, and live checkout stays closed until you set{" "}
          <span className="font-mono">STRIPE_LIVE_SHIPPING_TABLE</span> to it for Production (not a secret). Production value:{" "}
          {approval.approval === "matches" ? "matches ✓" : approval.approval === "different" ? "different — rates changed since you approved them" : "not set"}.
        </p>
      </section>
    </div>
  );
}
