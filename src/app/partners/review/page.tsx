import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { reviewConfig } from "@/lib/partners/config";
import { requireReviewer } from "@/lib/partners/review-auth";
import { listApplications } from "@/lib/partners/store";
import { retentionDecision } from "@/lib/partners/retention";
import { lastRuns } from "@/lib/partners/cleanup";
import { deletionState } from "@/lib/partners/deletion";
import { listDeletionRequests } from "@/lib/partners/deletion-requests";
import { PARTNER_TYPES, STAGES, STAGE_LABELS, isPartnerType, isStage } from "@/lib/partners/schema";
import { screeningFlags } from "@/lib/partners/screening";
import { Chips, Empty, Flash, OwnerShell, PageTitle, Pill, Section, card, one, primary, secondary, small, type PillTone } from "@/components/owner/OwnerUi";
import { ReviewLogin } from "@/components/partners/ReviewLogin";
import { OwnerNav, OwnerSubNav, SUPPLIER_TABS } from "@/components/owner/OwnerNav";
import { logoutAction, runCleanupAction } from "./actions";
import { cn } from "@/components/owner/cn";

export const metadata: Metadata = { title: "Partner applications", robots: { index: false, follow: false } };

/** PRIVATE owner area. 404 unless the review login is configured. */
export default function ReviewPage({ searchParams }: PageProps<"/partners/review">) {
  if (!reviewConfig()) notFound();
  return (
    <OwnerShell>
      <Review searchParams={searchParams} />
    </OwnerShell>
  );
}

const stageTone: Record<string, PillTone> = {
  new: "info",
  "under-review": "warn",
  "need-info": "warn",
  approved: "good",
  declined: "plain",
};

