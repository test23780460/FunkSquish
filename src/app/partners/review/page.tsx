import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { reviewConfig } from "@/lib/partners/config";
import { requireReviewer } from "@/lib/partners/review-auth";
import { listApplications, pastRetention } from "@/lib/partners/store";
import { PARTNER_TYPES, STAGES, STAGE_LABELS, isPartnerType, isStage } from "@/lib/partners/schema";
import { screeningFlags } from "@/lib/partners/screening";
import { Container } from "@/components/ui/Primitives";
import { ReviewLogin } from "@/components/partners/ReviewLogin";
import { logoutAction } from "./actions";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Partner applications", robots: { index: false, follow: false } };

/** PRIVATE owner area. 404 unless the review login is configured. */
export default function ReviewPage({ searchParams }: PageProps<"/partners/review">) {
  if (!reviewConfig()) notFound();
  return (
    <section className="min-h-screen bg-ice-50 pb-24 pt-28 sm:pt-32">
      <Container>
        <Suspense fallback={<p className="text-ink-soft">Loading…</p>}>
          <Review searchParams={searchParams} />
        </Suspense>
      </Container>
    </section>
  );
}

const stageTone: Record<string, string> = {
  new: "bg-royal text-white",
  "under-review": "bg-lemon-soft text-ink",
  "need-info": "bg-peach-soft text-ink",
  approved: "bg-mint-soft text-ink",
  declined: "bg-white text-ink-soft ring-1 ring-inset ring-sky-200",
};

async function Review({ searchParams }: { searchParams: PageProps<"/partners/review">["searchParams"] }) {
  await connection();
  const ctx = await requireReviewer();
  if (!ctx) return <ReviewLogin />;

  const params = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const status = isStage(one(params.status)) ? one(params.status) : null;
  const type = isPartnerType(one(params.type)) ? one(params.type) : null;

  const all = await listApplications(ctx.stores.apps);
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink sm:text-4xl">Partner applications</h1>
          <p className="text-ink-soft">
            {all.length} total · storage: {ctx.cfg.storage === "memory" ? "local test memory (not durable)" : `Netlify Blobs${ctx.cfg.storeSuffix ? " (preview data)" : ""}`}
          </p>
        </div>
        <form action={logoutAction}>
          <button type="submit" className="rounded-full bg-white px-4 py-2 font-display font-semibold text-ink ring-1 ring-inset ring-sky-200 hover:bg-ice">
            Sign out
          </button>
        </form>
      </div>
      {one(params.deleted) && <p role="status" className="mt-4 rounded-2xl bg-mint-soft px-4 py-3 font-semibold text-ink">Application deleted.</p>}

      <nav aria-label="Filter by stage" className="mt-6 flex flex-wrap gap-2">
        <Link href={qs({ status: null })} aria-current={!status ? "page" : undefined} className={cn("rounded-full px-4 py-2 font-display text-sm font-semibold ring-1 ring-inset ring-sky-200", !status ? "bg-ink text-white" : "bg-white text-ink")}>
          All ({all.length})
        </Link>
        {STAGES.map((s) => (
          <Link key={s} href={qs({ status: s })} aria-current={status === s ? "page" : undefined} className={cn("rounded-full px-4 py-2 font-display text-sm font-semibold ring-1 ring-inset ring-sky-200", status === s ? "bg-ink text-white" : "bg-white text-ink")}>
            {STAGE_LABELS[s]} ({counts[s]})
          </Link>
        ))}
      </nav>
      <nav aria-label="Filter by type" className="mt-2 flex flex-wrap gap-2">
        <Link href={qs({ type: null })} className={cn("rounded-full px-3 py-1.5 text-sm font-semibold", !type ? "bg-royal text-white" : "text-royal underline")}>All types</Link>
        {PARTNER_TYPES.map((t) => (
          <Link key={t.id} href={qs({ type: t.id })} className={cn("rounded-full px-3 py-1.5 text-sm font-semibold", type === t.id ? "bg-royal text-white" : "text-royal underline")}>
            {t.short}
          </Link>
        ))}
      </nav>

      {shown.length === 0 ? (
        <p className="mt-8 rounded-[2rem] bg-white p-8 text-center text-ink-soft ring-1 ring-inset ring-sky-200">No applications here yet.</p>
      ) : (
        <ul className="mt-6 grid gap-3">
          {shown.map((a) => (
            <li key={a.id}>
              <Link href={`/partners/review/${a.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[1.5rem] bg-white p-4 ring-1 ring-inset ring-sky-200 hover:ring-royal">
                <span className={cn("rounded-full px-3 py-1 font-display text-xs font-bold", stageTone[a.status])}>{STAGE_LABELS[a.status]}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-lg font-bold text-ink">{String(a.fields.business ?? "")}</span>
                  <span className="block text-sm text-ink-soft">
                    {PARTNER_TYPES.find((t) => t.id === a.type)?.short} · {String(a.fields.country ?? "")} · {a.id}
                  </span>
                </span>
                <span className="text-sm text-ink-soft">{new Date(a.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                {a.notification.status === "failed" && <span className="rounded-full bg-berry-soft px-2.5 py-1 text-xs font-bold text-ink">Email failed</span>}
                {screeningFlags(a.type, a.fields).some((f) => f.level === "serious") && (
                  <span className="rounded-full bg-berry-soft px-2.5 py-1 text-xs font-bold text-ink">Safety check</span>
                )}
                {pastRetention(a) && <span className="rounded-full bg-lemon-soft px-2.5 py-1 text-xs font-bold text-ink">Past retention</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
