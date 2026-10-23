import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8", className)}>{children}</div>;
}

type BadgeTone = "sky" | "white" | "berry" | "lemon" | "grape" | "peach" | "mint" | "navy";

const badgeTones: Record<BadgeTone, string> = {
  sky: "bg-ice text-royal ring-sky-200",
  white: "bg-white text-ink ring-sky-200",
  berry: "bg-berry-soft text-ink ring-berry/40",
  lemon: "bg-lemon-soft text-ink ring-lemon",
  grape: "bg-grape-soft text-ink ring-grape/40",
  peach: "bg-peach-soft text-ink ring-peach/40",
  mint: "bg-mint-soft text-ink ring-mint/50",
  navy: "bg-navy text-white ring-white/20",
};

export function Badge({
  tone = "sky",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-display text-sm font-semibold ring-1 ring-inset",
        badgeTones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Eyebrow + bubbly heading + optional lead copy. */
export function SectionHeading({
  eyebrow,
  title,
  lead,
  align = "center",
  as: Tag = "h2",
  className,
  invert = false,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  align?: "center" | "left" | "responsive";
  as?: "h1" | "h2";
  className?: string;
  invert?: boolean;
}) {
  return (
    <div
      className={cn(
        "max-w-2xl",
        align === "center" && "mx-auto text-center",
        align === "left" && "text-left",
        align === "responsive" && "mx-auto text-center lg:mx-0 lg:text-left",
        className,
      )}
    >
      {eyebrow && (
        <p
          className={cn(
            "mb-3 inline-flex items-center gap-2 rounded-full px-3.5 py-1 font-display text-sm font-semibold uppercase tracking-[0.14em]",
            invert ? "bg-white/10 text-sky-200 ring-1 ring-inset ring-white/20" : "bg-white text-royal ring-1 ring-inset ring-sky-200",
          )}
        >
          {eyebrow}
        </p>
      )}
      <Tag
        className={cn(
          "font-display font-bold leading-[1.05] tracking-tight",
          Tag === "h1" ? "text-4xl sm:text-5xl lg:text-6xl" : "text-3xl sm:text-4xl lg:text-5xl",
          invert ? "text-white" : "text-ink",
        )}
      >
        {title}
      </Tag>
      {lead && (
        <p className={cn("mt-4 text-lg leading-relaxed sm:text-xl", invert ? "text-sky-200" : "text-ink-soft")}>
          {lead}
        </p>
      )}
    </div>
  );
}

/** Notice panel used for pre-launch disclaimers (preview catalog, drafts...). */
export function Notice({
  title,
  children,
  tone = "lemon",
  icon,
  className,
}: {
  title: ReactNode;
  children: ReactNode;
  tone?: "lemon" | "sky" | "berry";
  icon?: ReactNode;
  className?: string;
}) {
  const tones = {
    lemon: "bg-lemon-soft ring-lemon",
    sky: "bg-white ring-sky-200",
    berry: "bg-berry-soft ring-berry/40",
  };
  return (
    <div
      role="note"
      className={cn("flex gap-3 rounded-3xl p-4 text-ink ring-2 ring-inset sm:p-5", tones[tone], className)}
    >
      {icon && <div className="mt-0.5 shrink-0 text-ink">{icon}</div>}
      <div>
        <p className="font-display text-lg font-semibold leading-tight">{title}</p>
        <div className="mt-1 text-[0.97rem] leading-relaxed text-ink-soft">{children}</div>
      </div>
    </div>
  );
}
