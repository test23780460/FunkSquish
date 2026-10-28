import { Suspense } from "react";
import { listProducts } from "@/commerce/catalog";
import { toProductSummary } from "@/commerce/summary";
import { PageTransition } from "@/components/layout/PageTransition";
import { PageHero } from "@/components/layout/PageHero";
import { Container } from "@/components/ui/Primitives";
import { HeartIcon } from "@/components/icons/Icons";
import { WishlistFromUrl, WishlistView } from "@/components/wishlist/WishlistView";
import { pageMetadata } from "@/lib/seo";
import { LiveStock } from "@/components/shop/LiveStock";

export const metadata = pageMetadata({
  title: "Wishlist",
  description: "Your FunkSquish wishlist, saved on this device. Share it with a link — no account needed.",
  path: "/wishlist",
  // Personal, per-device page: nothing useful for search engines.
  noindex: true,
});

export default async function WishlistPage() {
  const products = await listProducts();
  return (
    <PageTransition>
      <PageHero
        eyebrow={
          <>
            <HeartIcon className="size-4" /> Wishlist
          </>
        }
        title={
          <>
            Your squish <span className="text-squish">wishlist</span>
          </>
        }
        lead="Save the squishies you love, then share your list with friends and family. No account needed."
      />
      <section className="bg-white pb-28 pt-4 sm:pb-36">
        <Container>
          <LiveStock products={products}>
            {(shown) => (
              <Suspense fallback={<WishlistView products={shown.map(toProductSummary)} />}>
                <WishlistFromUrl products={shown.map(toProductSummary)} />
              </Suspense>
            )}
          </LiveStock>
        </Container>
      </section>
    </PageTransition>
  );
}
