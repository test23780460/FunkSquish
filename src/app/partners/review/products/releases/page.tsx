import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { reviewConfig } from "@/lib/partners/config";
import { requireReviewer } from "@/lib/partners/review-auth";
import { ownerDataStore } from "@/lib/owner/data";
import { currentRelease, KEEP_RELEASES, listReleases } from "@/commerce/catalog-admin/store";
import { catalogSource } from "@/commerce/catalog";
import { ReviewLogin } from "@/components/partners/ReviewLogin";
import { OwnerNav, OwnerSubNav, PRODUCT_TABS } from "@/components/owner/OwnerNav";
import { Check } from "@/components/owner/Fields";
import { Empty, Flash, OwnerShell, PageTitle, Pill, card, dateTime, one, secondary } from "@/components/owner/OwnerUi";
import { cn } from "@/lib/cn";
import { rollbackAction } from "../actions";

export const metadata: Metadata = { title: "Website catalog", robots: { index: false, follow: false } };

/** PRIVATE: every version of the public catalog, and a one-step rollback. */
export default function ReleasesPage({ searchParams }: PageProps<"/partners/review/products/releases">) {
  if (!reviewConfig()) notFound();
  return (
    <OwnerShell>
      <Releases searchParams={searchParams} />
    </OwnerShell>
  );
}

async function Releases({ searchParams }: { searchParams: PageProps<"/partners/review/products/releases">["searchParams"] }) {
  await connection();
  const ctx = await requireReviewer();
  if (!ctx) return <ReviewLogin />;
  const sp = await searchParams;
  const data = await ownerDataStore(ctx.cfg);
  const [releases, live, source] = await Promise.all([listReleases(data), currentRelease(data), catalogSource()]);
  return (
    <div>
      <OwnerNav current="products" />
      <OwnerSubNav label="Product pages" items={PRODUCT_TABS} current="/partners/review/products/releases" />
      <PageTitle
        title="Website catalog & rollback"
        lead={`Each time you publish, unpublish or archive a product, the website's catalog is saved as a new numbered release. If something goes wrong, show an earlier one again — it's saved as a new release, so nothing is lost. The last ${KEEP_RELEASES} are kept.`}
      />
      <Flash ok={one(sp.ok)} error={one(sp.error)} />
      <p className={cn(card, "mb-4 text-sm text-ink")}>
        The website is showing:{" "}
        <strong>{source === "release" ? `release ${live?.seq} (${live?.products.length} product${live?.products.length === 1 ? "" : "s"})` : source === "local" ? "the build-time catalog (no release has products yet)" : "the illustrated preview samples (nothing published yet)"}</strong>
        . After a change, the shop updates right away; other pages within an hour at most.
      </p>
      {releases.length === 0 ? (
        <Empty>No releases yet. The first one is made when you publish your first product.</Empty>
      ) : (
        <ol className="grid gap-3">
          {releases.map((r) => (
            <li key={r.seq} className={cn(card, "flex flex-wrap items-center justify-between gap-3 p-4", live?.seq === r.seq && "ring-2 ring-mint")}>
              <span>
                <span className="font-display text-lg font-bold text-ink">Release {r.seq}</span> {live?.seq === r.seq && <Pill tone="good">On the website</Pill>}
                <span className="block text-sm text-ink">{r.change}</span>
                <span className="block text-xs text-ink-soft">
                  {dateTime(r.at)} · {r.count} product(s)
                </span>
              </span>
              {live?.seq !== r.seq && (
                <form action={rollbackAction} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="seq" value={r.seq} />
                  <Check name="confirm" title="Show this again" />
                  <button className={secondary}>Roll back</button>
                </form>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
