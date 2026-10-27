import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { reviewConfig } from "@/lib/partners/config";
import { requireReviewer } from "@/lib/partners/review-auth";
import { listDeletionRequests, requestMatches } from "@/lib/partners/deletion-requests";
import { deletionState, type DeletionState } from "@/lib/partners/deletion";
import { STAGE_LABELS } from "@/lib/partners/schema";
import { Container } from "@/components/ui/Primitives";
import { ReviewLogin } from "@/components/partners/ReviewLogin";
import { ArrowLeftIcon } from "@/components/icons/Icons";
import { cn } from "@/lib/cn";
import { completeDeletionRequestAction, createDeletionRequestAction, deletionExceptionAction, reopenDeletionRequestAction } from "../actions";

export const metadata: Metadata = { title: "Deletion requests", robots: { index: false, follow: false } };

/** PRIVATE owner area: requests to delete partner applications, with their 30-day deadlines. */
export default function RequestsPage({ searchParams }: PageProps<"/partners/review/requests">) {
  if (!reviewConfig()) notFound();
  return (
    <section className="min-h-screen bg-ice-50 pb-24 pt-28 sm:pt-32">
      <Container className="max-w-4xl">
        <Suspense fallback={<p className="text-ink-soft">Loading…</p>}>
          <Requests searchParams={searchParams} />
        </Suspense>
      </Container>
    </section>
  );
}

const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { dateStyle: "medium", timeZone: "America/New_York" });
const stateLabel: Record<DeletionState, [string, string]> = {
  open: ["Open", "bg-royal text-white"],
  "due-soon": ["Due within 7 days", "bg-lemon-soft text-ink"],
  overdue: ["Overdue", "bg-[#b8215a] text-white"],
  completed: ["Completed", "bg-mint-soft text-ink"],
  exception: ["Legal exception", "bg-grape-soft text-ink"],
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
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const now = new Date();
  const requests = await listDeletionRequests(ctx.stores.ops);
  const withMatches = await Promise.all(requests.map(async (r) => ({ r, state: deletionState(r, now), matches: r.status === "completed" ? [] : await requestMatches(ctx.stores, ctx.cfg.secret, r) })));
  const today = now.toISOString().slice(0, 10);
  const error = errors[one(sp.error) ?? ""];

  return (
    <div className="space-y-6">
      <Link href="/partners/review" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-4 font-display font-semibold text-ink ring-1 ring-inset ring-sky-200">
        <ArrowLeftIcon className="size-4" /> All applications
      </Link>
      <header>
        <h1 className="font-display text-3xl font-bold text-ink sm:text-4xl">Deletion requests</h1>
        <p className="mt-2 max-w-2xl text-ink-soft">
          When someone asks us to delete their application, record it here. You have 30 days. The email address is only used to find their
          application — it&apos;s stored as a scrambled code, never as the address.
        </p>
      </header>
      {one(sp.saved) && <p role="status" className="rounded-2xl bg-mint-soft px-4 py-3 font-semibold text-ink">Saved {one(sp.saved)}.</p>}
      {error && <p role="alert" className="rounded-2xl bg-berry-soft px-4 py-3 font-semibold text-ink">{error}</p>}

      <form action={createDeletionRequestAction} className="grid gap-3 rounded-[2rem] bg-white p-6 ring-1 ring-inset ring-sky-200 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <h2 className="font-display text-xl font-bold text-ink sm:col-span-3">Record a new request</h2>
        <label className="grid gap-1 text-sm font-semibold text-ink">
          Their email address
          <input name="email" type="email" required maxLength={254} autoComplete="off" className="min-h-11 rounded-xl bg-ice-50 px-3 text-base font-normal text-ink ring-2 ring-inset ring-sky-200" />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-ink">
          Request received on
          <input name="receivedOn" type="date" required defaultValue={today} max={today} className="min-h-11 rounded-xl bg-ice-50 px-3 text-base font-normal text-ink ring-2 ring-inset ring-sky-200" />
        </label>
        <button type="submit" className="min-h-11 rounded-full bg-royal px-5 font-display font-semibold text-white shadow-[0_4px_0_var(--color-navy)]">Record request</button>
      </form>

      {withMatches.length === 0 ? (
        <p className="rounded-[2rem] bg-white p-8 text-center text-ink-soft ring-1 ring-inset ring-sky-200">No deletion requests.</p>
      ) : (
        <ul className="space-y-3">
          {withMatches.map(({ r, state, matches }) => (
            <li key={r.id} className={cn("rounded-[2rem] bg-white p-6 ring-1 ring-inset", state === "overdue" ? "ring-2 ring-[#d62f6d]" : "ring-sky-200")}>
              <div className="flex flex-wrap items-center gap-3">
                <span className={cn("rounded-full px-3 py-1 font-display text-xs font-bold", stateLabel[state][1])}>{stateLabel[state][0]}</span>
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
                          {m.held && <span className="ml-2 rounded-full bg-grape-soft px-2 py-0.5 text-xs font-bold text-ink">Legal hold — won&apos;t be deleted</span>}
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
                  <form action={completeDeletionRequestAction} className="grid gap-2 rounded-2xl bg-ice-50 p-4">
                    <input type="hidden" name="id" value={r.id} />
                    <label className="grid gap-1 text-sm font-semibold text-ink">
                      Type {r.id} to delete {matches.length ? `${matches.length} application(s)` : "(nothing matches)"} and close it
                      <input name="confirm" autoComplete="off" placeholder={r.id} className="min-h-11 rounded-xl bg-white px-3 font-mono text-ink ring-2 ring-inset ring-sky-200" />
                    </label>
                    <button type="submit" className="justify-self-start rounded-full bg-[#b8215a] px-4 py-2 font-display text-sm font-semibold text-white">Delete and complete</button>
                  </form>
                  <form action={deletionExceptionAction} className="grid gap-2 rounded-2xl bg-ice-50 p-4">
                    <input type="hidden" name="id" value={r.id} />
                    <label className="grid gap-1 text-sm font-semibold text-ink">
                      Or record a legal reason to keep it (get advice first)
                      <input name="reason" maxLength={300} className="min-h-11 rounded-xl bg-white px-3 text-ink ring-2 ring-inset ring-sky-200" />
                    </label>
                    <button type="submit" className="justify-self-start rounded-full bg-white px-4 py-2 font-display text-sm font-semibold text-ink ring-1 ring-inset ring-sky-200">Record exception</button>
                  </form>
                </div>
              )}
              {r.status === "exception" && (
                <form action={reopenDeletionRequestAction} className="mt-3">
                  <input type="hidden" name="id" value={r.id} />
                  <button type="submit" className="rounded-full bg-white px-4 py-2 font-display text-sm font-semibold text-ink ring-1 ring-inset ring-sky-200">Reason no longer applies — re-open</button>
                </form>
              )}
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-semibold text-royal">Log</summary>
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
  );
}
