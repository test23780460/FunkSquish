import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { reviewConfig } from "@/lib/partners/config";
import { requireReviewer } from "@/lib/partners/review-auth";
import { buildTimeProducts } from "@/lib/owner/products";
import { ReviewLogin } from "@/components/partners/ReviewLogin";
import { OwnerNav, OwnerSubNav, PRODUCT_TABS } from "@/components/owner/OwnerNav";
import { Flash, OwnerShell, PageTitle, card, label, one, primary, secondary } from "@/components/owner/OwnerUi";
import { cn } from "@/lib/cn";
import { importBuildCatalogAction, importCsvAction } from "../actions";

export const metadata: Metadata = { title: "Import / export products", robots: { index: false, follow: false } };

/** PRIVATE: move the catalog spreadsheet in and out of the dashboard. */
export default function ImportPage({ searchParams }: PageProps<"/partners/review/products/import">) {
  if (!reviewConfig()) notFound();
  return (
    <OwnerShell>
      <Import searchParams={searchParams} />
    </OwnerShell>
  );
}

async function Import({ searchParams }: { searchParams: PageProps<"/partners/review/products/import">["searchParams"] }) {
  await connection();
  if (!(await requireReviewer())) return <ReviewLogin />;
  const sp = await searchParams;
  const buildTime = buildTimeProducts().filter((p) => p.publication !== "preview").length;
  return (
    <div>
      <OwnerNav current="products" />
      <OwnerSubNav label="Product pages" items={PRODUCT_TABS} current="/partners/review/products/import" />
      <PageTitle title="Import / export" lead="Use the same spreadsheet as before (templates/catalog-template.csv). Imported products arrive as private drafts; nothing is published, and the 'verified' ticks for prices and costs start off so you confirm each one." />
      <Flash ok={one(sp.ok)} error={one(sp.error)} />
      <div className="grid gap-5 lg:grid-cols-2">
        <form action={importCsvAction} className={cn(card, "grid gap-3")}>
          <h2 className="font-display text-xl font-bold text-ink">Import the catalog spreadsheet</h2>
          <p className="text-sm text-ink-soft">
            New web addresses become new drafts. Existing ones get the sheet&apos;s values as a new revision (published products then show &ldquo;edits not published yet&rdquo; until you publish them). Private columns (costs, supplier, compliance) go to private fields only. Press &ldquo;Check only&rdquo; first.
          </p>
          <label className={label}>
            Catalog .csv (up to 2 MB)
            <input name="file" type="file" accept=".csv,text/csv" required className="text-sm" />
          </label>
          <div className="flex flex-wrap gap-2">
            <button name="intent" value="check" className={secondary}>Check only</button>
            <button name="intent" value="import" className={primary}>Import as drafts</button>
          </div>
        </form>

        <section className={cn(card, "grid gap-3")}>
          <h2 className="font-display text-xl font-bold text-ink">Export</h2>
          <p className="text-sm text-ink-soft">Download every dashboard product as the catalog spreadsheet — for backups, for editing in a spreadsheet and importing again, or for `npm run catalog:import`.</p>
          <div className="flex flex-wrap gap-2">
            <a href="/partners/review/products/export" className={secondary} download>
              Public columns only
            </a>
            <a href="/partners/review/products/export?private=1" className={primary} download>
              With private costs &amp; suppliers
            </a>
          </div>
          <p className="text-xs text-ink-soft">The private file holds your costs and supplier details: keep it in your private folder, never in GitHub or an email.</p>
        </section>

        <form action={importBuildCatalogAction} className={cn(card, "grid gap-3 lg:col-span-2")}>
          <h2 className="font-display text-xl font-bold text-ink">Copy the build-time catalog</h2>
          <p className="text-sm text-ink-soft">
            The website was built with {buildTime} real product{buildTime === 1 ? "" : "s"} from products.json. Copying makes them dashboard drafts (with the same ids, so stock and order history stay linked). Their private columns aren&apos;t on the server — import your private spreadsheet afterwards to add costs and compliance.
          </p>
          <div>
            <button className={secondary} disabled={buildTime === 0}>
              {buildTime ? "Copy them as drafts" : "Nothing to copy"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
