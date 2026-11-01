import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { reviewConfig } from "@/lib/partners/config";
import { requireReviewer } from "@/lib/partners/review-auth";
import { ownerDataStore } from "@/lib/owner/data";
import { getRecord } from "@/commerce/catalog-admin/store";
import { toPublicProduct } from "@/commerce/catalog-admin/record";
import { getCategory } from "@/commerce/categories";
import { availabilityLabel, getAvailability } from "@/commerce/availability";
import { ProductShowcase } from "@/components/shop/ProductShowcase";
import { ProductFacts } from "@/components/shop/ProductFacts";
import { Badge } from "@/components/ui/Primitives";
import { themeClasses } from "@/components/theme";
import { ReviewLogin } from "@/components/partners/ReviewLogin";
import { OwnerShell, secondary } from "@/components/owner/OwnerUi";

export const metadata: Metadata = { title: "Product preview", robots: { index: false, follow: false } };

// Private, per-request page: no shared instant-navigation shell needed.
export const instant = false;

/**
 * PRIVATE: how this product's page will look once published — with the real
 * product page components, so labels, warnings and the buy box are exactly
 * what shoppers get. Only the signed-in owner can see it.
 */
export default function ProductPreviewPage({ params }: PageProps<"/partners/review/products/[id]/preview">) {
  if (!reviewConfig()) notFound();
  return (
    <OwnerShell>
      <Preview params={params} />
    </OwnerShell>
  );
}

async function Preview({ params }: { params: PageProps<"/partners/review/products/[id]/preview">["params"] }) {
  await connection();
  const ctx = await requireReviewer();
  if (!ctx) return <ReviewLogin />;
  const { id } = await params;
  const r = await getRecord(await ownerDataStore(ctx.cfg), decodeURIComponent(id));
  if (!r) notFound();
  const product = toPublicProduct({ ...r, status: "published" });
  const category = getCategory(product.category);
  const theme = category ? themeClasses[category.theme] : themeClasses.berry;
  const photos = product.media;
  // The gallery's image optimizer can't read private (unpublished) files, so the preview shows the
  // photos in a strip above and the page itself with its illustration.
  const shown = { ...product, media: [] };

  return (
    <div>
      <div role="note" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-lemon-soft px-4 py-3 text-sm font-semibold text-ink">
        <span>Preview only — {r.status === "published" ? "this is your latest saved version (it may differ from the website until you publish changes)" : "this product isn't on the website"}.</span>
        <Link href={`/partners/review/products/${encodeURIComponent(r.id)}`} className={secondary}>
          Back to editing
        </Link>
      </div>
      {product.variants.length === 0 ? (
        <p className="rounded-2xl bg-white p-6 text-ink-soft ring-1 ring-inset ring-sky-200">Add at least one variant to preview the product page.</p>
      ) : (
        <>
          {photos.length > 0 && (
            <ul aria-label="Photos and videos, in order" className="mb-5 flex gap-3 overflow-x-auto pb-2">
              {photos.map((m, i) => (
                <li key={m.src} className="w-40 shrink-0">
                  <div className="aspect-square overflow-hidden rounded-2xl bg-white ring-1 ring-inset ring-sky-200">
                    {m.type === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element -- private owner-only file
                      <img src={m.src.replace(/^\/media\//, "/partners/review/products/media/")} alt={m.alt} className="size-full object-cover" />
                    ) : (
                      <video src={m.src.replace(/^\/media\//, "/partners/review/products/media/")} muted playsInline preload="metadata" controls className="size-full object-cover" aria-label={m.alt} />
                    )}
                  </div>
                  <p className="mt-1 text-xs text-ink-soft">
                    {i === 0 ? "Featured · " : ""}
                    {m.alt}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <div className="sky-wash rounded-[2.5rem] p-4 sm:p-6">
            <ProductShowcase
              product={shown}
              themeSoft={theme.soft}
              header={
                <>
                  <div className="flex flex-wrap gap-2">
                    {category && <Badge tone={theme.badge}>{category.name}</Badge>}
                    <Badge tone="sky">{availabilityLabel[getAvailability(shown)]}</Badge>
                  </div>
                  <h1 className="mt-4 font-display text-4xl font-bold leading-[1.02] tracking-tight text-ink sm:text-5xl">{product.name}</h1>
                  <p className="mt-4 text-lg leading-relaxed text-ink-soft">{product.description || "No description yet."}</p>
                </>
              }
              footer={<ProductFacts product={shown} className="mt-6" />}
            />
          </div>
        </>
      )}
    </div>
  );
}
