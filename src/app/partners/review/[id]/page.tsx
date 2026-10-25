import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { reviewConfig } from "@/lib/partners/config";
import { requireReviewer } from "@/lib/partners/review-auth";
import { getApplication, pastRetention } from "@/lib/partners/store";
import { PARTNER_FIELDS, PARTNER_TYPES, STAGES, STAGE_LABELS } from "@/lib/partners/schema";
import { safeUrl } from "@/lib/partners/validate";
import { Container } from "@/components/ui/Primitives";
import { ReviewLogin } from "@/components/partners/ReviewLogin";
import { ArrowLeftIcon } from "@/components/icons/Icons";
import { deleteApplicationAction, resendNotificationAction, updateStatusAction } from "../actions";

export const metadata: Metadata = { title: "Partner application", robots: { index: false, follow: false } };

// Private, per-request page: no shared instant-navigation shell needed.
export const instant = false;

export default function ApplicationPage({ params, searchParams }: PageProps<"/partners/review/[id]">) {
  if (!reviewConfig()) notFound();
  return (
    <section className="min-h-screen bg-ice-50 pb-24 pt-28 sm:pt-32">
      <Container className="max-w-4xl">
        <Suspense fallback={<p className="text-ink-soft">Loading…</p>}>
          <Detail params={params} searchParams={searchParams} />
        </Suspense>
      </Container>
    </section>
  );
}

const fmt = (iso: string) => new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" });

