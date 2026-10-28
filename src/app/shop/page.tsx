import { Suspense } from "react";
import { listProducts } from "@/commerce/catalog";
import { PageTransition } from "@/components/layout/PageTransition";
import { PageHero } from "@/components/layout/PageHero";
import { Container, Notice } from "@/components/ui/Primitives";
import { ShopCatalog, ShopCatalogFromUrl } from "@/components/shop/ShopCatalog";
import { LiveStock } from "@/components/shop/LiveStock";
import { SparklesIcon, StoreIcon } from "@/components/icons/Icons";
import { siteConfig } from "@/lib/site";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Shop (preview)",
  description: "Preview the FunkSquish shop: sample designs from our upcoming Fruity Slushies, Jelly Squishies, Crunchy Squishies, and Cute Collectibles. Nothing is for sale yet.",
  path: "/shop",
});

export default async function ShopPage() {
  const products = await listProducts();

  return (
    <PageTransition>
      <PageHero
        eyebrow={
          <>
            <StoreIcon className="size-4" /> The shop
          </>
        }
        title={
          <>
            Squish shop <span className="text-squish">preview</span>
          </>
        }
        lead="Take a peek at the kinds of squishies we're planning. The shop opens once our first real collection arrives."
      />

      <section aria-label="Preview catalog" className="bg-white pb-28 pt-4 sm:pb-36">
        <Container>
          <Notice
            title="These are sample illustrations, not real products"
            icon={<SparklesIcon className="size-6" />}
            className="mb-6"
          >
            Everything below is an illustrated preview to show how our shop will look. None of it is real inventory,
            prices haven&apos;t been set, and nothing can be bought yet. Follow{" "}
            <a
              href={siteConfig.tiktok.url}
              data-umami-event="tiktok-click"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-royal underline decoration-2 underline-offset-4"
            >
              {siteConfig.tiktok.handle}
            </a>{" "}
            to see the real squishies first.
          </Notice>

          {/* Static fallback renders the full catalog; the URL-aware version hydrates in. Stock: see LiveStock. */}
          <LiveStock products={products}>
            {(shown) => (
              <Suspense fallback={<ShopCatalog products={shown} />}>
                <ShopCatalogFromUrl products={shown} />
              </Suspense>
            )}
          </LiveStock>
        </Container>
      </section>
    </PageTransition>
  );
}
