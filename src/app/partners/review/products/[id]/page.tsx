import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { reviewConfig } from "@/lib/partners/config";
import { requireReviewer } from "@/lib/partners/review-auth";
import { ownerDataStore } from "@/lib/owner/data";
import { readinessContextFor, supplierOptions } from "@/lib/owner/products";
import { currentRelease, getRecord, liveDiffers } from "@/commerce/catalog-admin/store";
import { CATEGORY_SLUGS, COMPLIANCE_STATUSES, TEXTURE_IDS, type ProductRecord } from "@/commerce/catalog-admin/record";
import { productReadiness } from "@/commerce/catalog-admin/readiness";
import { VIDEO_SHAPES } from "@/commerce/catalog-admin/media";
import { SHIPPING_ORIGINS } from "@/commerce/origins";
import { getCategory } from "@/commerce/categories";
import { getTexture } from "@/content/textures";
import type { ProductVariant } from "@/commerce/types";
import { ReviewLogin } from "@/components/partners/ReviewLogin";
import { OwnerNav } from "@/components/owner/OwnerNav";
import { Area, Check, FieldGroup, Rev, Select, Text } from "@/components/owner/Fields";
import { Empty, Flash, Missing, OwnerShell, PageTitle, Pill, Progress, card, danger, dateTime, hint, input, label, one, primary, secondary, small , fileInput } from "@/components/owner/OwnerUi";
import { cn } from "@/components/owner/cn";
import {
  deleteDraftAction,
  mediaAction,
  publishAction,
  removeVariantAction,
  restoreAction,
  saveBasicsAction,
  saveSafetyAction,
  saveVariantAction,
  unpublishAction,
  uploadMediaAction,
} from "../actions";

export const metadata: Metadata = { title: "Edit product", robots: { index: false, follow: false } };

// Private, per-request page: no shared instant-navigation shell needed.
export const instant = false;

/** PRIVATE: one product — every field, its photos, its private costs, and its launch checklist. */
export default function ProductEditorPage({ params, searchParams }: PageProps<"/partners/review/products/[id]">) {
  if (!reviewConfig()) notFound();
  return (
    <OwnerShell>
      <Editor params={params} searchParams={searchParams} />
    </OwnerShell>
  );
}