async function Detail({ params, searchParams }: { params: PageProps<"/partners/review/[id]">["params"]; searchParams: PageProps<"/partners/review/[id]">["searchParams"] }) {
  await connection();
  const ctx = await requireReviewer();
  if (!ctx) return <ReviewLogin />;
  const { id } = await params;
  const sp = await searchParams;
  const app = await getApplication(ctx.stores.apps, id);
  if (!app) return <p className="rounded-[2rem] bg-white p-8 text-ink-soft ring-1 ring-inset ring-sky-200">Application not found. <Link href="/partners/review" className="font-semibold text-royal underline">Back to the list</Link></p>;

  const type = PARTNER_TYPES.find((t) => t.id === app.type);
  const email = String(app.fields.email ?? "");
  const rows = PARTNER_FIELDS.filter((f) => app.fields[f.name] !== undefined);

  return (
    <div className="space-y-6">
      <Link href="/partners/review" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-4 font-display font-semibold text-ink ring-1 ring-inset ring-sky-200">
        <ArrowLeftIcon className="size-4" /> All applications
      </Link>
      {sp.saved && <p role="status" className="rounded-2xl bg-mint-soft px-4 py-3 font-semibold text-ink">Saved.</p>}

      <header className="rounded-[2rem] bg-white p-6 ring-1 ring-inset ring-sky-200">
        <p className="font-display text-sm font-semibold uppercase tracking-[0.12em] text-royal">{type?.short}</p>
        <h1 className="mt-1 font-display text-3xl font-bold text-ink">{String(app.fields.business ?? "")}</h1>
        <p className="mt-1 text-ink-soft">
          {app.id} · received {fmt(app.createdAt)} · {STAGE_LABELS[app.status]}
        </p>
        {pastRetention(app) && (
          <p className="mt-3 rounded-xl bg-lemon-soft px-3 py-2 text-sm font-semibold text-ink">Older than the proposed retention period — consider deleting it.</p>
        )}
        {email && (
          <a
            href={`mailto:${encodeURIComponent(email).replace(/%40/g, "@")}?subject=${encodeURIComponent(`Your FunkSquish partner application (${app.id})`)}`}
            className="mt-4 inline-flex min-h-11 items-center rounded-full bg-royal px-5 font-display font-semibold text-white shadow-[0_4px_0_var(--color-navy)]"
          >
            Reply by email
          </a>
        )}
      </header>

      <section aria-labelledby="answers" className="rounded-[2rem] bg-white p-6 ring-1 ring-inset ring-sky-200">
        <h2 id="answers" className="font-display text-xl font-bold text-ink">Answers</h2>
        <dl className="mt-4 divide-y divide-sky-100">
          {rows.map((f) => {
            const v = app.fields[f.name];
            const text = Array.isArray(v) ? v.join(", ") : String(v);
            const link = f.kind === "url" ? safeUrl(text) : null;
            return (
              <div key={f.name} className="grid gap-1 py-3 sm:grid-cols-[14rem_1fr] sm:gap-4">
                <dt className="font-semibold text-ink">{f.label}</dt>
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
        <p className="mt-4 text-sm text-ink-soft">
          Consent ({app.consent.version}) given {fmt(app.consent.at)}. Links come from the applicant — check where they go before opening them.
        </p>
      </section>

      <section aria-labelledby="stage" className="rounded-[2rem] bg-white p-6 ring-1 ring-inset ring-sky-200">
        <h2 id="stage" className="font-display text-xl font-bold text-ink">Stage & notes</h2>
        <form action={updateStatusAction} className="mt-4 grid gap-3">
          <input type="hidden" name="id" value={app.id} />
          <label htmlFor="status" className="font-semibold text-ink">Stage</label>
          <select id="status" name="status" defaultValue={app.status} className="min-h-12 rounded-2xl bg-ice-50 px-4 text-ink ring-2 ring-inset ring-sky-200">
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {STAGE_LABELS[s]}
              </option>
            ))}
          </select>
          <label htmlFor="note" className="font-semibold text-ink">Private note (optional)</label>
          <textarea id="note" name="note" rows={3} maxLength={2000} className="rounded-2xl bg-ice-50 px-4 py-3 text-ink ring-2 ring-inset ring-sky-200" />
          <p className="text-sm text-ink-soft">Changing the stage never emails the applicant. &ldquo;Approved for follow-up&rdquo; is just a note to yourself — reply to them directly.</p>
          <button type="submit" className="justify-self-start rounded-full bg-royal px-5 py-2.5 font-display font-semibold text-white shadow-[0_4px_0_var(--color-navy)]">
            Save
          </button>
        </form>
        {app.notes.length > 0 && (
          <ul className="mt-6 space-y-2">
            {[...app.notes].reverse().map((n, i) => (
              <li key={i} className="rounded-2xl bg-ice-50 p-3 ring-1 ring-inset ring-sky-200">
                <p className="text-xs font-semibold text-ink-soft">{fmt(n.at)}</p>
                <p className="whitespace-pre-wrap break-words text-ink">{n.text}</p>
              </li>
            ))}
          </ul>
        )}
        <details className="mt-4">
          <summary className="cursor-pointer font-semibold text-royal">History</summary>
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

      <section aria-labelledby="notif" className="rounded-[2rem] bg-white p-6 ring-1 ring-inset ring-sky-200">
        <h2 id="notif" className="font-display text-xl font-bold text-ink">Owner email notification</h2>
        <p className="mt-2 text-ink">
          {app.notification.status === "sent" ? "Sent" : app.notification.status === "failed" ? `Failed (${app.notification.code ?? "unknown"})` : "Pending"}
          {app.notification.at ? ` · ${fmt(app.notification.at)}` : ""}
        </p>
        <form action={resendNotificationAction} className="mt-3">
          <input type="hidden" name="id" value={app.id} />
          <button type="submit" className="rounded-full bg-white px-4 py-2 font-display font-semibold text-ink ring-1 ring-inset ring-sky-200 hover:bg-ice">Send notification again</button>
        </form>
      </section>

      <section aria-labelledby="danger" className="rounded-[2rem] bg-white p-6 ring-2 ring-inset ring-berry/40">
        <h2 id="danger" className="font-display text-xl font-bold text-ink">Delete application</h2>
        <p className="mt-2 text-ink-soft">Permanently deletes it from storage (for example when someone asks, or after the retention period). This can&apos;t be undone.</p>
        <form action={deleteApplicationAction} className="mt-3 flex flex-wrap items-end gap-3">
          <input type="hidden" name="id" value={app.id} />
          <label className="grid gap-1 text-sm font-semibold text-ink">
            Type the reference to confirm
            <input name="confirm" autoComplete="off" placeholder={app.id} className="min-h-11 rounded-xl bg-ice-50 px-3 font-mono text-ink ring-2 ring-inset ring-sky-200" />
          </label>
          <button type="submit" className="min-h-11 rounded-full bg-[#b8215a] px-5 font-display font-semibold text-white">Delete permanently</button>
        </form>
        {sp.delete === "confirm" && <p role="alert" className="mt-2 text-sm font-semibold text-[#b8215a]">The reference didn&apos;t match, so nothing was deleted.</p>}
      </section>
    </div>
  );
}
