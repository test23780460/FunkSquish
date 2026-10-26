import { Suspense } from "react";
import Link from "next/link";
import { listProducts } from "@/commerce/catalog";
import { textures, type TextureId } from "@/content/textures";
import { PageTransition } from "@/components/layout/PageTransition";
import { PageHero } from "@/components/layout/PageHero";
import { Container, SectionHeading } from "@/components/ui/Primitives";
import { ButtonLink } from "@/components/ui/Button";
import { ProductCard } from "@/components/shop/ProductCard";
import { SquishLab, SquishLabFromUrl } from "@/components/lab/SquishLab";
import { TextureMeters } from "@/components/lab/TextureMeters";
import { TextureBlob } from "@/components/illustrations/TextureBlob";
import { Mascot } from "@/components/illustrations/Mascot";
import { HeartIcon, SparklesIcon } from "@/components/icons/Icons";
import { pageMetadata } from "@/lib/seo";
import { cn } from "@/lib/cn";

export const metadata = pageMetadata({
  title: "Squish Lab",
  description:
    "Try five squishy textures — cloud soft, slow rise, jelly, crunchy and buttery — in the FunkSquish Squish Lab, then explore sample designs for each.",
  path: "/squish-lab",
});

export default async function SquishLabPage() {
  const products = await listProducts();

  // Server-rendered product grids per texture, handed to the interactive lab.
  const matches = Object.fromEntries(
    textures.map((t) => {
      const list = products.filter((p) => p.textures?.includes(t.id)).sort((a, b) => a.featuredRank - b.featuredRank);
      return [
        t.id,
        list.length > 0 ? (
          <ul className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
            {list.map((p) => (
              <li key={p.id}>
                <ProductCard product={p} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center gap-4 rounded-[2rem] bg-ice-50 px-6 py-10 text-center ring-1 ring-inset ring-sky-200 sm:flex-row sm:text-left">
            <Mascot className="w-24 shrink-0" mood="sleepy" />
            <div>
              <p className="font-display text-xl font-bold text-ink">No {t.name.toLowerCase()} designs yet</p>
              <p className="mt-1 max-w-lg text-ink-soft">
                We haven&apos;t sampled a squishy with this texture yet. Tell us on TikTok if it&apos;s your favorite — it helps us
                decide what to look for.
              </p>
            </div>
          </div>
        ),
      ];
    }),
  ) as Record<TextureId, React.ReactNode>;

  return (
    <PageTransition>
      <PageHero
        eyebrow={
          <>
            <SparklesIcon className="size-4" /> Squish Lab
          </>
        }
        title={
          <>
            Welcome to the <span className="text-squish">Squish Lab</span>
          </>
        }
        lead="Every squishy has a personality. Pick a texture, press and hold, and feel the difference — then see the sample designs we're exploring for it."
      />

      <section aria-label="Texture explorer" className="bg-white pb-16 pt-4 sm:pb-20">
        <Container>
          <Suspense fallback={<SquishLab matches={matches} />}>
            <SquishLabFromUrl matches={matches} />
          </Suspense>
        </Container>
      </section>

      <section aria-labelledby="compare-title" className="relative overflow-hidden bg-ice-50 py-16 sm:py-20">
        <div aria-hidden="true" className="absolute inset-0 dots opacity-60" />
        <Container className="relative">
          <SectionHeading
            eyebrow="Side by side"
            title={<span id="compare-title">Compare all five textures</span>}
            lead="The meters compare the textures with each other. They're not lab measurements."
          />
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {textures.map((t) => (
              <li key={t.id} className="flex flex-col rounded-[2rem] bg-white p-5 shadow-[var(--shadow-card)] ring-1 ring-inset ring-sky-200">
                <div className={cn("grid aspect-[4/3] place-items-center rounded-[1.5rem]", t.tone.soft)}>
                  <TextureBlob texture={t.id} palette={t.palette} className="h-[80%] w-auto" />
                </div>
                <h3 className="mt-4 font-display text-xl font-bold text-ink">{t.name}</h3>
                <p className="text-sm text-ink-soft">{t.tagline}</p>
                <TextureMeters meters={t.meters} solid={t.tone.solid} className="mt-4 text-sm" />
                <Link
                  href={`/squish-lab?texture=${t.id}`}
                  className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full bg-ice font-display font-semibold text-royal ring-1 ring-inset ring-sky-200 hover:bg-sky-200/60"
                >
                  Try {t.name}
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section aria-labelledby="next-title" className="bg-white pb-28 pt-16 sm:pb-36">
        <Container className="flex flex-col items-center text-center">
          <Mascot className="w-28 animate-bob" mood="wink" wave />
          <h2 id="next-title" className="mt-4 font-display text-3xl font-bold text-ink sm:text-4xl">
            Found a favorite?
          </h2>
          <p className="mt-3 max-w-xl text-lg text-ink-soft">
            Save sample designs to your wishlist and we&apos;ll keep them on this device for you. Nothing is for sale yet.
          </p>
          <div className="mt-7 flex flex-col gap-3 min-[440px]:flex-row">
            <ButtonLink href="/shop" size="lg">
              See all sample designs
            </ButtonLink>
            <ButtonLink href="/wishlist" size="lg" variant="secondary">
              <HeartIcon className="size-5" />
              My wishlist
            </ButtonLink>
          </div>
        </Container>
      </section>
    </PageTransition>
  );
}
