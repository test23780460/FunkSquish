import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { availabilityLabel, getAvailability, getProduct, listProducts } from "@/commerce/catalog";
import { getCategory } from "@/commerce/categories";
import { PageTransition } from "@/components/layout/PageTransition";
import { Container, Badge, Notice } from "@/components/ui/Primitives";
import { ProductShowcase } from "@/components/shop/ProductShowcase";
import { ProductCard } from "@/components/shop/ProductCard";
import { ArrowLeftIcon, SparklesIcon } from "@/components/icons/Icons";
import { themeClasses } from "@/components/theme";
import { Wave } from "@/components/decor/Decor";
import { jsonLdScript, pageMetadata, productJsonLd } from "@/lib/seo";
import { getTexture } from "@/content/textures";
import { WishlistButton } from "@/components/wishlist/WishlistButton";
import { ShareButton } from "@/components/shop/ShareButton";
import { ProductFacts } from "@/components/shop/ProductFacts";

export async function generateStaticParams() {
  const products = await listProducts();
  return products.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/shop/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return { title: "Not found", robots: { index: false } };
  const preview = product.publication === "preview";
  return pageMetadata({
    title: preview ? `${product.name} (preview)` : product.name,
    description: preview ? `${product.shortDescription} Sample design — not for sale.` : product.shortDescription,
    path: `/shop/${product.slug}`,
    // Illustrated samples are not real products: keep them out of search results.
    noindex: preview,
  });
}

export default function ProductPage({ params }: PageProps<"/shop/[slug]">) {
  // The page shell renders instantly; product content streams in (prerendered for known slugs).
  return (
    <PageTransition>
      <Suspense fallback={<ProductSkeleton />}>
        {params.then(({ slug }) => (
          <ProductContent slug={slug} />
        ))}
      </Suspense>
    </PageTransition>
  );
}

function ProductSkeleton() {
  return (
    <section aria-busy="true" aria-label="Loading product" className="sky-wash pb-20 pt-28 sm:pb-28 sm:pt-32">
      <Container>
        <div className="mb-6 h-11 w-52 rounded-full bg-white/70" />
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-14">
          <div className="aspect-square animate-pulse rounded-[2.5rem] bg-white/60 ring-1 ring-inset ring-sky-200" />
          <div className="space-y-4">
            <div className="h-8 w-48 rounded-full bg-white/70" />
            <div className="h-12 w-3/4 rounded-2xl bg-white/70" />
            <div className="h-24 rounded-2xl bg-white/50" />
            <div className="h-40 rounded-[2rem] bg-white/60" />
          </div>
        </div>
      </Container>
    </section>
  );
}

async function ProductContent({ slug }: { slug: string }) {
  const product = await getProduct(slug);
  if (!product) notFound();

  const preview = product.publication === "preview";
  const category = getCategory(product.category);
  const theme = category ? themeClasses[category.theme] : themeClasses.berry;
  const availability = getAvailability(product);
  const productTextures = (product.textures ?? []).flatMap((id) => getTexture(id) ?? []);

  // Recommended: same collection first, then fill from other collections.
  const others = (await listProducts()).filter((p) => p.id !== product.id);
  const related = [
    ...others.filter((p) => p.category === product.category),
    ...others.filter((p) => p.category !== product.category).sort((a, b) => a.featuredRank - b.featuredRank),
  ].slice(0, 3);
  const jsonLd = productJsonLd(product);

  return (
    <>
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(jsonLd)} />}
      <section className="sky-wash pb-20 pt-28 sm:pb-28 sm:pt-32">
        <Container>
          <nav aria-label="Breadcrumb" className="mb-6">
            <Link
              href={category ? `/shop?category=${category.slug}` : "/shop"}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-4 font-display font-semibold text-ink ring-1 ring-inset ring-sky-200 transition-colors hover:text-royal"
            >
              <ArrowLeftIcon className="size-4" />
              {preview ? "Back to shop preview" : `Back to ${category?.name ?? "the shop"}`}
            </Link>
          </nav>

          <ProductShowcase
            product={product}
            themeSoft={theme.soft}
            header={
              <>
                <div className="flex flex-wrap gap-2">
                  {category && <Badge tone={theme.badge}>{category.name}</Badge>}
                  <Badge tone={preview ? "lemon" : "sky"}>{availabilityLabel[availability]}</Badge>
                </div>
                <h1 className="mt-4 font-display text-4xl font-bold leading-[1.02] tracking-tight text-ink sm:text-5xl">
                  {product.name}
                </h1>
                <p className="mt-4 text-lg leading-relaxed text-ink-soft">{product.description}</p>
                {productTextures.length > 0 && (
                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    <span className="font-display font-semibold text-ink">{preview ? "Planned texture:" : "Texture:"}</span>
                    {productTextures.map((t) => (
                      <Link
                        key={t.id}
                        href={`/squish-lab?texture=${t.id}`}
                        className={`inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 font-display font-semibold text-ink ring-1 ring-inset ${t.tone.soft} ${t.tone.ring} hover:-translate-y-0.5 transition-transform`}
                      >
                        {t.name}
                        <span className="text-sm font-semibold text-royal">· try it in the Squish Lab</span>
                      </Link>
                    ))}
                  </div>
                )}
                <div className="mt-5 flex flex-wrap gap-2.5">
                  <WishlistButton slug={product.slug} name={product.name} look="pill" />
                  <ShareButton title={`${product.name} · FunkSquish`} path={`/shop/${product.slug}`} />
                </div>
              </>
            }
            footer={
              <>
                <ProductFacts product={product} className="mt-6" />
                {preview && (
                  <Notice tone="lemon" title="Sample design" icon={<SparklesIcon className="size-6" />} className="mt-4">
                    This page shows how product pages will look at launch. The design, colors, and details may change once we
                    have real squishies in hand.
                  </Notice>
                )}
              </>
            }
          />
        </Container>
      </section>

      {related.length > 0 && (
        <section aria-labelledby="related-title" className="relative bg-white pb-28 sm:pb-36">
          <Wave fill="#ffffff" className="-mt-10 bg-transparent sm:-mt-16 lg:-mt-20" />
          <Container className="pt-6">
            <h2 id="related-title" className="font-display text-3xl font-bold text-ink">
              You might also like
            </h2>
            <ul className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">
              {related.map((p) => (
                <li key={p.id}>
                  <ProductCard product={p} />
                </li>
              ))}
            </ul>
          </Container>
        </section>
      )}
    </>
  );
}
