import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { reviewConfig } from "@/lib/partners/config";
import { requireReviewer } from "@/lib/partners/review-auth";
import { AUDIT_AREAS, listAudit, ownerDataStore, type AuditArea } from "@/lib/owner/data";
import { ReviewLogin } from "@/components/partners/ReviewLogin";
import { OwnerNav, OwnerSubNav, SETTINGS_TABS } from "@/components/owner/OwnerNav";
import { Empty, OwnerShell, PageTitle, Pill, card, dateTime, one } from "@/components/owner/OwnerUi";
import { cn } from "@/components/owner/cn";

export const metadata: Metadata = { title: "Activity log", robots: { index: false, follow: false } };

/** PRIVATE: every dashboard action (who-did-what), newest first. Stock changes have their own log on Inventory. */
export default function ActivityPage({ searchParams }: PageProps<"/partners/review/settings/activity">) {
  if (!reviewConfig()) notFound();
  return (
    <OwnerShell>
      <Activity searchParams={searchParams} />
    </OwnerShell>
  );
}

async function Activity({ searchParams }: { searchParams: PageProps<"/partners/review/settings/activity">["searchParams"] }) {
  await connection();
  const ctx = await requireReviewer();
  if (!ctx) return <ReviewLogin />;
  const sp = await searchParams;
  const a = one(sp.area);
  const area = (AUDIT_AREAS as readonly string[]).includes(a ?? "") ? (a as AuditArea) : undefined;
  const entries = await listAudit(await ownerDataStore(ctx.cfg), { days: 60, limit: 300, area });
  return (
    <div>
      <OwnerNav current="settings" />
      <OwnerSubNav label="Settings pages" items={SETTINGS_TABS} current="/partners/review/settings/activity" />
      <PageTitle title="Activity log" lead="Owner actions from the last 60 days. Stock changes are also on Inventory → Activity, and each order keeps its own history." />
      <nav aria-label="Filter by area" className="mb-4 flex flex-wrap gap-2">
        <Link href="/partners/review/settings/activity" className={cn("rounded-full px-3 py-1.5 text-sm font-semibold", !area ? "bg-royal text-white" : "text-royal underline")}>
          All
        </Link>
        {AUDIT_AREAS.map((x) => (
          <Link key={x} href={`/partners/review/settings/activity?area=${x}`} className={cn("rounded-full px-3 py-1.5 text-sm font-semibold capitalize", area === x ? "bg-royal text-white" : "text-royal underline")}>
            {x}
          </Link>
        ))}
      </nav>
      {entries.length === 0 ? (
        <Empty>No owner actions recorded{area ? ` for ${area}` : ""} in the last 60 days.</Empty>
      ) : (
        <ol className={cn(card, "divide-y divide-sky-100")}>
          {entries.map((e) => (
            <li key={e.id} className="flex flex-wrap items-start justify-between gap-2 py-2 text-sm">
              <span className="min-w-0">
                <Pill>{e.area}</Pill> <span className="font-semibold text-ink">{e.action}</span>
                {e.target && <span className="text-ink-soft"> · {e.target}</span>}
                <span className="block text-ink">{e.summary}</span>
              </span>
              <time dateTime={e.at} className="shrink-0 text-ink-soft">
                {dateTime(e.at)}
              </time>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
