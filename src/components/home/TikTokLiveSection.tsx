import { siteConfig } from "@/lib/site";
import { Container, SectionHeading } from "@/components/ui/Primitives";
import { ButtonAnchor, ButtonLink } from "@/components/ui/Button";
import { ArrowRightIcon, TikTokIcon } from "@/components/icons/Icons";
import { PhoneLive } from "@/components/tiktok/PhoneLive";
import { LiveSchedule } from "@/components/tiktok/LiveSchedule";
import { Sparkle, Wave } from "@/components/decor/Decor";

export const livePlans = ["Squish tests", "Unboxings", "First looks", "Q&A with you"];

export function TikTokLiveSection() {
  return (
    <section aria-labelledby="live-title" className="relative">
      <Wave fill="#13357a" className="-mb-px bg-ice-50" />
      <div className="relative overflow-hidden bg-[radial-gradient(50%_38%_at_78%_52%,rgba(31,95,214,0.85)_0%,transparent_100%),linear-gradient(180deg,var(--color-navy)_0%,var(--color-navy-deep)_100%)] py-14 sm:py-20">
        <Sparkle className="left-[6%] top-12 size-5" />
        <Sparkle className="left-[40%] top-6 size-3" color="#b4deff" delay={1.3} />
        <Sparkle className="bottom-16 right-[8%] size-4" delay={2.1} />

        <Container className="relative grid items-center gap-12 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <SectionHeading
              invert
              align="responsive"
              eyebrow={
                <>
                  <TikTokIcon className="size-4" /> TikTok LIVE
                </>
              }
              title={
                <span id="live-title">
                  Squish with us <span className="text-sky-300">on LIVE</span>
                </span>
              }
              lead={`We're getting ready to host TikTok LIVEs full of squishy fun. Follow ${siteConfig.tiktok.handle} so you're there for the very first one.`}
            />

            <ul className="mt-6 flex flex-wrap justify-center gap-2 lg:justify-start" aria-label="What we're planning">
              {livePlans.map((item) => (
                <li
                  key={item}
                  className="rounded-full bg-white/10 px-4 py-1.5 font-display font-semibold text-white ring-1 ring-inset ring-white/20"
                >
                  {item}
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-col gap-4 min-[440px]:flex-row min-[440px]:justify-center lg:justify-start">
              <ButtonAnchor href={siteConfig.tiktok.url} variant="secondary" size="lg">
                <TikTokIcon className="size-5" />
                Follow {siteConfig.tiktok.handle}
                <span className="sr-only"> on TikTok (opens in a new tab)</span>
              </ButtonAnchor>
              <ButtonLink href="/tiktok-live" size="lg" className="bg-white/10 shadow-[0_6px_0_rgba(0,0,0,0.3)] ring-1 ring-inset ring-white/25 hover:bg-white/15">
                About our LIVEs
                <ArrowRightIcon className="size-5" />
              </ButtonLink>
            </div>

            <LiveSchedule invert className="mt-10" />
          </div>

          <PhoneLive />
        </Container>
      </div>
      <Wave fill="#0b2150" flip className="-mt-px bg-white" />
    </section>
  );
}
