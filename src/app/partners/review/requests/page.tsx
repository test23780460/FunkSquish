import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { reviewConfig } from "@/lib/partners/config";
import { requireReviewer } from "@/lib/partners/review-auth";
import { listDeletionRequests, requestMatches } from "@/lib/partners/deletion-requests";
import { deletionState, type DeletionState } from "@/lib/partners/deletion";
import { STAGE_LABELS } from "@/lib/partners/schema";
import { OwnerNav, OwnerSubNav, SUPPLIER_TABS } from "@/components/owner/OwnerNav";
import { Empty, Flash, OwnerShell, PageTitle, Pill, button, card, input, label as lbl, one, panel, primary, secondary, small, type PillTone } from "@/components/owner/OwnerUi";
import { ReviewLogin } from "@/components/partners/ReviewLogin";
import { cn } from "@/lib/cn";
import { completeDeletionRequestAction, createDeletionRequestAction, deletionExceptionAction, reopenDeletionRequestAction } from "../actions";

export const metadata: Metadata = { title: "Deletion requests", robots: { index: false, follow: false } };

/** PRIVATE owner area: requests to delete partner applications, with their 30-day deadlines. */
export default function RequestsPage({ searchParams }: PageProps<"/partners/review/requests">) {
  if (!reviewConfig()) notFound();
  return (
    <OwnerShell>
      <Requests searchParams={searchParams} />
    </OwnerShell>
  );
}

const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { dateStyle: "medium", timeZone: "America/New_York" });
const stateLabel: Record<DeletionState, [string, PillTone]> = {
  open: ["Open", "info"],
  "due-soon": ["Due within 7 days", "warn"],
  overdue: ["Overdue", "alert"],
  completed: ["Completed", "good"],
  exception: ["Legal exception", "dark"],
};
const errors: Record<string, string> = {
  email: "Please enter the email address the person applied with.",
  date: "Please enter the date the request arrived (within the last year).",
  confirm: "The request number didn't match, so nothing was deleted.",
  reason: "Please write the legal reason.",
  held: "Nothing was deleted: a matching application is on legal hold. Release the hold (after getting advice) or record a legal exception.",
};

async function Requests({ searchParams }: { searchParams: PageProps<"/partners/review/requests">["searchParams"] }) {
  await connection();
  const ctx = await requireReviewer();
  if (!ctx) return <ReviewLogin />;
  const sp = await searchParams;
  const now = new Date();
  const requests = await listDeletionRequests(ctx.stores.ops);
  const withMatches = await Promise.all(requests.map(async (r) => ({ r, state: deletionState(r, now), matches: r.status === "completed" ? [] : await requestMatches(ctx.stores, ctx.cfg.secret, r) })));
  const today = now.toISOString().slice(0, 10);
  const error = errors[one(sp.error) ?? ""];

  return (
    <div>
      <OwnerNav current="/partners/review" />
      <OwnerSubNav label="Supplier pages" items={SUPPLIER_TABS} current="/partners/review" />
      <PageTitle
        title="Deletion requests"
        lead={
          <>
            When someone asks us to delete their application, record it here. You have 30 days. The email address is only used to find their application — it&apos;s stored as a scrambled code, never as the address.
          </>
        }
      />
      <Flash ok={one(sp.saved) ? `Saved ${one(sp.saved)}.` : null} error={error} />
      <div className="space-y-5">

      <form action={createDeletionRequestAction} className={cn(card, "grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end")}>
        <h2 className="font-display text-lg font-bold text-ink sm:col-span-3 sm:text-xl">Record a new request</h2>
        <label className={lbl}>
          Their email address
          <input name="email" type="email" required maxLength={254} autoComplete="off" className={input} />
        </label>
        <label className={lbl}>
          Request received on
          <input name="receivedOn" type="date" required defaultValue={today} max={today} className={input} />
        </label>
        <button type="submit" className={primary}>Record request</button>
      </form>

      {withMatches.length === 0 ? (
        <Empty title="No deletion requests">Requests you record above appear here with their 30-day deadline.</Empty>
      ) : (
        <ul className="space-y-3">
          {withMatches.map(({ r, state, matches }) => (
            <li key={r.id} className={cn(card, state === "overdue" && "ring-2 ring-[#d62f6d]")}>
              <div className="flex flex-wrap items-center gap-3">
                <Pill tone={stateLabel[state][1]}>{stateLabel[state][0]}</Pill>
                <span className="font-mono font-semibold text-ink">{r.id}</span>
                <span className="text-sm text-ink-soft">
                  received {day(r.receivedAt)} · due {day(r.dueAt)}
                  {r.completedAt ? ` · completed ${day(r.completedAt)}` : ""}
                </span>
              </div>
              {r.outcome && <p className="mt-2 text-ink">{r.outcome}</p>}
              {r.exceptionReason && <p className="mt-2 text-ink">Legal exception: {r.exceptionReason}</p>}

              {r.status !== "completed" && (
                <div className="mt-3">
                  <p className="font-semibold text-ink">Matching applications right now:</p>
                  {matches.length ? (
                    <ul className="mt-1 list-disc pl-5 text-ink">
                      {matches.map((m) => (
                        <li key={m.id}>
                          <Link href={`/partners/review/${m.id}`} className="font-semibold text-royal underline">{m.id}</Link> · {m.business} · {STAGE_LABELS[m.status]}
                          {m.held && (
                            <span className="ml-2">
                              <Pill tone="dark">Legal hold — won&apos;t be deleted</Pill>
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-ink-soft">None — check the address with them if you expected one.</p>
                  )}
                </div>
              )}

              {r.status === "open" && (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <form action={completeDeletionRequestAction} className={cn(panel, "grid gap-2")}>
                    <input type="hidden" name="id" value={r.id} />
                    <label className={lbl}>
                      Type {r.id} to delete {matches.length ? `${matches.length} application(s)` : "(nothing matches)"} and close it
                      <input name="confirm" autoComplete="off" placeholder={r.id} className={cn(input, "font-mono")} />
                    </label>
                    <button type="submit" className={cn(button, small, "justify-self-start bg-[#a3174f] text-white hover:brightness-110")}>Delete and complete</button>
                  </form>
                  <form action={deletionExceptionAction} className={cn(panel, "grid gap-2")}>
                    <input type="hidden" name="id" value={r.id} />
                    <label className={lbl}>
                      Or record a legal reason to keep it (get advice first)
                      <input name="reason" maxLength={300} className={input} />
                    </label>
                    <button type="submit" className={cn(secondary, small, "justify-self-start")}>Record exception</button>
                  </form>
                </div>
              )}
              {r.status === "exception" && (
                <form action={reopenDeletionRequestAction} className="mt-3">
                  <input type="hidden" name="id" value={r.id} />
                  <button type="submit" className={cn(secondary, small)}>Reason no longer applies — re-open</button>
                </form>
              )}
              <details className="mt-3">
                <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold text-royal">Log</summary>
                <ul className="mt-1 space-y-1 text-sm text-ink-soft">
                  {r.log.map((l, i) => (
                    <li key={i}>
                      {day(l.at)}: {l.text}
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          ))}
        </ul>
      )}
      <p className="text-sm text-ink-soft">
        Completed requests are kept as a short record (dates, scrambled email code, references, outcome) for 24 months, then deleted automatically.
        Remember to also delete their emails from your inbox.
      </p>
      </div>
    </div>
  );
}
