import { Suspense } from "react";
import { catalogIsPreview, listProducts } from "@/commerce/catalog";
import { PageTransition } from "@/components/layout/PageTransition";
import { PageHero } from "@/components/layout/PageHero";
import { Container, Notice } from "@/components/ui/Primitives";
import { ShopCatalog, ShopCatalogFromUrl } from "@/components/shop/ShopCatalog";
import { LiveStock } from "@/components/shop/LiveStock";
import { SparklesIcon, StoreIcon } from "@/components/icons/Icons";
import { siteConfig } from "@/lib/site";
import { purchasingEnabled } from "@/lib/features";
import { pageMetadata } from "@/lib/seo";

/*
 * The page follows the catalog: while it only holds illustrated samples it's a
 * "preview" and says so; once real products are imported it becomes the shop,
 * and still says ordering isn't open until purchasing is switched on.
 */
export async function generateMetadata() {
  return pageMetadata(
  (await catalogIsPreview())
    ? {
        title: "Shop (preview)",
        description: "Preview the FunkSquish shop: sample designs from our upcoming Fruity Slushies, Jelly Squishies, Crunchy Squishies, and Cute Collectibles. Nothing is for sale yet.",
        path: "/shop",
      }
    : {
        title: "Shop",
        description: "Shop FunkSquish squishies: Fruity Slushies, Jelly Squishies, Crunchy Squishies and Cute Collectibles.",
        path: "/shop",
      },
  );
}

export default async function ShopPage() {
  const products = await listProducts();
  const previews = products.filter((p) => p.publication === "preview").length;
  const allPreview = products.length > 0 && previews === products.length;

  return (
    <PageTransition>
      <PageHero
        eyebrow={
          <>
            <StoreIcon className="size-4" /> The shop
          </>
        }
        title={
          allPreview ? (
            <>
              Squish shop <span className="text-squish">preview</span>
            </>
          ) : (
            <>
              The squish <span className="text-squish">shop</span>
            </>
          )
        }
        lead={
          allPreview
            ? "Take a peek at the kinds of squishies we're planning. The shop opens once our first real collection arrives."
            : purchasingEnabled
              ? "Find your squish. Prices, shipping and any warnings are shown before you buy."
              : "Meet our squishies. Ordering isn't open yet — we'll announce launch day on TikTok."
        }
      />

      <section aria-label={allPreview ? "Preview catalog" : "Catalog"} className="bg-white pb-28 pt-4 sm:pb-36">
        <Container>
          {allPreview ? (
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
          ) : previews > 0 ? (
            <Notice title="Some of these are sample designs" icon={<SparklesIcon className="size-6" />} className="mb-6">
              Items marked &ldquo;Preview sample&rdquo; are illustrations of designs we&apos;re planning, not real products, and
              can&apos;t be bought.
            </Notice>
          ) : null}
          {!allPreview && !purchasingEnabled && (
            <Notice title="Ordering isn't open yet" tone="sky" icon={<SparklesIcon className="size-6" />} className="mb-6">
              You can browse and save favorites to your wishlist. We&apos;ll announce launch day on{" "}
              <a
                href={siteConfig.tiktok.url}
                data-umami-event="tiktok-click"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-royal underline decoration-2 underline-offset-4"
              >
                TikTok
              </a>
              .
            </Notice>
          )}

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
