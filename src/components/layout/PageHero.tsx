import type { ReactNode } from "react";
import { Container } from "@/components/ui/Primitives";
import { Sparkle, Wave, Bubble } from "@/components/decor/Decor";
import { cn } from "@/lib/cn";

/** Header band used by inner pages: sky wash, bubbly title, optional art, wave into white. */
export function PageHero({
  eyebrow,
  title,
  lead,
  art,
  children,
  waveFill = "#ffffff",
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  art?: ReactNode;
  children?: ReactNode;
  waveFill?: string;
  className?: string;
}) {
  return (
    <section className={cn("relative overflow-hidden sky-wash", className)}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 dots opacity-50 [mask-image:linear-gradient(to_bottom,black,transparent_80%)]" />
        <Sparkle className="left-[8%] top-[34%] size-4" color="#3d9bff" />
        <Sparkle className="right-[10%] top-[30%] size-3" color="#ffffff" delay={1.2} />
        <Bubble size={22} className="left-[4%] top-[70%]" delay={0.8} />
        <Bubble size={30} className="right-[3%] top-[62%]" delay={2} />
      </div>

      <Container
        className={cn(
          "relative grid items-center gap-8 pb-8 pt-28 sm:pt-32 lg:pb-10 lg:pt-36",
          art ? "lg:grid-cols-[1.4fr_1fr]" : "",
        )}
      >
        <div className={cn("text-center", !!art && "lg:text-left")}>
          {eyebrow && (
            <p className="mb-4 inline-flex animate-rise items-center gap-2 rounded-full bg-white px-4 py-1.5 font-display text-sm font-semibold uppercase tracking-[0.14em] text-royal shadow-[0_4px_0_var(--color-sky-200)] ring-1 ring-inset ring-sky-200">
              {eyebrow}
            </p>
          )}
          <h1 className="animate-rise font-display text-[2.6rem] font-bold leading-[1] tracking-tight text-ink [animation-delay:80ms] sm:text-6xl lg:text-7xl">
            {title}
          </h1>
          {lead && (
            <p
              className={cn(
                "mx-auto mt-5 max-w-2xl animate-rise text-lg leading-relaxed text-ink-soft [animation-delay:160ms] sm:text-xl",
                !!art && "lg:mx-0",
              )}
            >
              {lead}
            </p>
          )}
          {children && <div className="mt-7 animate-rise [animation-delay:220ms]">{children}</div>}
        </div>
        {art && <div className="relative mx-auto w-full max-w-[12.5rem] sm:max-w-xs lg:max-w-sm">{art}</div>}
      </Container>
      <Wave fill={waveFill} className="-mb-px" />
    </section>
  );
}
