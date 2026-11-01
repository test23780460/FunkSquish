import Link from "next/link";
import { textures } from "@/content/textures";
import { isPreviewCatalog } from "@/commerce/catalog";
import { Container, SectionHeading } from "@/components/ui/Primitives";
import { ButtonLink } from "@/components/ui/Button";
import { TextureBlob } from "@/components/illustrations/TextureBlob";
import { ArrowRightIcon } from "@/components/icons/Icons";
import { TeaserPad } from "./TeaserPad";
import { cn } from "@/lib/cn";

/** Homepage invitation into the Squish Lab, with a live squish demo. */
export function SquishLabTeaser() {
  return (
    <section aria-labelledby="lab-teaser-title" className="relative overflow-hidden bg-ice-50 py-16 sm:py-24">
      <div aria-hidden="true" className="absolute inset-0 dots opacity-60" />
      <Container className="relative grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <SectionHeading
            align="responsive"
            eyebrow="New · Squish Lab"
            title={<span id="lab-teaser-title">What kind of squish are you?</span>}
            lead={`Soft, slow-rise, jelly, crunchy or buttery — try each texture on screen, then explore the ${isPreviewCatalog ? "sample designs made" : "squishies"} for it.`}
          />
          <ul className="mt-7 flex flex-wrap justify-center gap-2 lg:justify-start">
            {textures.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/squish-lab?texture=${t.id}`}
                  className={cn(
                    "squishy inline-flex min-h-12 items-center gap-2 rounded-full py-1 pl-1 pr-4 font-display font-semibold text-ink ring-1 ring-inset",
                    t.tone.soft,
                    t.tone.ring,
                  )}
                >
                  <span className="grid size-10 place-items-center rounded-full bg-white/80">
                    <TextureBlob texture={t.id} palette={t.palette} className="size-8" />
                  </span>
                  {t.name}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex justify-center lg:justify-start">
            <ButtonLink href="/squish-lab" size="lg">
              Open the Squish Lab
              <ArrowRightIcon className="size-5" />
            </ButtonLink>
          </div>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            <li>
              <Link href="/quiz" className="squishy flex h-full items-center gap-3 rounded-[1.75rem] bg-white p-4 shadow-[var(--shadow-card)] ring-1 ring-inset ring-sky-200">
                <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-2xl bg-grape-soft text-2xl">🔮</span>
                <span>
                  <span className="block font-display text-lg font-bold text-ink">Personality quiz</span>
                  <span className="block text-sm text-ink-soft">Six questions to find your squish match</span>
                </span>
              </Link>
            </li>
            <li>
              <Link href="/squish-box" className="squishy flex h-full items-center gap-3 rounded-[1.75rem] bg-white p-4 shadow-[var(--shadow-card)] ring-1 ring-inset ring-sky-200">
                <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-2xl bg-berry-soft text-2xl">🎁</span>
                <span>
                  <span className="block font-display text-lg font-bold text-ink">Build a Squish Box</span>
                  <span className="block text-sm text-ink-soft">Design your dream box (preview)</span>
                </span>
              </Link>
            </li>
          </ul>
        </div>
        <div className="mx-auto rounded-[2.5rem] bg-white/70 px-4 pb-5 pt-6 shadow-[var(--shadow-card)] ring-1 ring-inset ring-sky-200">
          <TeaserPad />
        </div>
      </Container>
    </section>
  );
}
