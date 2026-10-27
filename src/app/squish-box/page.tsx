import { Suspense } from "react";
import { listProducts } from "@/commerce/catalog";
import { toProductSummary } from "@/commerce/summary";
import { PageTransition } from "@/components/layout/PageTransition";
import { PageHero } from "@/components/layout/PageHero";
import { Container } from "@/components/ui/Primitives";
import { StoreIcon } from "@/components/icons/Icons";
import { SquishBoxBuilder, SquishBoxFromUrl } from "@/components/box/SquishBoxBuilder";
import { pageMetadata } from "@/lib/seo";
import { LiveStock } from "@/components/shop/LiveStock";

export const metadata = pageMetadata({
  title: "Build Your Squish Box",
  description: "Design your dream FunkSquish box: pick a size, a ribbon and the squishies that go inside. A pre-launch preview — boxes can't be ordered yet.",
  path: "/squish-box",
});

export default async function SquishBoxPage() {
  const products = await listProducts();
  return (
    <PageTransition>
      <PageHero
        eyebrow={
          <>
            <StoreIcon className="size-4" /> Squish Box · preview
          </>
        }
        title={
          <>
            Build your <span className="text-squish">Squish Box</span>
          </>
        }
        lead="Pick a size, choose a ribbon and drop in your favorite squishies. It's a sneak peek — boxes open for orders after launch."
      />
      <section className="bg-white pb-28 pt-4 sm:pb-36">
        <Container>
          <LiveStock products={products}>
            {(shown) => (
              <Suspense fallback={<SquishBoxBuilder products={shown.map(toProductSummary)} />}>
                <SquishBoxFromUrl products={shown.map(toProductSummary)} />
              </Suspense>
            )}
          </LiveStock>
        </Container>
      </section>
    </PageTransition>
  );
}
