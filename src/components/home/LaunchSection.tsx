import { Container } from "@/components/ui/Primitives";
import Image from "next/image";
import { siteConfig } from "@/lib/site";
import { CheckIcon } from "@/components/icons/Icons";
import { Bubble, Sparkle } from "@/components/decor/Decor";
import { NewsletterSignup } from "@/components/home/NewsletterSignup";
import { cn } from "@/lib/cn";

const steps: { title: string; body: string; state: "now" | "next" | "later" }[] = [
  { title: "Picking our first squishies", body: "Working with suppliers on our very first collection.", state: "now" },
  { title: "Stocking the shelves", body: "Getting real squishies in hand and photographed.", state: "next" },
  { title: "Shop opens", body: "Launch day! Date to be announced on TikTok.", state: "later" },
];

const stateLabel = { now: "In progress", next: "Up next", later: "Coming soon" };

export function LaunchSection() {
  return (
    <section aria-labelledby="launch-title" className="bg-white pb-20 pt-6 sm:pb-28 sm:pt-10">
      <Container>
        <div className="relative overflow-hidden rounded-[2.5rem] bg-[linear-gradient(135deg,#e4f3ff_0%,#ffffff_45%,#d6ecff_100%)] p-6 shadow-[var(--shadow-float)] ring-1 ring-inset ring-sky-200 sm:p-10 lg:p-14">
          <div aria-hidden="true" className="absolute inset-0 dots opacity-50" />
          <Sparkle className="right-[30%] top-8 size-4" color="#7cc2ff" />
          <Bubble size={40} className="-right-4 top-10" />
          <Bubble size={18} className="bottom-10 left-[46%]" delay={1.5} />

          <div className="relative grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:items-center">
            <div>
              <div className="flex items-center gap-4">
                <Image
                  src={siteConfig.logo.src}
                  alt={siteConfig.logo.alt}
                  width={112}
                  height={112}
                  className="size-24 shrink-0 animate-bob rounded-full drop-shadow-[0_10px_16px_rgba(19,53,122,0.25)] sm:size-28"
                />
                <p className="font-display text-sm font-semibold uppercase tracking-[0.14em] text-royal">
                  Launch announcement
                </p>
              </div>
              <h2 id="launch-title" className="mt-4 font-display text-4xl font-bold leading-[1.02] tracking-tight text-ink sm:text-5xl">
                The squish drop is <span className="text-squish">coming</span>
              </h2>
              <p className="mt-4 max-w-lg text-lg leading-relaxed text-ink-soft">
                FunkSquish is getting ready for launch. We&apos;re choosing our first squishies right now, and we&apos;ll share the
                opening date as soon as it&apos;s set.
              </p>

              <NewsletterSignup className="mt-8" />
            </div>

            <ol className="relative space-y-3" aria-label="Launch progress">
              {steps.map((s, i) => (
                <li
                  key={s.title}
                  className={cn(
                    "relative flex gap-4 rounded-3xl bg-white p-4 ring-1 ring-inset sm:p-5",
                    s.state === "now" ? "ring-2 ring-royal shadow-[0_6px_0_var(--color-sky-200)]" : "ring-sky-200",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-11 shrink-0 place-items-center rounded-full font-display text-lg font-bold",
                      s.state === "now" ? "bg-royal text-white" : "bg-ice text-royal",
                    )}
                  >
                    {s.state === "now" ? <CheckIcon className="size-5" /> : i + 1}
                  </span>
                  <div>
                    <p className="font-display text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft">
                      {stateLabel[s.state]}
                    </p>
                    <p className="font-display text-lg font-bold text-ink">{s.title}</p>
                    <p className="text-ink-soft">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </Container>
    </section>
  );
}
