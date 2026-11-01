import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { reviewConfig } from "@/lib/partners/config";
import { requireReviewer } from "@/lib/partners/review-auth";
import { ownerDataStore } from "@/lib/owner/data";
import { readinessContextFor } from "@/lib/owner/products";
import { currentRelease, listRecords, liveDiffers } from "@/commerce/catalog-admin/store";
import { CATEGORY_SLUGS, type ProductRecord } from "@/commerce/catalog-admin/record";
import { productReadiness } from "@/commerce/catalog-admin/readiness";
import { getCategory } from "@/commerce/categories";
import { formatMoney } from "@/commerce/availability";
import { catalogSource } from "@/commerce/catalog";
import { purchasingEnabled } from "@/lib/features";
import { ReviewLogin } from "@/components/partners/ReviewLogin";
import { OwnerNav, OwnerSubNav, PRODUCT_TABS } from "@/components/owner/OwnerNav";
import { Empty, Flash, OwnerShell, PageTitle, Pill, card, input, label, one, primary, secondary } from "@/components/owner/OwnerUi";
import { cn } from "@/lib/cn";
import { cleanupMediaAction, createProductAction } from "./actions";

export const metadata: Metadata = { title: "Products", robots: { index: false, follow: false } };

/** PRIVATE: every product in the dashboard, with how close each is to launch-ready. */
export default function ProductsPage({ searchParams }: PageProps<"/partners/review/products">) {
  if (!reviewConfig()) notFound();
  return (
    <OwnerShell>
      <Products searchParams={searchParams} />
    </OwnerShell>
  );
}

const FILTERS = { all: "All", draft: "Drafts", ready: "Ready to publish", published: "On the website", changed: "Unpublished changes", archived: "Archived" } as const;
type Filter = keyof typeof FILTERS;

