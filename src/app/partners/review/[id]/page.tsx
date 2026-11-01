import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { reviewConfig } from "@/lib/partners/config";
import { requireReviewer } from "@/lib/partners/review-auth";
import { getApplication } from "@/lib/partners/store";
import { lastActivity, retentionDecision } from "@/lib/partners/retention";
import { FIELD_GROUPS, PARTNER_FIELDS, PARTNER_TYPES, STAGES, STAGE_LABELS, type FieldDef } from "@/lib/partners/schema";
import { screeningFlags } from "@/lib/partners/screening";
import { safeUrl } from "@/lib/partners/validate";
import { OwnerNav } from "@/components/owner/OwnerNav";
import { Callout, Empty, Flash, OwnerShell, Pill, button, card, input, label as lbl, panel, primary, secondary, small } from "@/components/owner/OwnerUi";
import { cn } from "@/components/owner/cn";
import { ReviewLogin } from "@/components/partners/ReviewLogin";
import { ArrowLeftIcon } from "@/components/icons/Icons";
import { confirmActiveAction, deleteApplicationAction, legalHoldAction, releaseHoldAction, resendNotificationAction, updateStatusAction } from "../actions";

export const metadata: Metadata = { title: "Partner application", robots: { index: false, follow: false } };

// Private, per-request page: no shared instant-navigation shell needed.
export const instant = false;

export default function ApplicationPage({ params, searchParams }: PageProps<"/partners/review/[id]">) {
  if (!reviewConfig()) notFound();
  return (
    <OwnerShell>
      <Detail params={params} searchParams={searchParams} />
    </OwnerShell>
  );
}

const h2 = "font-display text-lg font-bold text-ink sm:text-xl";
const fmt = (iso: string) => new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" });

