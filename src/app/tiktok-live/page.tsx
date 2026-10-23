import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PageTransition } from "@/components/layout/PageTransition";
import { PageHero } from "@/components/layout/PageHero";
import { Container, SectionHeading, Notice } from "@/components/ui/Primitives";
import { ButtonAnchor } from "@/components/ui/Button";
import { PhoneLive } from "@/components/tiktok/PhoneLive";
import { LiveSchedule } from "@/components/tiktok/LiveSchedule";
import { HeartIcon, PlayIcon, SparklesIcon, StoreIcon, TikTokIcon, SmileIcon } from "@/components/icons/Icons";
import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/cn";

export const metadata: Metadata = {
  title: "TikTok LIVE",
  description: `Follow ${siteConfig.tiktok.handle} on TikTok. FunkSquish LIVEs and livestream shopping are coming soon.`,
};

const plans: { title: string; body: string; icon: ReactNode; tone: string }[] = [
  {
    title: "Squish tests",
    body: "Slow squeezes, crunch checks, and jiggle tests so you can see how each squishy feels.",
    icon: <HeartIcon className="size-6" />,
    tone: "bg-berry-soft text-[#b8215a]",
  },
  {
    title: "Unboxings",
    body: "Opening new arrivals together and showing off every color and detail.",
    icon: <SparklesIcon className="size-6" />,
    tone: "bg-lemon-soft text-[#9a6a00]",
  },
  {
    title: "First looks",
    body: "Sneak peeks at new designs as they arrive, before they hit the shop.",
    icon: <PlayIcon className="size-6" />,
    tone: "bg-ice text-royal",
  },
  {
    title: "Hang out & Q&A",
    body: "Ask us anything about squishies, the shop, or what's coming next.",
    icon: <SmileIcon className="size-6" />,
    tone: "bg-mint-soft text-[#0f7a60]",
  },
];

export default function TikTokLivePage() {
  return (
    <PageTransition>
      <PageHero
        eyebrow={
          <>
            <TikTokIcon className="size-4" /> TikTok LIVE
          </>
        }
        title={
          <>
            Squish along <span className="text-squish">LIVE</span>
          </>
        }
        lead={`TikTok is our home base. We're planning LIVEs full of squish tests, unboxings, and first looks — follow ${siteConfig.tiktok.handle} so you catch the first one.`}
        art={<PhoneLive className="sm:max-w-[17rem]" />}
      >
        <div className="flex justify-center lg:justify-start">
          <ButtonAnchor href={siteConfig.tiktok.url} size="lg" variant="tiktok">
            <TikTokIcon className="size-5" />
            Follow {siteConfig.tiktok.handle}
            <span className="sr-only"> on TikTok (opens in a new tab)</span>
          </ButtonAnchor>
        </div>
      </PageHero>

      <section aria-labelledby="plans-title" className="bg-white py-14 sm:py-20">
        <Container>
          <SectionHeading
            eyebrow="What we're planning"
            title={<span id="plans-title">What our LIVEs will be like</span>}
            lead="We haven't gone live yet. Here's what we're getting ready for."
          />
          <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map((p) => (
              <li key={p.title} className="squishy rounded-[2rem] bg-ice-50 p-6 ring-1 ring-inset ring-sky-200">
                <div className={cn("grid size-12 place-items-center rounded-2xl gloss", p.tone)}>{p.icon}</div>
                <h3 className="mt-4 font-display text-xl font-bold text-ink">{p.title}</h3>
                <p className="mt-1.5 leading-relaxed text-ink-soft">{p.body}</p>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section aria-labelledby="shopping-title" className="relative overflow-hidden bg-ice-50 pb-28 pt-14 sm:pb-36 sm:pt-20">
        <div aria-hidden="true" className="absolute inset-0 dots opacity-60" />
        <Container className="relative grid gap-8 lg:grid-cols-2 lg:items-start">
          <div className="rounded-[2rem] bg-white p-6 shadow-[var(--shadow-card)] ring-1 ring-inset ring-sky-200 sm:p-8">
            <div className="flex items-center gap-3">
              <span className="grid size-12 place-items-center rounded-2xl bg-ice text-royal">
                <StoreIcon className="size-6" />
              </span>
              <h2 id="shopping-title" className="font-display text-2xl font-bold text-ink sm:text-3xl">
                LIVE shopping is coming soon
              </h2>
            </div>
            <p className="mt-4 text-lg leading-relaxed text-ink-soft">
              Once our first collection is in stock, we&apos;d love to let you shop squishies right from our LIVEs. We&apos;re
              still working out the details — including whether that happens through TikTok Shop, our website, or both.
            </p>
            <Notice tone="sky" title="Nothing to buy just yet" className="mt-5">
              We&apos;re not selling anything on TikTok or on this website yet. If you ever see someone claiming to sell
              FunkSquish products before our launch announcement, it isn&apos;t us.
            </Notice>
          </div>

          <LiveSchedule />
        </Container>
      </section>
    </PageTransition>
  );
}
