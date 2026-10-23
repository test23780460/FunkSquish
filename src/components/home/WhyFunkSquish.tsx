import type { ReactNode } from "react";
import { Container, SectionHeading } from "@/components/ui/Primitives";
import { HeartIcon, HomeHeartIcon, PlayIcon, SparklesIcon } from "@/components/icons/Icons";
import { Mascot } from "@/components/illustrations/Mascot";
import { Bubble } from "@/components/decor/Decor";
import { cn } from "@/lib/cn";

const reasons: { title: string; body: string; icon: ReactNode; tone: string }[] = [
  {
    title: "Cute & satisfying",
    body: "We're all about the squeeze — squishies that are fun to hold and even more fun to look at.",
    icon: <HeartIcon className="size-7" />,
    tone: "bg-berry-soft text-[#b8215a]",
  },
  {
    title: "Carefully selected designs",
    body: "We're choosing every design ourselves, looking for colors and characters that make you smile.",
    icon: <SparklesIcon className="size-7" />,
    tone: "bg-lemon-soft text-[#9a6a00]",
  },
  {
    title: "Fun TikTok LIVE experiences",
    body: "Squish tests, unboxings, and first looks at new designs — all planned for our TikTok LIVEs.",
    icon: <PlayIcon className="size-7" />,
    tone: "bg-ice text-royal",
  },
  {
    title: "Made by squishy lovers",
    body: "FunkSquish is a brand-new small business built by people who love squishies as much as you do.",
    icon: <HomeHeartIcon className="size-7" />,
    tone: "bg-mint-soft text-[#0f7a60]",
  },
];

export function WhyFunkSquish() {
  return (
    <section aria-labelledby="why-title" className="relative overflow-hidden bg-ice-50 py-16 sm:py-24">
      <div aria-hidden="true" className="absolute inset-0 dots opacity-70" />
      <Container className="relative grid items-center gap-12 lg:grid-cols-[0.9fr_1.4fr]">
        <div>
          <SectionHeading
            align="responsive"
            eyebrow="Why FunkSquish?"
            title={<span id="why-title">Squishies with personality</span>}
            lead="We want every squishy to feel like a tiny friend you're excited to bring home."
          />
          <div className="relative mx-auto mt-8 hidden w-56 lg:mx-0 lg:block">
            <Mascot className="w-full animate-bob" mood="wink" />
            <Bubble size={22} className="-right-2 top-2" />
            <Bubble size={14} className="right-10 -top-6" delay={1.4} />
          </div>
        </div>

        <ul className="grid gap-4 sm:grid-cols-2 sm:gap-5">
          {reasons.map((r, i) => (
            <li
              key={r.title}
              className={cn(
                "squishy grid grid-cols-[auto_1fr] gap-x-4 rounded-[2rem] bg-white p-5 shadow-[var(--shadow-card)] ring-1 ring-inset ring-sky-200/70 sm:block sm:p-6",
                i % 2 === 1 && "sm:translate-y-6",
              )}
            >
              <div className={cn("row-span-2 grid size-12 place-items-center rounded-2xl gloss sm:size-14", r.tone)}>{r.icon}</div>
              <h3 className="font-display text-xl font-bold leading-tight text-ink sm:mt-4">{r.title}</h3>
              <p className="mt-1.5 leading-relaxed text-ink-soft sm:mt-2">{r.body}</p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