const dollars = (c: number | null | undefined) => (c === null || c === undefined ? "" : (c / 100).toFixed(2));
const ownerSrc = (src: string) => src.replace(/^\/media\//, "/partners/review/products/media/");

async function Editor({ params, searchParams }: { params: PageProps<"/partners/review/products/[id]">["params"]; searchParams: PageProps<"/partners/review/products/[id]">["searchParams"] }) {
  await connection();
  const ctx = await requireReviewer();
  if (!ctx) return <ReviewLogin />;
  const { id } = await params;
  const sp = await searchParams;
  const data = await ownerDataStore(ctx.cfg);
  const r = await getRecord(data, decodeURIComponent(id));
  if (!r) notFound();
  const [live, readinessCtx, suppliers] = await Promise.all([currentRelease(data), readinessContextFor(data, r.id), supplierOptions(data)]);
  const readiness = productReadiness(r, readinessCtx);
  const changed = liveDiffers(r, live);
  const p = r.product;

  const done = readiness.items.filter((i) => i.ok).length;

  return (
    <div>
      <OwnerNav current="products" />
      <nav aria-label="Breadcrumb" className="mb-3 text-sm">
        <ol className="flex flex-wrap items-center gap-1.5 text-ink-soft">
          <li>
            <Link href="/partners/review/products" className="font-semibold text-royal hover:underline">
              Products
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="truncate font-semibold text-ink">
            {p.name}
          </li>
        </ol>
      </nav>
      <PageTitle
        title={p.name}
        meta={
          <>
            <Pill tone={r.status === "published" ? "good" : r.status === "archived" ? "plain" : "warn"}>{r.status === "published" ? "On the website" : r.status === "archived" ? "Archived" : "Draft (private)"}</Pill>
            {changed && <Pill tone="warn">Edits not published yet</Pill>}
            <span className="inline-flex items-center text-xs text-ink-soft">
              Revision {r.rev} · saved {dateTime(r.updatedAt)}
            </span>
          </>
        }
        actions={
          <>
            <Link href={`/partners/review/products/${encodeURIComponent(r.id)}/preview`} className={secondary}>
              Preview product page
            </Link>
            {r.status === "published" && (
              <a href={`/shop/${p.slug}`} className={secondary} target="_blank" rel="noopener">
                View on website ↗
              </a>
            )}
          </>
        }
      />
      <Flash ok={one(sp.ok)} error={one(sp.error)} />

      <nav aria-label="On this page" className="-mx-4 mb-5 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 lg:hidden">
        <ul className="flex w-max gap-2">
          {[
            ["#publish", `Checklist ${done}/${readiness.items.length}`],
            ["#basics", "Basics"],
            ["#variants", "Variants & prices"],
            ["#media", "Photos"],
            ["#safety", "Safety"],
            ["#history", "History"],
          ].map(([href, text]) => (
            <li key={href}>
              <a href={href} className="inline-flex min-h-10 items-center whitespace-nowrap rounded-full bg-white px-3.5 text-sm font-semibold text-ink ring-1 ring-inset ring-sky-200 hover:bg-ice-50">
                {text}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <aside className="space-y-4 lg:sticky lg:top-28 lg:order-last">
          <section id="publish" aria-labelledby="ready" className={cn(card, "scroll-mt-28", readiness.ready ? "ring-2 ring-[#9fe3cf]" : "")}>
            <h2 id="ready" className="font-display text-lg font-bold text-ink">
              Launch checklist
            </h2>
            <div className="mt-3">
              <Progress done={done} total={readiness.items.length} label={readiness.ready ? "Ready to publish" : "Items done"} />
            </div>
            <ul className="mt-4 space-y-2.5">
              {readiness.items.map((i) => (
                <li key={i.id} className="flex items-start gap-2.5 text-sm">
                  <span aria-hidden="true" className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[0.65rem] font-black", i.ok ? "bg-[#1d9e7e] text-white" : "bg-berry-soft text-[#a3174f] ring-1 ring-inset ring-[#f2b9cd]")}>
                    {i.ok ? "✓" : "!"}
                  </span>
                  <span className="min-w-0">
                    <span className={cn("font-semibold", i.ok ? "text-ink" : "text-[#a3174f]")}>
                      {i.label}
                      <span className="sr-only">{i.ok ? " — done" : " — not done"}</span>
                    </span>
                    {!i.ok && (
                      <ul className="mt-0.5 space-y-0.5 text-xs text-ink-soft">
                        {i.missing.slice(0, 6).map((m) => (
                          <li key={m}>· {m}</li>
                        ))}
                      </ul>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            <PublishControls r={r} ready={readiness.ready} changed={changed} />
          </section>
        </aside>

        <div className="min-w-0 space-y-6">
          <Basics r={r} />
          <Variants r={r} suppliers={suppliers} />
          <Media r={r} />
          <Safety r={r} />
          <Section id="history" title="History">
            <ol className="divide-y divide-sky-100 text-sm">
              {r.history.map((h, i) => (
                <li key={i} className="flex flex-col gap-0.5 py-2 sm:flex-row sm:justify-between sm:gap-4">
                  <span className="text-ink">{h.summary}</span>
                  <time className="shrink-0 text-xs text-ink-soft sm:text-sm" dateTime={h.at}>
                    {dateTime(h.at)}
                  </time>
                </li>
              ))}
            </ol>
          </Section>
        </div>
      </div>
    </div>
  );
}

function PublishControls({ r, ready, changed }: { r: ProductRecord; ready: boolean; changed: boolean }) {
  if (r.status === "archived")
    return (
      <form action={restoreAction} className="mt-4">
        <Rev id={r.id} rev={r.rev} />
        <button className={secondary}>Restore to drafts</button>
      </form>
    );
  return (
    <div className="mt-4 space-y-3 border-t border-sky-100 pt-4">
      {(r.status === "draft" || changed) &&
        (ready ? (
          <form action={publishAction} className="grid gap-2">
            <Rev id={r.id} rev={r.rev} />
            <Check name="confirm" title="I checked the preview and every fact on it is true" />
            <button className={primary}>{r.status === "published" ? "Publish these changes" : "Publish to the website"}</button>
            <p className={hint}>It appears in the shop right away. Buying stays closed until purchasing is switched on.</p>
          </form>
        ) : (
          <p className="rounded-xl bg-ice-50 px-3 py-2.5 text-sm text-ink-soft">Publishing unlocks when every item above is done. You can keep saving the draft meanwhile.</p>
        ))}
      {r.status === "published" && (
        <form action={unpublishAction} className="flex flex-wrap gap-2">
          <Rev id={r.id} rev={r.rev} />
          <button name="to" value="draft" className={secondary}>
            Take off the website
          </button>
          <button name="to" value="archived" className={danger}>
            Archive
          </button>
        </form>
      )}
      {r.status === "draft" && !r.publishedAt && (
        <details className="text-sm">
          <summary className="cursor-pointer font-semibold text-[#a3174f]">Delete this draft…</summary>
          <form action={deleteDraftAction} className="mt-2 grid gap-2">
            <Rev id={r.id} rev={r.rev} />
            <label className={label}>
              Type DELETE to confirm
              <input name="confirm" className={input} autoComplete="off" />
            </label>
            <button className={danger}>Delete draft</button>
          </form>
        </details>
      )}
      {r.status === "draft" && r.publishedAt && (
        <form action={unpublishAction}>
          <Rev id={r.id} rev={r.rev} />
          <button name="to" value="archived" className={danger}>
            Archive
          </button>
        </form>
      )}
    </div>
  );
}

function Section({ id, title, lead, children }: { id: string; title: string; lead?: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-t`} className={cn(card, "scroll-mt-28")}>
      <h2 id={`${id}-t`} className="font-display text-lg font-bold text-ink sm:text-xl">
        {title}
      </h2>
      {lead && <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-soft">{lead}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

/** The save row at the bottom of a form. */
function SaveBar({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center justify-end gap-2 border-t border-sky-100 pt-4">{children}</div>;
}

function Basics({ r }: { r: ProductRecord }) {
  const p = r.product;
  return (
    <Section id="basics" title="Basics" lead="What shoppers read. Write only what's true of the real product.">
      <form action={saveBasicsAction} className="grid gap-5">
        <Rev id={r.id} rev={r.rev} />
        <FieldGroup title="Name & where it lives">
          <Text name="name" title="Name" value={p.name} required maxLength={80} />
          <Text name="slug" title="Web address" value={p.slug} required maxLength={60} hint={`funksquish.com/shop/${p.slug}${r.publishedAt ? " — changing it breaks links people already shared" : ""}`} />
          <Select name="category" title="Category" value={p.category} options={CATEGORY_SLUGS.map((c) => ({ value: c, label: getCategory(c)?.name ?? c }))} />
          <Text name="tags" title="Collections (tags, comma separated)" value={p.tags.join(", ")} maxLength={400} hint="e.g. summer-drop, best-seller" />
        </FieldGroup>
        <FieldGroup title="Descriptions" description="Shown on product cards and the product page." cols={1}>
          <Text name="shortDescription" title="One-line summary (product cards)" value={p.shortDescription} maxLength={160} />
          <Area name="description" title="Full description" value={p.description} rows={5} maxLength={4000} />
        </FieldGroup>
        <FieldGroup title="Product details">
          <Text name="material" title="Material" value={p.specs.material} maxLength={200} />
          <Text name="fill" title="Fill" value={p.specs.fill} maxLength={200} />
          <Text name="texture" title="Texture (in words)" value={p.specs.texture} maxLength={200} />
          <Text name="sizeDescription" title="Size" value={p.specs.sizeDescription} maxLength={200} hint="e.g. About 10 cm tall" />
        </FieldGroup>
        <FieldGroup title="Squish Lab textures" description="Only those confirmed with a real sample." cols={3}>
          {TEXTURE_IDS.map((t) => (
            <Check key={t} name={`texture-${t}`} title={getTexture(t)?.name ?? t} checked={p.textures?.includes(t)} />
          ))}
        </FieldGroup>
        <FieldGroup title="Shop settings">
          <Text name="featuredRank" title="Featured order (lower shows first)" value={p.featuredRank} inputMode="numeric" />
          <Text name="processingBusinessDays" title="Processing time (business days)" value={p.salesTerms?.processingBusinessDays ?? ""} inputMode="numeric" hint="Empty = the standard 2 days. Longer for supplier items." />
          <Select
            name="finalSaleOnceOpened"
            title="Final sale once opened?"
            value={p.salesTerms?.finalSaleOnceOpened === undefined ? "" : p.salesTerms.finalSaleOnceOpened ? "yes" : "no"}
            options={[
              { value: "", label: "Standard returns (not decided per product)" },
              { value: "no", label: "No — standard returns apply" },
              { value: "yes", label: "Yes — e.g. mystery / blind bags (damaged items still covered)" },
            ]}
            className="sm:col-span-2"
          />
        </FieldGroup>
        <SaveBar>
          <button className={primary}>Save basics</button>
        </SaveBar>
      </form>
    </Section>
  );
}

function VariantForm({ r, v, suppliers }: { r: ProductRecord; v?: ProductVariant; suppliers: { id: string; name: string }[] }) {
  const x = v ? r.private.variants[v.id] : undefined;
  return (
    <form action={saveVariantAction} className="grid gap-5">
      <Rev id={r.id} rev={r.rev} />
      {v && <input type="hidden" name="variantId" value={v.id} />}
      <FieldGroup title="Name & SKU" cols={3}>
        <Text name="variantName" title="Variant name" value={v?.name} required maxLength={60} placeholder="Pink" />
        <Text name="sku" title="SKU" value={v?.sku} required maxLength={40} placeholder="FS-BERRY-PINK" />
        <Text name="swatch" title="Color swatch" value={v?.swatch ?? "#4ea8ff"} type="color" />
      </FieldGroup>
      <FieldGroup title="Price" description="What shoppers pay. A was-price is shown only when it's real." cols={3}>
        <Text name="price" title="Price ($)" value={dollars(v?.price?.amount)} inputMode="decimal" placeholder="12.99" />
        <Text name="compareAt" title="Was-price ($, optional)" value={dollars(v?.compareAtPrice?.amount)} inputMode="decimal" />
        <Text name="compareAtBasis" title="Was-price basis (private)" value={x?.compareAtBasis} maxLength={300} hint="When/where it really sold at that price" />
        <div className="sm:col-span-3">
          <Check name="priceVerified" title="Price verified" checked={x?.priceVerified} hint="You decided this price and any was-price is real" />
        </div>
      </FieldGroup>
      <FieldGroup title="Cost (private)" description="Never shown on the website." cols={3}>
        <Text name="cost" title="Unit cost ($, private)" value={dollars(x?.costCents)} inputMode="decimal" />
        <Text name="landedCost" title="Landed cost ($, private)" value={dollars(x?.landedCostCents)} inputMode="decimal" hint="Incl. freight, duties, fees" />
        <Text name="invoiceRef" title="Invoice / quote reference (private)" value={x?.invoiceRef} maxLength={120} />
        <div className="sm:col-span-3">
          <Check name="costVerified" title="Cost checked against invoice/quote" checked={x?.costVerified} />
        </div>
      </FieldGroup>
      <FieldGroup title="Stock & packed size" cols={3}>
        <div className="flex items-end sm:col-span-3">
          <Check name="tracked" title="Track stock" checked={v ? v.inventory.tracked : true} />
        </div>
        <Text name="available" title="Starting stock count" value={v?.inventory.available ?? ""} inputMode="numeric" hint="After publishing, change stock on the Inventory page" />
        <Text name="weightGrams" title="Packed weight (g)" value={v?.weightGrams ?? ""} inputMode="numeric" />
        <span className="hidden sm:block" />
        <Text name="lengthCm" title="Box length (cm)" value={v?.dimensions?.lengthCm ?? ""} inputMode="decimal" />
        <Text name="widthCm" title="Box width (cm)" value={v?.dimensions?.widthCm ?? ""} inputMode="decimal" />
        <Text name="heightCm" title="Box height (cm)" value={v?.dimensions?.heightCm ?? ""} inputMode="decimal" />
      </FieldGroup>
      <FieldGroup title="Who ships it">
        <Select
          name="fulfillmentSource"
          title="Who ships it"
          value={v?.fulfillmentSource ?? "in_house"}
          options={[
            { value: "in_house", label: "FunkSquish (my stock)" },
            { value: "supplier", label: "A supplier ships it" },
          ]}
        />
        <Select name="fulfillmentOrigin" title="Ships from (origin)" value={v?.fulfillmentOrigin ?? ""} options={[{ value: "", label: "FunkSquish studio" }, ...SHIPPING_ORIGINS.filter((o) => o.source === "supplier").map((o) => ({ value: o.id, label: o.id }))]} hint="Supplier origins are added on the Shipping page" />
        <Select name="supplierId" title="Supplier (private)" value={x?.supplierId ?? ""} options={[{ value: "", label: suppliers.length ? "None" : "No suppliers yet" }, ...suppliers.map((s) => ({ value: s.id, label: s.name }))]} />
        <Text name="supplierSku" title="Supplier's SKU (private)" value={x?.supplierSku} maxLength={60} />
        <Text name="externalPurchaseUrl" title="Outside buy link (optional)" value={v?.externalPurchaseUrl} hint="e.g. its TikTok Shop listing" className="sm:col-span-2" />
      </FieldGroup>
      <SaveBar>
        <button className={primary}>{v ? "Save variant" : "Add variant"}</button>
      </SaveBar>
    </form>
  );
}

function Variants({ r, suppliers }: { r: ProductRecord; suppliers: { id: string; name: string }[] }) {
  return (
    <Section id="variants" title="Variants, prices & costs" lead="Each color/size is a variant with its own SKU. Costs, supplier details and invoice references are private — they never appear on the website.">
      {r.product.variants.length === 0 && (
        <div className="mb-4">
          <Empty compact>No variants yet. Even a single-option product needs one (call it &ldquo;Default&rdquo;).</Empty>
        </div>
      )}
      <div className="space-y-3">
        {r.product.variants.map((v) => (
          <details key={v.id} className="group rounded-2xl bg-white ring-1 ring-inset ring-sky-200 open:ring-royal/40">
            <summary className="flex min-h-14 cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl px-4 py-2.5 font-semibold text-ink hover:bg-ice-50 [&::-webkit-details-marker]:hidden">
              <span className="inline-block size-5 shrink-0 rounded-full ring-2 ring-white shadow-[0_0_0_1px_rgba(14,42,92,0.2)]" style={{ background: v.swatch }} aria-hidden="true" />
              <span className="min-w-0">{v.name}</span>
              <span className="font-mono text-xs text-ink-soft">{v.sku}</span>
              <span className="ml-auto flex items-center gap-2">
                {(v.fulfillmentSource ?? "in_house") === "supplier" && <Pill tone="info">Supplier ships</Pill>}
                <span className="text-sm tabular-nums">{v.price ? `$${dollars(v.price.amount)}` : <Missing what="No price" />}</span>
                <span aria-hidden="true" className="text-ink-soft transition-transform group-open:rotate-180 motion-reduce:transition-none">
                  ▾
                </span>
              </span>
            </summary>
            <div className="border-t border-sky-100 p-4">
              <VariantForm r={r} v={v} suppliers={suppliers} />
              <form action={removeVariantAction} className="mt-2">
                <Rev id={r.id} rev={r.rev} />
                <input type="hidden" name="variantId" value={v.id} />
                <button className={cn(danger, small, "mt-2")}>Remove this variant</button>
              </form>
            </div>
          </details>
        ))}
        <details className="rounded-2xl border-2 border-dashed border-sky-200 bg-ice-50/50" open={r.product.variants.length === 0}>
          <summary className="flex min-h-12 cursor-pointer list-none items-center px-4 font-display font-semibold text-royal hover:bg-ice-50 [&::-webkit-details-marker]:hidden">+ Add a variant</summary>
          <div className="border-t border-sky-100 p-4">
            <VariantForm r={r} suppliers={suppliers} />
          </div>
        </details>
      </div>
    </Section>
  );
}

function Media({ r }: { r: ProductRecord }) {
  const m = r.product.media;
  return (
    <Section id="media" title="Photos & videos" lead="Real photos of the real product only (yours, or licensed from the supplier in writing). The first one is the featured image. Photos up to 4 MB (JPEG, PNG, WebP); short videos up to 4 MB (MP4, WebM). Hidden data like GPS location is removed from photos.">
      {m.length === 0 ? (
        <div className="mb-4">
          <Empty compact>
            No photos yet — the shop uses the illustration until you add some. <Missing what="Needed to publish" />
          </Empty>
        </div>
      ) : (
        <ul className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {m.map((item, i) => (
            <li key={item.src} className="overflow-hidden rounded-2xl bg-white ring-1 ring-inset ring-sky-200">
              <div className="relative aspect-square overflow-hidden bg-ice-50">
                {item.type === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element -- private owner-only preview (needs the session cookie)
                  <img src={ownerSrc(item.src)} alt={item.alt} className="size-full object-contain" />
                ) : (
                  <video src={ownerSrc(item.src)} controls muted playsInline preload="metadata" className="size-full object-contain" aria-label={item.alt} />
                )}
                {i === 0 && <span className="absolute left-2 top-2 rounded-full bg-royal px-2.5 py-1 text-xs font-bold text-white shadow">Featured</span>}
                <span className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-xs font-bold tabular-nums text-ink shadow-sm">{i + 1}</span>
              </div>
              <form action={mediaAction} className="grid gap-2.5 p-3">
                <Rev id={r.id} rev={r.rev} />
                <input type="hidden" name="src" value={item.src} />
                <label className={label}>
                  Alt text (what it shows)
                  <input name="alt" defaultValue={item.alt} maxLength={200} className={input} />
                </label>
                <div className="flex flex-wrap gap-1.5">
                  <button name="op" value="alt" className={cn(secondary, small, "px-3")}>
                    Save text
                  </button>
                  {i > 0 && (
                    <button name="op" value="first" className={cn(secondary, small, "px-3")}>
                      Make featured
                    </button>
                  )}
                  {i > 0 && (
                    <button name="op" value="up" aria-label={`Move item ${i + 1} earlier`} className={cn(secondary, small, "px-3")}>
                      ↑
                    </button>
                  )}
                  {i < m.length - 1 && (
                    <button name="op" value="down" aria-label={`Move item ${i + 1} later`} className={cn(secondary, small, "px-3")}>
                      ↓
                    </button>
                  )}
                  <button name="op" value="remove" className={cn(danger, small, "px-3")}>
                    Remove
                  </button>
                </div>
              </form>
            </li>
          ))}
        </ul>
      )}
      <form action={uploadMediaAction} className="grid gap-4 rounded-2xl border-2 border-dashed border-sky-300 bg-ice-50/60 p-4 sm:grid-cols-2 sm:p-5">
        <Rev id={r.id} rev={r.rev} />
        <div className="flex items-center gap-3 sm:col-span-2">
          <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white text-xl text-royal shadow-sm ring-1 ring-sky-200">
            ↑
          </span>
          <div>
            <p className="font-display font-bold text-ink">Add a photo or video</p>
            <p className={hint}>JPEG, PNG or WebP photos · MP4 or WebM videos · up to 4 MB. Location data is removed from photos.</p>
          </div>
        </div>
        <label className={cn(label, "sm:col-span-2")}>
          Photo or video
          <input
            name="file"
            type="file"
            required
            accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
            className={fileInput}
          />
        </label>
        <Text name="alt" title="Alt text (what it shows)" required minLength={5} maxLength={200} placeholder="Pink jelly squishy shaped like a strawberry, squeezed in a hand" className="sm:col-span-2" />
        <Select name="videoShape" title="If it's a video: shape" value="portrait" options={Object.entries(VIDEO_SHAPES).map(([k, s]) => ({ value: k, label: s.label }))} />
        <div className="flex items-end justify-end">
          <button className={primary}>Upload</button>
        </div>
      </form>
    </Section>
  );
}

function Safety({ r }: { r: ProductRecord }) {
  const s = r.product.safety;
  const c = r.private.compliance;
  return (
    <Section id="safety" title="Safety, compliance & confirmations" lead="Copy age grading and warnings exactly from the product's label. Compliance documents stay in your private folder — record their names/references here, never upload certificates to the public site.">
      <form action={saveSafetyAction} className="grid gap-5">
        <Rev id={r.id} rev={r.rev} />
        <FieldGroup title="From the label" description="Copied exactly as printed.">
          <Text name="ageGrade" title="Age grade (exactly as labeled)" value={s.ageGrade} maxLength={40} placeholder="Ages 3+" />
          <Text name="countryOfOrigin" title="Country of origin" value={s.countryOfOrigin} maxLength={60} />
          <Text name="manufacturerOrImporter" title="Manufacturer or importer (as on the label)" value={s.manufacturerOrImporter} maxLength={160} className="sm:col-span-2" />
          <Area name="warnings" title="Warnings (one per line, exactly as printed)" value={s.warnings.join("\n")} rows={3} />
          <Area name="careInstructions" title="Care instructions (one per line)" value={s.careInstructions.join("\n")} rows={3} />
        </FieldGroup>
        <FieldGroup title="Compliance documents (private)" description="Record file names or references only — never upload certificates to the public site.">
          <Select name="complianceStatus" title="Compliance documents (private)" value={c.status} options={COMPLIANCE_STATUSES.map((x) => ({ value: x, label: x[0].toUpperCase() + x.slice(1) }))} hint="'Verified' = you read the certificate and the test report and they match this product" />
          <Text name="testLab" title="Test lab (CPSC-accepted)" value={c.testLab} maxLength={120} />
          <Text name="cpcFile" title="Children's Product Certificate (file name/ref)" value={c.cpcFile} maxLength={200} hint="e.g. private/compliance/berry-burst-cpc.pdf" />
          <Text name="testReportFile" title="Test report (file name/ref)" value={c.testReportFile} maxLength={200} />
          <Text name="testDate" title="Test date" value={c.testDate} type="date" />
          <Text name="trackingLabelPhoto" title="Tracking label photo (file name/ref)" value={c.trackingLabelPhoto} maxLength={200} />
          <Area name="notes" title="Private notes" value={r.private.notes} rows={2} maxLength={2000} className="sm:col-span-2" />
        </FieldGroup>
        <FieldGroup title="Confirmations" description="Each one is part of the launch checklist." cols={1}>
          <Check name="photosAuthentic" title="Every photo and video shows the real product" checked={r.private.photosAuthentic} hint="Your own photos, or ones the supplier licensed to you in writing. No stock images, no renders presented as photos." />
          <Check name="warningsReviewed" title="Warnings checked against the real label" checked={r.private.warningsReviewed} hint="An empty list is then a decision (the label has none), not a gap." />
          <Check name="shippingMeasured" title="Weights and box sizes measured on the real packed product" checked={r.private.shippingMeasured} />
        </FieldGroup>
        <SaveBar>
          <button className={primary}>Save safety &amp; compliance</button>
        </SaveBar>
      </form>
    </Section>
  );
}
