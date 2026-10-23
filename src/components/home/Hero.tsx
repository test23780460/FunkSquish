import { siteConfig } from "@/lib/site";
import { Container } from "@/components/ui/Primitives";
import { ButtonAnchor, ButtonLink } from "@/components/ui/Button";
import { ArrowRightIcon, SparklesIcon, TikTokIcon } from "@/components/icons/Icons";
import { Mascot } from "@/components/illustrations/Mascot";
import { CapsuleArt, CrunchyArt, JellyArt, SlushieArt } from "@/components/illustrations/ProductArt";
import { Bubble, Sparkle, Wave } from "@/components/decor/Decor";
import { previewPalettes as p } from "@/commerce/providers/preview";

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden sky-wash">
      {/* soft background shapes */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-24 size-72 rounded-full bg-sky-200/50 blur-3xl sm:size-96" />
        <div className="absolute -right-24 top-10 size-80 rounded-full bg-white/80 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-full dots opacity-60 [mask-image:linear-gradient(to_bottom,black,transparent_75%)]" />
        <Sparkle className="left-[6%] top-[22%] size-5" color="#3d9bff" />
        <Sparkle className="left-[46%] top-[16%] size-3" color="#7cc2ff" delay={1.1} />
        <Sparkle className="right-[8%] top-[58%] size-4" color="#ffffff" delay={2.2} />
      </div>

      <Container className="relative grid items-center gap-6 pb-6 pt-28 sm:pt-32 lg:grid-cols-[1.05fr_1fr] lg:gap-4 lg:pb-14 lg:pt-36">
        {/* Copy */}
        <div className="relative z-10 text-center lg:text-left">
          <p className="inline-flex animate-rise items-center gap-2 rounded-full bg-white px-4 py-1.5 font-display text-sm font-semibold uppercase tracking-[0.14em] text-royal shadow-[0_4px_0_var(--color-sky-200)] ring-1 ring-inset ring-sky-200">
            <SparklesIcon className="size-4" />
            Coming soon
          </p>

          <h1
            id="hero-title"
            className="mt-5 animate-rise font-display font-bold leading-[0.92] tracking-tight [animation-delay:80ms]"
          >
            <span className="block text-[2.6rem] text-ink min-[400px]:text-5xl sm:text-6xl lg:text-[4.2rem]">Get Your</span>
            <span className="text-squish mt-1 block pb-3 text-[4.1rem] min-[400px]:text-[4.6rem] sm:text-[6.2rem] lg:text-[7rem]">
              Squish On!
            </span>
          </h1>

          <p className="mx-auto mt-3 max-w-xl animate-rise text-lg leading-relaxed text-ink-soft [animation-delay:160ms] sm:text-xl lg:mx-0">
            Your next squishy obsession is almost here! Get ready for colorful, cute, and seriously satisfying squishies.
          </p>

          <div className="mt-8 flex animate-rise flex-col items-stretch gap-4 [animation-delay:240ms] min-[440px]:flex-row min-[440px]:justify-center lg:justify-start">
            <ButtonLink href="/#collections" size="lg">
              Explore collections
              <ArrowRightIcon className="size-5 transition-transform group-hover/btn:translate-x-1" />
            </ButtonLink>
            <ButtonAnchor href={siteConfig.tiktok.url} variant="secondary" size="lg">
              <TikTokIcon className="size-5" />
              {siteConfig.tiktok.handle}
              <span className="sr-only"> on TikTok (opens in a new tab)</span>
            </ButtonAnchor>
          </div>

          <p className="mt-5 animate-rise text-[0.95rem] text-ink-soft [animation-delay:300ms]">
            Nothing is for sale yet — follow along while we build our first collection.
          </p>
        </div>

        {/* Illustration cluster */}
        <div className="relative mx-auto aspect-square w-full max-w-[22rem] sm:max-w-[30rem] lg:max-w-none">
          {/* stage */}
          <div aria-hidden="true" className="absolute inset-[8%] rounded-full bg-[radial-gradient(circle_at_50%_40%,#ffffff_0%,#ffffff_45%,rgba(255,255,255,0.4)_70%,transparent_72%)]" />
          <div aria-hidden="true" className="absolute inset-[14%] rounded-full border-[3px] border-dashed border-sky-300/50" />

          <div className="absolute left-1/2 top-[18%] w-[56%] -translate-x-1/2">
            <Mascot className="w-full animate-bob drop-shadow-[0_20px_30px_rgba(19,53,122,0.25)]" wave title="The FunkSquish mascot waving hello" />
          </div>

          <div className="absolute bottom-[6%] left-[1%] w-[29%] -rotate-[9deg]">
            <SlushieArt palette={p.strawberry} className="w-full animate-float [animation-delay:-1s]" />
          </div>
          <div className="absolute bottom-[4%] right-[2%] w-[27%] rotate-[8deg]">
            <JellyArt palette={p.grape} className="w-full animate-float [animation-delay:-3s]" mood="wink" />
          </div>
          <div className="absolute right-[0%] top-[10%] w-[23%] rotate-[10deg]">
            <CapsuleArt palette={p.mint} className="w-full animate-float [animation-delay:-2s]" />
          </div>
          <div className="absolute left-[2%] top-[16%] w-[25%] -rotate-[8deg]">
            <CrunchyArt palette={p.peach} className="w-full animate-float [animation-delay:-4s]" />
          </div>

          {/* Coming soon sticker */}
          <div className="absolute bottom-[30%] right-[-2%] z-10 sm:right-[-4%]">
            <div className="grid size-20 rotate-12 animate-wobble place-items-center rounded-full bg-lemon text-center font-display text-[0.8rem] font-bold uppercase leading-[1.05] tracking-wide text-ink shadow-[0_5px_0_#e0a722,0_12px_20px_-8px_rgba(19,53,122,0.5)] ring-4 ring-white sm:size-24 sm:text-sm">
              Coming
              <br />
              soon!
            </div>
          </div>

          <Bubble size={26} className="left-[22%] top-[4%]" delay={0.4} />
          <Bubble size={16} className="left-[64%] top-[6%]" delay={1.6} />
          <Bubble size={34} className="bottom-[34%] left-[-2%]" delay={2.2} />
          <Bubble size={14} className="bottom-[2%] left-[46%]" delay={3} />
        </div>
      </Container>

      <Marquee />
      <Wave fill="#ffffff" className="-mb-px" />
    </section>
  );
}

const MARQUEE_ITEMS = ["Fruity Slushies", "Jelly Squishies", "Crunchy Squishies", "Cute Collectibles", "TikTok LIVE", "Coming soon"];

function Marquee() {
  const row = (hidden: boolean) => (
    <ul aria-hidden={hidden || undefined} className="flex shrink-0 items-center gap-6 pr-6">
      {MARQUEE_ITEMS.map((item) => (
        <li key={item} className="flex items-center gap-6 whitespace-nowrap font-display text-lg font-semibold text-white sm:text-xl">
          {item}
          <SparklesIcon className="size-4 text-sky-200" />
        </li>
      ))}
    </ul>
  );
  return (
    <div className="relative z-10 -ml-[5%] w-[110%] -rotate-1 bg-royal py-3 shadow-[0_6px_0_var(--color-navy)]">
      <p className="sr-only">Upcoming: {MARQUEE_ITEMS.join(", ")}.</p>
      <div aria-hidden="true" className="flex w-max animate-marquee motion-reduce:animate-none">
        {row(true)}
        {row(true)}
      </div>
    </div>
  );
}
