import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getProduct, listProducts, statusLabel } from "@/commerce/catalog";
import { getCategory } from "@/commerce/categories";
import { PageTransition } from "@/components/layout/PageTransition";
import { Container, Badge, Notice } from "@/components/ui/Primitives";
import { ProductShowcase } from "@/components/shop/ProductShowcase";
import { ProductCard } from "@/components/shop/ProductCard";
import { ArrowLeftIcon, SparklesIcon } from "@/components/icons/Icons";
import { themeClasses } from "@/components/theme";
import { Wave } from "@/components/decor/Decor";

export async function generateStaticParams() {
  const products = await listProducts();
  return products.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/shop/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return { title: "Not found" };
  return {
    title: `${product.name} (preview)`,
    description: `${product.shortDescription} Sample design — not yet for sale.`,
  };
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

  const category = getCategory(product.category);
  const theme = category ? themeClasses[category.theme] : themeClasses.berry;
  const related = (await listProducts()).filter((p) => p.category === product.category && p.id !== product.id).slice(0, 3);

  const details: [string, string][] = [
    ["Size", "To be confirmed"],
    ["Materials", "To be confirmed"],
    ["Age guidance", "To be confirmed"],
    ["Shipping", "Details coming soon"],
  ];

  return (
    <>
      <section className="sky-wash pb-20 pt-28 sm:pb-28 sm:pt-32">
        <Container>
          <nav aria-label="Breadcrumb" className="mb-6">
            <Link
              href={category ? `/shop?category=${category.slug}` : "/shop"}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-4 font-display font-semibold text-ink ring-1 ring-inset ring-sky-200 transition-colors hover:text-royal"
            >
              <ArrowLeftIcon className="size-4" />
              Back to shop preview
            </Link>
          </nav>

          <ProductShowcase
            product={product}
            themeSoft={theme.soft}
            header={
              <>
                <div className="flex flex-wrap gap-2">
                  {category && <Badge tone={theme.badge}>{category.name}</Badge>}
                  <Badge tone="lemon">{statusLabel[product.status]}</Badge>
                </div>
                <h1 className="mt-4 font-display text-4xl font-bold leading-[1.02] tracking-tight text-ink sm:text-5xl">
                  {product.name}
                </h1>
                <p className="mt-4 text-lg leading-relaxed text-ink-soft">{product.description}</p>
              </>
            }
            footer={
              <>
                <Notice tone="lemon" title="Sample design" icon={<SparklesIcon className="size-6" />} className="mt-6">
                  This page shows how product pages will look at launch. The design, colors, and details may change once
                  we have real squishies in hand.
                </Notice>
                <div className="mt-6 rounded-[2rem] bg-white p-5 ring-1 ring-inset ring-sky-200">
                  <h2 className="font-display text-xl font-bold text-ink">Details</h2>
                  <dl className="mt-3 divide-y divide-sky-200/70">
                    {details.map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-4 py-2.5">
                        <dt className="font-semibold text-ink">{k}</dt>
                        <dd className="text-right text-ink-soft">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
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
              More {category?.name ?? "samples"}
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