async function Review({ searchParams }: { searchParams: PageProps<"/partners/review">["searchParams"] }) {
  await connection();
  const ctx = await requireReviewer();
  if (!ctx) return <ReviewLogin />;

  const params = await searchParams;
  const status = isStage(one(params.status)) ? one(params.status) : null;
  const type = isPartnerType(one(params.type)) ? one(params.type) : null;

  const now = new Date();
  const [all, runs, requests] = await Promise.all([listApplications(ctx.stores.apps), lastRuns(ctx.stores.ops), listDeletionRequests(ctx.stores.ops)]);
  const decisions = new Map(all.map((a) => [a.id, retentionDecision(a, now)]));
  const due = all.filter((a) => decisions.get(a.id)?.action === "delete");
  const reviewDue = all.filter((a) => { const d = decisions.get(a.id); return d?.action === "review" && d.overdue; });
  const openRequests = requests.filter((r) => r.status === "open");
  const overdueRequests = openRequests.filter((r) => deletionState(r, now) === "overdue");
  const live = ctx.cfg.storage === "blobs" && !ctx.cfg.storeSuffix;
  const lastSuccess = runs.lastSuccessAt ? new Date(runs.lastSuccessAt) : null;
  const stale = live && (!lastSuccess || now.getTime() - lastSuccess.getTime() > 36 * 3_600_000);
  const shown = all.filter((a) => (!status || a.status === status) && (!type || a.type === type));
  const counts = Object.fromEntries(STAGES.map((s) => [s, all.filter((a) => a.status === s).length]));
  const qs = (next: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const merged = { status, type, ...next };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/partners/review?${s}` : "/partners/review";
  };

  return (
    <div>
      <OwnerNav current="/partners/review" />
      <OwnerSubNav label="Supplier pages" items={SUPPLIER_TABS} current="/partners/review" />
      <PageTitle
        title="Partner applications"
        lead={<>{all.length} total · storage: {ctx.cfg.storage === "memory" ? "local test memory (not durable)" : `Netlify Blobs${ctx.cfg.storeSuffix ? " (preview data)" : ""}`}</>}
        actions={
          <form action={logoutAction}>
            <button type="submit" className={cn(secondary, small)}>
              Sign out
            </button>
          </form>
        }
      />
      <Flash
        ok={
          one(params.deleted)
            ? "Application deleted."
            : one(params.cleanup)
              ? one(params.cleanup) === "dry-run"
                ? "Dry run finished — nothing was deleted. See the report below."
                : `Cleanup finished (${one(params.cleanup)}).`
              : null
        }
      />

      <Section
        id="retention-title"
        title="Data retention"
        tone={stale || overdueRequests.length ? "alert" : "plain"}
        className="mb-6"
        description={live ? "Cleanup runs automatically every day at 08:00 UTC." : "Preview/test data: the daily schedule only runs on the live site, so use the buttons here."}
        actions={
          <Link href="/partners/review/requests" className={cn(secondary, small)}>
            Deletion requests ({openRequests.length} open{overdueRequests.length ? `, ${overdueRequests.length} overdue` : ""})
          </Link>
        }
      >
        <ul className="space-y-1.5 text-sm text-ink">
          <li>
            <span className="font-semibold">Last run:</span>{" "}
            {runs.last
              ? `${new Date(runs.last.finishedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" })} · ${runs.last.dryRun ? "dry run" : runs.last.status} · ${runs.last.dryRun ? "would delete" : "deleted"} ${runs.last.dryRun ? runs.last.applications.due : runs.last.applications.deleted} application(s) and ${runs.last.dryRun ? runs.last.rateLimits.due : runs.last.rateLimits.deleted} rate-limit record(s)`
              : "never"}
          </li>
          {stale && <li className="font-semibold text-[#a3174f]">No successful cleanup in the last 36 hours — check the Netlify function log for &ldquo;partner-retention&rdquo;.</li>}
          <li>
            <span className="font-semibold">Due for deletion now:</span> {due.length ? due.map((a) => a.id).join(", ") : "none"}
          </li>
          {reviewDue.length > 0 && (
            <li>
              <span className="font-semibold">Approved partners due for their yearly review:</span> {reviewDue.map((a) => a.id).join(", ")}
            </li>
          )}
        </ul>
        <div className="mt-4 flex flex-wrap gap-2 border-t border-sky-100 pt-4">
          <form action={runCleanupAction}>
            <input type="hidden" name="dryRun" value="true" />
            <button type="submit" className={cn(secondary, small)}>Dry run (delete nothing)</button>
          </form>
          <form action={runCleanupAction}>
            <button type="submit" className={cn(primary, small)}>Run cleanup now</button>
          </form>
        </div>
      </Section>

      <div className="mb-4 space-y-2">
        <Chips
          label="Filter by stage"
          items={[{ href: qs({ status: null }), label: "All", count: all.length, active: !status }, ...STAGES.map((st) => ({ href: qs({ status: st }), label: STAGE_LABELS[st], count: counts[st], active: status === st }))]}
        />
        <Chips label="Filter by type" items={[{ href: qs({ type: null }), label: "All types", active: !type }, ...PARTNER_TYPES.map((t) => ({ href: qs({ type: t.id }), label: t.short, active: type === t.id }))]} />
      </div>

      {shown.length === 0 ? (
        <Empty title="No applications here yet">{all.length ? "Try another stage or type." : "Applications from the public partner form appear here."}</Empty>
      ) : (
        <ul className={cn(card, "divide-y divide-sky-100 p-0 sm:p-0")}>
          {shown.map((a) => (
            <li key={a.id}>
              <Link href={`/partners/review/${a.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-4 first:rounded-t-3xl last:rounded-b-3xl hover:bg-ice-50 focus-visible:bg-ice-50 focus-visible:outline focus-visible:outline-[3px] focus-visible:-outline-offset-[3px] focus-visible:outline-royal sm:px-6">
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-display text-lg font-bold text-ink">{String(a.fields.business ?? "")}</span>
                    <Pill tone={stageTone[a.status] ?? "plain"}>{STAGE_LABELS[a.status]}</Pill>
                  </span>
                  <span className="block text-sm text-ink-soft">
                    {PARTNER_TYPES.find((t) => t.id === a.type)?.short} · {String(a.fields.country ?? "")} · {a.id}
                  </span>
                </span>
                <span className="text-sm text-ink-soft">{new Date(a.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                {a.notification.status === "failed" && <Pill tone="alert">Email failed</Pill>}
                {screeningFlags(a.type, a.fields).some((f) => f.level === "serious") && <Pill tone="alert">Safety check</Pill>}
                <RetentionBadge decision={decisions.get(a.id)} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RetentionBadge({ decision }: { decision: ReturnType<typeof retentionDecision> | undefined }) {
  if (!decision) return null;
  if (decision.action === "hold") return <Pill tone="dark">Legal hold</Pill>;
  if (decision.action === "delete") return <Pill tone="warn">Due for deletion</Pill>;
  if (decision.action === "review" && decision.overdue) return <Pill tone="warn">Review due</Pill>;
  return null;
}