async function Detail({ params, searchParams }: { params: PageProps<"/partners/review/[id]">["params"]; searchParams: PageProps<"/partners/review/[id]">["searchParams"] }) {
  await connection();
  const ctx = await requireReviewer();
  if (!ctx) return <ReviewLogin />;
  const { id } = await params;
  const sp = await searchParams;
  const app = await getApplication(ctx.stores.apps, id);
  if (!app)
    return (
      <div>
        <OwnerNav current="/partners/review" />
        <Empty title="Application not found" action={<Link href="/partners/review" className={cn(secondary, small)}>Back to the list</Link>}>
          It may have been deleted by a cleanup run or a deletion request.
        </Empty>
      </div>
    );

  const type = PARTNER_TYPES.find((t) => t.id === app.type);
  const email = String(app.fields.email ?? "");
  const answered = (names: string[]) => names.flatMap((n) => PARTNER_FIELDS.filter((f) => f.name === n && app.fields[f.name] !== undefined));
  const sections = FIELD_GROUPS.map((g) => ({ title: g.title, defs: answered(g.fields) })).filter((s) => s.defs.length);
  // Answers to questions that have since been renamed or removed are still shown, never hidden.
  const known = new Set(PARTNER_FIELDS.map((f) => f.name));
  const legacy: FieldDef[] = Object.keys(app.fields)
    .filter((k) => !known.has(k))
    .map((k) => ({ name: k, label: k, kind: "text", max: 0 }));
  if (legacy.length) sections.push({ title: "Other answers (older form version)", defs: legacy });
  const flags = screeningFlags(app.type, app.fields);
  const retention = retentionDecision(app);
  const day = (d: Date) => d.toLocaleDateString("en-US", { dateStyle: "medium", timeZone: "America/New_York" });

  return (
    <div>
      <OwnerNav current="/partners/review" />
      <Link href="/partners/review" className="-ml-1 mb-3 inline-flex min-h-11 items-center gap-2 rounded-full px-2 text-sm font-semibold text-royal hover:underline focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-royal">
        <ArrowLeftIcon className="size-4" /> All applications
      </Link>
      <Flash ok={sp.saved ? "Saved." : null} />

      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="mb-1 font-display text-xs font-semibold uppercase tracking-[0.14em] text-royal">{type?.short}</p>
          <h1 className="font-display text-[1.85rem] font-bold leading-tight text-ink sm:text-[2.25rem]">{String(app.fields.business ?? "")}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-1.5 text-sm text-ink-soft">
            <Pill tone={app.status === "approved" ? "good" : app.status === "new" ? "info" : app.status === "declined" ? "plain" : "warn"}>{STAGE_LABELS[app.status]}</Pill>
            <span className="ml-1">
              {app.id} · received {fmt(app.createdAt)}
            </span>
          </p>
        </div>
        {email && (
          <a href={`mailto:${encodeURIComponent(email).replace(/%40/g, "@")}?subject=${encodeURIComponent(`Your FunkSquish partner application (${app.id})`)}`} className={primary}>
            Reply by email
          </a>
        )}
      </header>
      {retention.action === "delete" && <Callout tone="warn" className="mb-5">Past its retention date — the next cleanup run deletes it.</Callout>}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <div className="space-y-5">

      {flags.length > 0 && (
        <section aria-labelledby="flags" className={cn(card, "ring-2 ring-lemon")}>
          <h2 id="flags" className={h2}>Look at these first</h2>
          <ul className="mt-3 space-y-2">
            {flags.map((f) => (
              <li key={f.text} className="flex items-start gap-2 text-ink">
                <span className="mt-0.5 shrink-0">
                  <Pill tone={f.level === "serious" ? "alert" : "warn"}>{f.level === "serious" ? "Serious" : "Check"}</Pill>
                </span>
                <span>{f.text}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-ink-soft">Automatic hints from the applicant&apos;s own answers. They never approve or decline anything.</p>
        </section>
      )}

      <section aria-labelledby="answers" className={card}>
        <h2 id="answers" className={h2}>Answers</h2>
        {sections.map((sec) => (
          <div key={sec.title} className="mt-5">
            <h3 className="font-display text-sm font-semibold uppercase tracking-[0.12em] text-royal">{sec.title}</h3>
            <dl className="mt-1 divide-y divide-sky-100">
              {sec.defs.map((f) => {
                const v = app.fields[f.name];
                const text = Array.isArray(v) ? v.join(", ") : String(v);
                const link = f.kind === "url" ? safeUrl(text) : null;
                return (
                  <div key={f.name} className="grid gap-1 py-3 sm:grid-cols-[12rem_1fr] sm:gap-4">
                    <dt className="text-sm font-semibold text-ink-soft">{f.label}</dt>
                    <dd className="whitespace-pre-wrap break-words text-ink">
                      {link ? (
                        <a href={link} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold text-royal underline">
                          {text}
                        </a>
                      ) : (
                        text
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>
        ))}
        <p className="mt-4 text-sm text-ink-soft">
          Consent ({app.consent.version}) given {fmt(app.consent.at)}. Links come from the applicant — check where they go before opening them.
        </p>
      </section>
      </div>

      <aside aria-label="Review actions" className="space-y-5 lg:sticky lg:top-24">

      <section aria-labelledby="stage" className={card}>
        <h2 id="stage" className={h2}>Stage & notes</h2>
        <form action={updateStatusAction} className="mt-4 grid gap-3">
          <input type="hidden" name="id" value={app.id} />
          <label htmlFor="status" className="text-sm font-semibold text-ink">Stage</label>
          <select id="status" name="status" defaultValue={app.status} className={input}>
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {STAGE_LABELS[s]}
              </option>
            ))}
          </select>
          <label htmlFor="note" className="text-sm font-semibold text-ink">Private note (optional)</label>
          <textarea id="note" name="note" rows={3} maxLength={2000} className={cn(input, "py-3")} />
          <p className="text-xs leading-relaxed text-ink-soft">Changing the stage never emails the applicant. &ldquo;Approved for follow-up&rdquo; is just a note to yourself — reply to them directly.</p>
          <button type="submit" className={cn(primary, "justify-self-start")}>
            Save
          </button>
        </form>
        {app.notes.length > 0 && (
          <ul className="mt-6 space-y-2">
            {[...app.notes].reverse().map((n, i) => (
              <li key={i} className={cn(panel, "p-3")}>
                <p className="text-xs font-semibold text-ink-soft">{fmt(n.at)}</p>
                <p className="whitespace-pre-wrap break-words text-ink">{n.text}</p>
              </li>
            ))}
          </ul>
        )}
        <details className="mt-4">
          <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-royal">History</summary>
          <ul className="mt-2 space-y-1 text-sm text-ink-soft">
            {app.history.map((h, i) => (
              <li key={i}>
                {fmt(h.at)}: {h.from ? `${STAGE_LABELS[h.from]} → ` : ""}
                {STAGE_LABELS[h.to]}
              </li>
            ))}
          </ul>
        </details>
      </section>

      <section aria-labelledby="notif" className={card}>
        <h2 id="notif" className={h2}>Owner email notification</h2>
        <p className="mt-2 text-sm text-ink">
          {app.notification.status === "sent" ? "Sent" : app.notification.status === "failed" ? `Failed (${app.notification.code ?? "unknown"})` : "Pending"}
          {app.notification.at ? ` · ${fmt(app.notification.at)}` : ""}
        </p>
        <form action={resendNotificationAction} className="mt-3">
          <input type="hidden" name="id" value={app.id} />
          <button type="submit" className={cn(secondary, small)}>Send notification again</button>
        </form>
      </section>

      <section aria-labelledby="retention" className={card}>
        <h2 id="retention" className={h2}>Retention</h2>
        <p className="mt-2 text-sm text-ink">{retention.rule}.</p>
        <p className="mt-1 text-sm text-ink-soft">
          Last activity {day(lastActivity(app))}
          {retention.action === "keep" && ` · deleted automatically on or after ${day(retention.dueAt)}`}
          {retention.action === "delete" && ` · was due ${day(retention.dueAt)}`}
          {retention.action === "review" && ` · ${retention.overdue ? "review overdue since" : "next review"} ${day(retention.dueAt)}`}
        </p>
        <p className="mt-1 text-sm text-ink-soft">Stage changes and notes count as activity. Viewing, re-sending the email and legal holds don&apos;t.</p>
        {app.status === "approved" && (
          <form action={confirmActiveAction} className="mt-3">
            <input type="hidden" name="id" value={app.id} />
            <button type="submit" className={cn(secondary, small)}>We&apos;re still working together</button>
            <p className="mt-1 text-sm text-ink-soft">When it ends, copy what your business records need, then delete this application.</p>
          </form>
        )}
        {app.legalHold ? (
          <form action={releaseHoldAction} className="mt-4 rounded-2xl bg-grape-soft p-4 ring-1 ring-inset ring-sky-200">
            <input type="hidden" name="id" value={app.id} />
            <p className="font-semibold text-ink">Legal hold since {day(new Date(app.legalHold.at))}: {app.legalHold.reason}</p>
            <button type="submit" className={cn(secondary, small, "mt-2")}>Release hold</button>
          </form>
        ) : (
          <details className="mt-4">
            <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-royal">Keep it longer for a legal reason</summary>
            <form action={legalHoldAction} className="mt-2 grid gap-2">
              <input type="hidden" name="id" value={app.id} />
              <label htmlFor="reason" className="text-sm font-semibold text-ink">Documented reason (no personal details)</label>
              <input id="reason" name="reason" maxLength={300} required className={input} />
              <button type="submit" className={cn(secondary, small, "justify-self-start")}>Place legal hold</button>
              {sp.hold === "reason" && <p role="alert" className="text-sm font-semibold text-[#a3174f]">Please write the reason.</p>}
            </form>
          </details>
        )}
      </section>

      <section aria-labelledby="danger" className={cn(card, "ring-2 ring-[#f2b9cd]")}>
        <h2 id="danger" className={h2}>Delete application</h2>
        <p className="mt-2 text-sm text-ink-soft">Permanently deletes it from storage. For a deletion request, use <Link href="/partners/review/requests" className="font-semibold text-royal underline">Deletion requests</Link> so the deadline and outcome are recorded. This can&apos;t be undone.</p>
        <form action={deleteApplicationAction} className="mt-3 flex flex-wrap items-end gap-3">
          <input type="hidden" name="id" value={app.id} />
          <label className={cn(lbl, "w-full")}>
            Type the reference to confirm
            <input name="confirm" autoComplete="off" placeholder={app.id} className={cn(input, "font-mono")} />
          </label>
          <button type="submit" className={cn(button, "bg-[#a3174f] text-white hover:brightness-110")}>Delete permanently</button>
        </form>
        {sp.delete === "confirm" && <p role="alert" className="mt-2 text-sm font-semibold text-[#a3174f]">The reference didn&apos;t match, so nothing was deleted.</p>}
      </section>
      </aside>
      </div>
    </div>
  );
}
