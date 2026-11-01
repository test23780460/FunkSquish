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
import { Chips, Empty, Flash, OwnerShell, PageTitle, Pill, Progress, SearchBar, card, hint, input, label, one, primary, secondary, small } from "@/components/owner/OwnerUi";
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
        actions={
          <a href="#new" className={primary}>
            + New product
          </a>
        }
        lead={
          <>
            Drafts stay private. Publishing puts a product on the website only once every launch-readiness item passes
            {purchasingEnabled ? "." : " — and even then nobody can buy it until purchasing is switched on."}
          </>
        }
        meta={
          <Pill tone={source === "release" ? "good" : "info"}>
            Website shows: {source === "release" ? `your published catalog (release ${live?.seq})` : source === "local" ? "the build-time catalog" : "the illustrated preview samples"}
          </Pill>
        }
      />
      <Flash ok={one(sp.ok)} error={one(sp.error)} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-4">
          <div className="flex flex-col gap-3">
            <SearchBar action="/partners/review/products" value={q} placeholder="Search name, SKU or tag" label="Search products" hidden={{ f: filter }} />
            <Chips
              label="Filter products"
              items={(Object.keys(FILTERS) as Filter[]).map((k) => ({ href: `/partners/review/products?f=${k}${q ? `&q=${encodeURIComponent(q)}` : ""}`, label: FILTERS[k], count: count(k), active: filter === k }))}
            />
          </div>
          {records.length === 0 ? (
            <Empty
              title="No products yet"
              action={
                <>
                  <a href="#new" className={primary}>
                    Add your first product
                  </a>
                  <Link href="/partners/review/products/import" className={secondary}>
                    Import a spreadsheet
                  </Link>
                </>
              }
            >
              Nothing you add here appears on the website until you publish it.
            </Empty>
          ) : shown.length === 0 ? (
            <Empty title="No products match" action={<Link href="/partners/review/products" className={secondary}>Clear filters</Link>}>
              Try another search or filter.
            </Empty>
          ) : (
            <ul className="grid gap-3">
              {shown.map(({ r, readiness, changed }) => (
                <ProductRow key={r.id} r={r} done={readiness.items.filter((i) => i.ok).length} total={readiness.items.length} ready={readiness.ready} changed={changed} />
              ))}
            </ul>
          )}
        </div>

        <aside className="space-y-5 lg:sticky lg:top-28">
          <form id="new" action={createProductAction} className={cn(card, "grid scroll-mt-28 gap-4")}>
            <div>
              <h2 className="font-display text-lg font-bold text-ink">New product</h2>
              <p className={hint}>Starts as a private draft. You fill in the rest on the next page.</p>
            </div>
            <label className={label}>
              Name
              <input name="name" required maxLength={80} className={input} placeholder="e.g. Berry Burst Slushie" />
            </label>
            <label className={label}>
              Web address <span className="font-normal text-ink-soft">(optional)</span>
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
            <h2 id="cols" className="font-display text-lg font-bold text-ink">Collections</h2>
            <p className={cn(hint, "mt-1 text-sm")}>
              Categories are the shop&apos;s four fixed sections. Collections are tags you add to products — for drops, themes or bundles.
            </p>
            {tags.length ? (
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {tags.map(([t, n]) => (
                  <li key={t}>
                    <Link href={`/partners/review/products?q=${encodeURIComponent(t)}`} className="inline-flex min-h-8 items-center gap-1 rounded-full bg-ice-50 px-2.5 text-xs font-bold text-ink ring-1 ring-inset ring-sky-200 hover:ring-royal">
                      {t} <span className="text-ink-soft">{n}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-ink-soft">No tags yet.</p>
            )}
          </section>

          <form action={cleanupMediaAction} className={card}>
            <h2 className="font-display text-lg font-bold text-ink">Unused files</h2>
            <p className={cn(hint, "mt-1 text-sm")}>Delete uploaded photos no product (and no kept catalog release) uses. Files on the website are never touched.</p>
            <button className={cn(secondary, small, "mt-3")}>Delete unused files</button>
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
      <Link
        href={`/partners/review/products/${encodeURIComponent(r.id)}`}
        className={cn(card, "grid grid-cols-[4rem_minmax(0,1fr)] items-center gap-x-4 gap-y-3 p-3 transition-shadow hover:ring-2 hover:ring-royal sm:grid-cols-[4.5rem_minmax(0,1fr)_11rem] sm:p-4 motion-reduce:transition-none")}
      >
        <span className="row-span-2 grid size-16 place-items-center overflow-hidden rounded-2xl bg-ice-50 ring-1 ring-inset ring-sky-200 sm:row-span-1 sm:size-[4.5rem]">
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element -- private owner-only file (needs the session cookie, so not through the image optimizer)
            <img src={thumb.src.replace("/media/", "/partners/review/products/media/")} alt="" className="size-full object-cover" />
          ) : (
            <span className="px-1 text-center text-[0.7rem] font-semibold leading-tight text-ink-soft">No photo</span>
          )}
        </span>
        <span className="min-w-0">
          <span className="block font-display text-base font-bold leading-snug text-ink sm:text-lg">{r.product.name}</span>
          <span className="mt-0.5 block text-sm text-ink-soft">
            {getCategory(r.product.category)?.name} · {r.product.variants.length} variant{r.product.variants.length === 1 ? "" : "s"}
            {prices.length ? ` · ${formatMoney({ amount: Math.min(...prices), currency: "USD" })}${prices.length > 1 && Math.max(...prices) !== Math.min(...prices) ? "+" : ""}` : " · no price"}
          </span>
          <span className="mt-2 flex flex-wrap gap-1.5">
            <Pill tone={r.status === "published" ? "good" : r.status === "archived" ? "plain" : ready ? "info" : "warn"}>
              {r.status === "published" ? "On the website" : r.status === "archived" ? "Archived" : ready ? "Ready to publish" : "Draft"}
            </Pill>
            {changed && <Pill tone="warn">Unpublished changes</Pill>}
          </span>
        </span>
        <span className="col-start-2 sm:col-start-auto">
          <Progress done={done} total={total} label="Launch checklist" />
        </span>
      </Link>
    </li>
  );
}