async function Products({ searchParams }: { searchParams: PageProps<"/partners/review/products">["searchParams"] }) {
  await connection();
  const ctx = await requireReviewer();
  if (!ctx) return <ReviewLogin />;
  const sp = await searchParams;
  const data = await ownerDataStore(ctx.cfg);
  const [records, live, source] = await Promise.all([listRecords(data), currentRelease(data), catalogSource()]);
  const rows = await Promise.all(
    records.map(async (r) => ({ r, readiness: productReadiness(r, await readinessContextFor(data, r.id, records)), changed: liveDiffers(r, live) })),
  );
  const f = (one(sp.f) ?? "all") as Filter;
  const filter: Filter = f in FILTERS ? f : "all";
  const q = (one(sp.q) ?? "").trim().toLowerCase();
  const match = (x: (typeof rows)[number]) => {
    if (q && !`${x.r.product.name} ${x.r.product.slug} ${x.r.product.variants.map((v) => v.sku).join(" ")} ${x.r.product.tags.join(" ")}`.toLowerCase().includes(q)) return false;
    if (filter === "draft") return x.r.status === "draft";
    if (filter === "ready") return x.r.status === "draft" && x.readiness.ready;
    if (filter === "published") return x.r.status === "published";
    if (filter === "changed") return x.changed;
    if (filter === "archived") return x.r.status === "archived";
    return x.r.status !== "archived";
  };
  const shown = rows.filter(match);
  const count = (k: Filter) => rows.filter((x) => (k === "all" ? x.r.status !== "archived" : k === "draft" ? x.r.status === "draft" : k === "ready" ? x.r.status === "draft" && x.readiness.ready : k === "published" ? x.r.status === "published" : k === "changed" ? x.changed : x.r.status === "archived")).length;
  const tags = [...rows.flatMap((x) => x.r.product.tags).reduce((m, t) => m.set(t, (m.get(t) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1]);

  return (
    <div>
      <OwnerNav current="products" />
      <OwnerSubNav label="Product pages" items={PRODUCT_TABS} current="/partners/review/products" />
      <PageTitle
        title="Products"
        lead={
          <>
            Drafts stay private. Publishing puts a product on the website only once every launch-readiness item passes
            {purchasingEnabled ? "." : " — and even then nobody can buy it until purchasing is switched on."} The website shows:{" "}
            <strong>{source === "release" ? `your published catalog (release ${live?.seq})` : source === "local" ? "the build-time catalog" : "the illustrated preview samples"}</strong>.
          </>
        }
      />
      <Flash ok={one(sp.ok)} error={one(sp.error)} />

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div>
          <form className="mb-3 flex flex-wrap gap-2" action="/partners/review/products">
            <input type="hidden" name="f" value={filter} />
            <input name="q" defaultValue={q} placeholder="Search name, SKU or tag" aria-label="Search products" className={cn(input, "max-w-xs rounded-full")} />
            <button className={secondary}>Search</button>
          </form>
          <nav aria-label="Filter products" className="mb-4 flex flex-wrap gap-2">
            {(Object.keys(FILTERS) as Filter[]).map((k) => (
              <Link key={k} href={`/partners/review/products?f=${k}${q ? `&q=${encodeURIComponent(q)}` : ""}`} aria-current={filter === k ? "page" : undefined} className={cn("inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold", filter === k ? "bg-ink text-white" : "bg-white text-ink ring-1 ring-inset ring-sky-200")}>
                {FILTERS[k]} ({count(k)})
              </Link>
            ))}
          </nav>
          {records.length === 0 ? (
            <Empty>
              No products in the dashboard yet. Add your first one on the right, or <Link href="/partners/review/products/import" className="font-semibold text-royal underline">import the catalog spreadsheet</Link>. Nothing you add here appears on the website until you publish it.
            </Empty>
          ) : shown.length === 0 ? (
            <Empty>No products match.</Empty>
          ) : (
            <ul className="grid gap-3">
              {shown.map(({ r, readiness, changed }) => (
                <ProductRow key={r.id} r={r} done={readiness.items.filter((i) => i.ok).length} total={readiness.items.length} ready={readiness.ready} changed={changed} />
              ))}
            </ul>
          )}
        </div>

        <aside className="space-y-4">
          <form id="new" action={createProductAction} className={cn(card, "grid gap-3")}>
            <h2 className="font-display text-lg font-bold text-ink">New product</h2>
            <label className={label}>
              Name
              <input name="name" required maxLength={80} className={input} placeholder="e.g. Berry Burst Slushie" />
            </label>
            <label className={label}>
              Web address (optional)
              <input name="slug" maxLength={60} pattern="[a-z0-9]+(-[a-z0-9]+)*" className={input} placeholder="made from the name" />
            </label>
            <label className={label}>
              Category
              <select name="category" required className={input} defaultValue="">
                <option value="" disabled>
                  Pick one
                </option>
                {CATEGORY_SLUGS.map((c) => (
                  <option key={c} value={c}>
                    {getCategory(c)?.name ?? c}
                  </option>
                ))}
              </select>
            </label>
            <button className={primary}>Create draft</button>
          </form>

          <section className={card} aria-labelledby="cols">
            <h2 id="cols" className="font-display text-lg font-bold text-ink">Collections (tags)</h2>
            <p className="mt-1 text-sm text-ink-soft">
              Categories are the shop&apos;s four fixed sections (each has its own colors and art). Collections are tags you add on each product — use them for drops, themes or bundles.
            </p>
            {tags.length ? (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {tags.map(([t, n]) => (
                  <li key={t}>
                    <Link href={`/partners/review/products?q=${encodeURIComponent(t)}`} className="inline-flex rounded-full bg-ice px-2.5 py-1 text-xs font-bold text-ink hover:ring-2 hover:ring-royal">
                      {t} · {n}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-ink-soft">No tags yet.</p>
            )}
          </section>

          <form action={cleanupMediaAction} className={card}>
            <h2 className="font-display text-lg font-bold text-ink">Unused files</h2>
            <p className="mt-1 text-sm text-ink-soft">Delete uploaded photos no product (and no kept catalog release) uses. Files on the website are never touched.</p>
            <button className={cn(secondary, "mt-2")}>Delete unused files</button>
          </form>
        </aside>
      </div>
    </div>
  );
}

function ProductRow({ r, done, total, ready, changed }: { r: ProductRecord; done: number; total: number; ready: boolean; changed: boolean }) {
  const prices = r.product.variants.flatMap((v) => (v.price ? [v.price.amount] : []));
  const thumb = r.product.media.find((m) => m.type === "image");
  return (
    <li>
      <Link href={`/partners/review/products/${encodeURIComponent(r.id)}`} className={cn(card, "flex items-center gap-4 p-3 hover:ring-royal")}>
        <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-ice-50 ring-1 ring-inset ring-sky-200">
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element -- private owner-only file (needs the session cookie, so not through the image optimizer)
            <img src={thumb.src.replace("/media/", "/partners/review/products/media/")} alt="" className="size-full object-cover" />
          ) : (
            <span className="text-xs text-ink-soft">No photo</span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-lg font-bold text-ink">{r.product.name}</span>
          <span className="block text-sm text-ink-soft">
            {getCategory(r.product.category)?.name} · {r.product.variants.length} variant(s)
            {prices.length ? ` · ${formatMoney({ amount: Math.min(...prices), currency: "USD" })}${prices.length > 1 && Math.max(...prices) !== Math.min(...prices) ? "+" : ""}` : " · no price"}
          </span>
        </span>
        <span className="flex flex-col items-end gap-1">
          <Pill tone={r.status === "published" ? "good" : r.status === "archived" ? "plain" : ready ? "dark" : "warn"}>
            {r.status === "published" ? "On the website" : r.status === "archived" ? "Archived" : ready ? "Ready to publish" : "Draft"}
          </Pill>
          {changed && <Pill tone="warn">Unpublished changes</Pill>}
          <span className="text-xs text-ink-soft">
            Checklist {done}/{total}
          </span>
        </span>
      </Link>
    </li>
  );
}
