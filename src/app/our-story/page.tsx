import type { Metadata } from "next";
import { PageTransition } from "@/components/layout/PageTransition";
import { PageHero } from "@/components/layout/PageHero";
import { Container, SectionHeading } from "@/components/ui/Primitives";
import { ButtonAnchor, ButtonLink } from "@/components/ui/Button";
import { Mascot } from "@/components/illustrations/Mascot";
import { CapsuleArt, CrunchyArt, JellyArt, SlushieArt } from "@/components/illustrations/ProductArt";
import { HeartIcon, TikTokIcon, ArrowRightIcon } from "@/components/icons/Icons";
import { previewPalettes as p } from "@/commerce/providers/preview";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Our Story",
  description: "FunkSquish is a brand-new small business born from a love of fun, colorful squishies.",
};

const values = [
  {
    title: "Color first",
    body: "Bright, happy colors are our thing — with a soft spot for every shade of blue.",
    art: <SlushieArt palette={p.blueRaspberry} className="h-24 w-auto" />,
    bg: "bg-ice",
  },
  {
    title: "Squeeze-worthy",
    body: "Jiggly, crunchy, or squishy — we want every pick to be fun to hold.",
    art: <JellyArt palette={p.strawberry} className="h-24 w-auto" mood="wink" />,
    bg: "bg-berry-soft",
  },
  {
    title: "Little characters",
    body: "Faces, personalities, and tiny details that make a squishy feel like a friend.",
    art: <CapsuleArt palette={p.mint} className="h-24 w-auto" />,
    bg: "bg-mint-soft",
  },
  {
    title: "Share the fun",
    body: "Squishies are better together, so we're bringing the fun to TikTok LIVE.",
    art: <CrunchyArt palette={p.lemon} className="h-24 w-auto" />,
    bg: "bg-lemon-soft",
  },
];

export default function OurStoryPage() {
  return (
    <PageTransition>
      <PageHero
        eyebrow={
          <>
            <HeartIcon className="size-4" /> Our story
          </>
        }
        title={
          <>
            Hello from <span className="text-squish">FunkSquish!</span>
          </>
        }
        lead="We're a brand-new small business built around one simple idea: squishies should be colorful, cute, and seriously fun."
        art={<Mascot className="w-full animate-bob" wave mood="grin" title="The FunkSquish mascot waving" />}
      />

      <section className="bg-white py-14 sm:py-20">
        <Container className="max-w-3xl">
          <div className="space-y-6 text-lg leading-relaxed text-ink-soft sm:text-xl">
            <p className="font-display text-2xl font-semibold leading-snug text-ink sm:text-3xl">
              FunkSquish started the way a lot of good things do — with a love of squishies and a feeling that the
              squishy world could use a little more funk.
            </p>
            <p>
              Fruit slushies with goofy grins, jelly squishies that wobble, crunchy squishies you can hear, and tiny
              collectibles that line up on a shelf just right. We love all of it, and we wanted to build a shop that
              feels just as fun as the squishies inside it.
            </p>
            <p>
              Right now we&apos;re at the very beginning. We&apos;re talking with suppliers and choosing the designs
              we want in our first collection. We don&apos;t have products for sale yet, and we
              won&apos;t pretend otherwise — when the shop opens, you&apos;ll hear about it first on TikTok.
            </p>
            <p>
              Until then, thanks for being here early. It means a lot to a small business that&apos;s just getting
              started.
            </p>
            <p className="font-display text-xl font-semibold text-royal">— The FunkSquish team</p>
          </div>
        </Container>
      </section>

      <section aria-labelledby="values-title" className="relative overflow-hidden bg-ice-50 pb-28 pt-14 sm:pb-36 sm:pt-20">
        <div aria-hidden="true" className="absolute inset-0 dots opacity-60" />
        <Container className="relative">
          <SectionHeading
            eyebrow="What we care about"
            title={<span id="values-title">The squishy stuff that matters to us</span>}
          />
          <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {values.map((v) => (
              <li key={v.title} className="squishy rounded-[2rem] bg-white p-3 shadow-[var(--shadow-card)] ring-1 ring-inset ring-sky-200">
                <div className={`grid h-36 place-items-center rounded-[1.5rem] ${v.bg}`}>{v.art}</div>
                <div className="px-2 pb-2 pt-4">
                  <h3 className="font-display text-xl font-bold text-ink">{v.title}</h3>
                  <p className="mt-1.5 leading-relaxed text-ink-soft">{v.body}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-14 flex flex-col items-center gap-4 text-center min-[440px]:flex-row min-[440px]:justify-center">
            <ButtonAnchor href={siteConfig.tiktok.url} size="lg" variant="tiktok">
              <TikTokIcon className="size-5" />
              Follow {siteConfig.tiktok.handle}
              <span className="sr-only"> on TikTok (opens in a new tab)</span>
            </ButtonAnchor>
            <ButtonLink href="/shop" size="lg" variant="secondary">
              Peek at the shop
              <ArrowRightIcon className="size-5" />
            </ButtonLink>
          </div>
        </Container>
      </section>
    </PageTransition>
  );
}
