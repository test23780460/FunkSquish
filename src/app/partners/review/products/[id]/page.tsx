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
import { Area, Check, Rev, Select, Text } from "@/components/owner/Fields";
import { Flash, Missing, OwnerShell, Pill, card, danger, dateTime, input, label, one, primary, secondary } from "@/components/owner/OwnerUi";
import { cn } from "@/lib/cn";
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

  return (
    <div>
      <OwnerNav current="products" />
      <nav aria-label="Breadcrumb" className="mb-3 text-sm">
        <Link href="/partners/review/products" className="font-semibold text-royal underline">
          ← All products
        </Link>
      </nav>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-bold text-ink sm:text-4xl">{p.name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-soft">
            <Pill tone={r.status === "published" ? "good" : r.status === "archived" ? "plain" : "warn"}>{r.status === "published" ? "On the website" : r.status === "archived" ? "Archived" : "Draft (private)"}</Pill>
            {changed && <Pill tone="warn">Edits not published yet</Pill>}
            <span>
              Revision {r.rev} · saved {dateTime(r.updatedAt)}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/partners/review/products/${encodeURIComponent(r.id)}/preview`} className={secondary}>
            Preview product page
          </Link>
          {r.status === "published" && (
            <a href={`/shop/${p.slug}`} className={secondary} target="_blank" rel="noopener">
              View on website
            </a>
          )}
        </div>
      </div>
      <Flash ok={one(sp.ok)} error={one(sp.error)} />

      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0 space-y-5">
          <Basics r={r} />
          <Variants r={r} suppliers={suppliers} />
          <Media r={r} />
          <Safety r={r} />
          <section className={card} aria-labelledby="hist">
            <h2 id="hist" className="font-display text-xl font-bold text-ink">History</h2>
            <ol className="mt-2 divide-y divide-sky-100 text-sm">
              {r.history.map((h, i) => (
                <li key={i} className="flex flex-wrap justify-between gap-2 py-1.5">
                  <span className="text-ink">{h.summary}</span>
                  <time className="text-ink-soft" dateTime={h.at}>
                    {dateTime(h.at)}
                  </time>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-28 lg:self-start">
          <section id="publish" aria-labelledby="ready" className={cn(card, readiness.ready ? "ring-2 ring-mint" : "")}>
            <h2 id="ready" className="font-display text-xl font-bold text-ink">
              Launch checklist {readiness.items.filter((i) => i.ok).length}/{readiness.items.length}
            </h2>
            <ul className="mt-2 space-y-2">
              {readiness.items.map((i) => (
                <li key={i.id} className="text-sm">
                  <span className={cn("font-semibold", i.ok ? "text-ink" : "text-[#b8215a]")}>
                    <span aria-hidden="true">{i.ok ? "✓ " : "✗ "}</span>
                    {i.label}
                    <span className="sr-only">{i.ok ? " — done" : " — not done"}</span>
                  </span>
                  {!i.ok && (
                    <ul className="ml-5 list-disc text-xs text-ink-soft">
                      {i.missing.slice(0, 6).map((m) => (
                        <li key={m}>{m}</li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
            <PublishControls r={r} ready={readiness.ready} changed={changed} />
          </section>
        </aside>
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
            <p className="text-xs text-ink-soft">It appears in the shop right away. Buying stays closed until purchasing is switched on.</p>
          </form>
        ) : (
          <p className="text-sm text-ink-soft">Publishing unlocks when every item above is done. You can keep saving the draft meanwhile.</p>
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
          <summary className="cursor-pointer font-semibold text-ink">Delete this draft</summary>
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
      <h2 id={`${id}-t`} className="font-display text-xl font-bold text-ink">
        {title}
      </h2>
      {lead && <p className="mt-1 text-sm text-ink-soft">{lead}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Basics({ r }: { r: ProductRecord }) {
  const p = r.product;
  return (
    <Section id="basics" title="Basics" lead="What shoppers read. Write only what's true of the real product.">
      <form action={saveBasicsAction} className="grid gap-3 sm:grid-cols-2">
        <Rev id={r.id} rev={r.rev} />
        <Text name="name" title="Name" value={p.name} required maxLength={80} />
        <Text name="slug" title="Web address" value={p.slug} required maxLength={60} hint={`funksquish.com/shop/${p.slug}${r.publishedAt ? " — changing it breaks links people already shared" : ""}`} />
        <Select name="category" title="Category" value={p.category} options={CATEGORY_SLUGS.map((c) => ({ value: c, label: getCategory(c)?.name ?? c }))} />
        <Text name="tags" title="Collections (tags, comma separated)" value={p.tags.join(", ")} maxLength={400} hint="e.g. summer-drop, best-seller" />
        <Text name="shortDescription" title="One-line summary (product cards)" value={p.shortDescription} maxLength={160} className="sm:col-span-2" />
        <Area name="description" title="Full description" value={p.description} rows={5} maxLength={4000} className="sm:col-span-2" />
        <Text name="material" title="Material" value={p.specs.material} maxLength={200} />
        <Text name="fill" title="Fill" value={p.specs.fill} maxLength={200} />
        <Text name="texture" title="Texture (in words)" value={p.specs.texture} maxLength={200} />
        <Text name="sizeDescription" title="Size" value={p.specs.sizeDescription} maxLength={200} hint="e.g. About 10 cm tall" />
        <fieldset className="sm:col-span-2">
          <legend className="text-sm font-semibold text-ink">Squish Lab textures (confirmed with a real sample)</legend>
          <div className="mt-1 flex flex-wrap gap-3">
            {TEXTURE_IDS.map((t) => (
              <Check key={t} name={`texture-${t}`} title={getTexture(t)?.name ?? t} checked={p.textures?.includes(t)} />
            ))}
          </div>
        </fieldset>
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
        <div className="sm:col-span-2">
          <button className={primary}>Save basics</button>
        </div>
      </form>
    </Section>
  );
}

function VariantForm({ r, v, suppliers }: { r: ProductRecord; v?: ProductVariant; suppliers: { id: string; name: string }[] }) {
  const x = v ? r.private.variants[v.id] : undefined;
  return (
    <form action={saveVariantAction} className="grid gap-3 sm:grid-cols-3">
      <Rev id={r.id} rev={r.rev} />
      {v && <input type="hidden" name="variantId" value={v.id} />}
      <Text name="variantName" title="Variant name" value={v?.name} required maxLength={60} placeholder="Pink" />
      <Text name="sku" title="SKU" value={v?.sku} required maxLength={40} placeholder="FS-BERRY-PINK" />
      <Text name="swatch" title="Color swatch" value={v?.swatch ?? "#4ea8ff"} type="color" />
      <Text name="price" title="Price ($)" value={dollars(v?.price?.amount)} inputMode="decimal" placeholder="12.99" />
      <Text name="compareAt" title="Was-price ($, optional)" value={dollars(v?.compareAtPrice?.amount)} inputMode="decimal" />
      <Text name="compareAtBasis" title="Was-price basis (private)" value={x?.compareAtBasis} maxLength={300} hint="When/where it really sold at that price" />
      <Check name="priceVerified" title="Price verified" checked={x?.priceVerified} hint="You decided this price and any was-price is real" />
      <Text name="cost" title="Unit cost ($, private)" value={dollars(x?.costCents)} inputMode="decimal" />
      <Text name="landedCost" title="Landed cost ($, private)" value={dollars(x?.landedCostCents)} inputMode="decimal" hint="Incl. freight, duties, fees" />
      <Check name="costVerified" title="Cost checked against invoice/quote" checked={x?.costVerified} />
      <Text name="invoiceRef" title="Invoice / quote reference (private)" value={x?.invoiceRef} maxLength={120} className="sm:col-span-2" />
      <Check name="tracked" title="Track stock" checked={v ? v.inventory.tracked : true} />
      <Text name="available" title="Starting stock count" value={v?.inventory.available ?? ""} inputMode="numeric" hint="After publishing, change stock on the Inventory page" />
      <Text name="weightGrams" title="Packed weight (g)" value={v?.weightGrams ?? ""} inputMode="numeric" />
      <Text name="externalPurchaseUrl" title="Outside buy link (optional)" value={v?.externalPurchaseUrl} hint="e.g. its TikTok Shop listing" />
      <Text name="lengthCm" title="Box length (cm)" value={v?.dimensions?.lengthCm ?? ""} inputMode="decimal" />
      <Text name="widthCm" title="Box width (cm)" value={v?.dimensions?.widthCm ?? ""} inputMode="decimal" />
      <Text name="heightCm" title="Box height (cm)" value={v?.dimensions?.heightCm ?? ""} inputMode="decimal" />
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
      <div className="flex flex-wrap items-end gap-2 sm:col-span-3">
        <button className={primary}>{v ? "Save variant" : "Add variant"}</button>
      </div>
    </form>
  );
}

function Variants({ r, suppliers }: { r: ProductRecord; suppliers: { id: string; name: string }[] }) {
  return (
    <Section id="variants" title="Variants, prices & costs" lead="Each color/size is a variant with its own SKU. Costs, supplier details and invoice references are private — they never appear on the website.">
      {r.product.variants.length === 0 && <p className="mb-3 text-sm text-ink-soft">No variants yet. Even a single-option product needs one (call it &ldquo;Default&rdquo;).</p>}
      <div className="space-y-3">
        {r.product.variants.map((v) => (
          <details key={v.id} className="rounded-2xl bg-ice-50 p-3 ring-1 ring-inset ring-sky-200">
            <summary className="flex cursor-pointer flex-wrap items-center gap-2 font-semibold text-ink">
              <span className="inline-block size-4 rounded-full ring-1 ring-ink/20" style={{ background: v.swatch }} aria-hidden="true" />
              {v.name} <span className="font-mono text-sm text-ink-soft">{v.sku}</span>
              <span className="text-sm text-ink-soft">{v.price ? `$${dollars(v.price.amount)}` : "no price"}</span>
              {(v.fulfillmentSource ?? "in_house") === "supplier" && <Pill tone="warn">Supplier ships</Pill>}
            </summary>
            <div className="mt-3">
              <VariantForm r={r} v={v} suppliers={suppliers} />
              <form action={removeVariantAction} className="mt-2">
                <Rev id={r.id} rev={r.rev} />
                <input type="hidden" name="variantId" value={v.id} />
                <button className="text-sm font-semibold text-[#b8215a] underline">Remove this variant</button>
              </form>
            </div>
          </details>
        ))}
        <details className="rounded-2xl p-3 ring-2 ring-dashed ring-sky-200" open={r.product.variants.length === 0}>
          <summary className="cursor-pointer font-display font-semibold text-royal">+ Add a variant</summary>
          <div className="mt-3">
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
        <p className="mb-3 text-sm text-ink-soft">
          No photos yet — the shop uses the illustration until you add some. <Missing what="Needed to publish" />
        </p>
      ) : (
        <ul className="mb-4 grid gap-3 sm:grid-cols-2">
          {m.map((item, i) => (
            <li key={item.src} className="rounded-2xl bg-ice-50 p-3 ring-1 ring-inset ring-sky-200">
              <div className="relative aspect-square overflow-hidden rounded-xl bg-white">
                {item.type === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element -- private owner-only preview (needs the session cookie)
                  <img src={ownerSrc(item.src)} alt={item.alt} className="size-full object-contain" />
                ) : (
                  <video src={ownerSrc(item.src)} controls muted playsInline preload="metadata" className="size-full object-contain" aria-label={item.alt} />
                )}
                {i === 0 && <span className="absolute left-2 top-2 rounded-full bg-royal px-2 py-0.5 text-xs font-bold text-white">Featured</span>}
              </div>
              <form action={mediaAction} className="mt-2 grid gap-2">
                <Rev id={r.id} rev={r.rev} />
                <input type="hidden" name="src" value={item.src} />
                <label className={label}>
                  Alt text (what it shows)
                  <input name="alt" defaultValue={item.alt} maxLength={200} className={input} />
                </label>
                <div className="flex flex-wrap gap-1.5">
                  <button name="op" value="alt" className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-ink ring-1 ring-inset ring-sky-200">
                    Save text
                  </button>
                  {i > 0 && (
                    <button name="op" value="first" className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-ink ring-1 ring-inset ring-sky-200">
                      Make featured
                    </button>
                  )}
                  {i > 0 && (
                    <button name="op" value="up" aria-label={`Move item ${i + 1} earlier`} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-ink ring-1 ring-inset ring-sky-200">
                      ↑
                    </button>
                  )}
                  {i < m.length - 1 && (
                    <button name="op" value="down" aria-label={`Move item ${i + 1} later`} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-ink ring-1 ring-inset ring-sky-200">
                      ↓
                    </button>
                  )}
                  <button name="op" value="remove" className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#b8215a] ring-1 ring-inset ring-[#d62f6d]">
                    Remove
                  </button>
                </div>
              </form>
            </li>
          ))}
        </ul>
      )}
      <form action={uploadMediaAction} className="grid gap-3 rounded-2xl p-3 ring-2 ring-dashed ring-sky-200 sm:grid-cols-2">
        <Rev id={r.id} rev={r.rev} />
        <label className={cn(label, "sm:col-span-2")}>
          Photo or video
          <input name="file" type="file" required accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" className="text-sm" />
        </label>
        <Text name="alt" title="Alt text (what it shows)" required minLength={5} maxLength={200} placeholder="Pink jelly squishy shaped like a strawberry, squeezed in a hand" className="sm:col-span-2" />
        <Select name="videoShape" title="If it's a video: shape" value="portrait" options={Object.entries(VIDEO_SHAPES).map(([k, s]) => ({ value: k, label: s.label }))} />
        <div className="flex items-end">
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
      <form action={saveSafetyAction} className="grid gap-3 sm:grid-cols-2">
        <Rev id={r.id} rev={r.rev} />
        <Text name="ageGrade" title="Age grade (exactly as labeled)" value={s.ageGrade} maxLength={40} placeholder="Ages 3+" />
        <Text name="countryOfOrigin" title="Country of origin" value={s.countryOfOrigin} maxLength={60} />
        <Text name="manufacturerOrImporter" title="Manufacturer or importer (as on the label)" value={s.manufacturerOrImporter} maxLength={160} className="sm:col-span-2" />
        <Area name="warnings" title="Warnings (one per line, exactly as printed)" value={s.warnings.join("\n")} rows={3} />
        <Area name="careInstructions" title="Care instructions (one per line)" value={s.careInstructions.join("\n")} rows={3} />
        <Select name="complianceStatus" title="Compliance documents (private)" value={c.status} options={COMPLIANCE_STATUSES.map((x) => ({ value: x, label: x[0].toUpperCase() + x.slice(1) }))} hint="'Verified' = you read the certificate and the test report and they match this product" />
        <Text name="testLab" title="Test lab (CPSC-accepted)" value={c.testLab} maxLength={120} />
        <Text name="cpcFile" title="Children's Product Certificate (file name/ref)" value={c.cpcFile} maxLength={200} hint="e.g. private/compliance/berry-burst-cpc.pdf" />
        <Text name="testReportFile" title="Test report (file name/ref)" value={c.testReportFile} maxLength={200} />
        <Text name="testDate" title="Test date" value={c.testDate} type="date" />
        <Text name="trackingLabelPhoto" title="Tracking label photo (file name/ref)" value={c.trackingLabelPhoto} maxLength={200} />
        <Area name="notes" title="Private notes" value={r.private.notes} rows={2} maxLength={2000} className="sm:col-span-2" />
        <div className="grid gap-2 rounded-2xl bg-ice-50 p-3 sm:col-span-2">
          <Check name="photosAuthentic" title="Every photo and video shows the real product" checked={r.private.photosAuthentic} hint="Your own photos, or ones the supplier licensed to you in writing. No stock images, no renders presented as photos." />
          <Check name="warningsReviewed" title="Warnings checked against the real label" checked={r.private.warningsReviewed} hint="An empty list is then a decision (the label has none), not a gap." />
          <Check name="shippingMeasured" title="Weights and box sizes measured on the real packed product" checked={r.private.shippingMeasured} />
        </div>
        <div className="sm:col-span-2">
          <button className={primary}>Save safety &amp; compliance</button>
        </div>
      </form>
    </Section>
  );
}
