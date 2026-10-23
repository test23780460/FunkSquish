import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";

/** A single glossy soap-bubble. Purely decorative. */
export function Bubble({
  className,
  size = 48,
  delay = 0,
  float = true,
  style,
}: {
  className?: string;
  size?: number;
  delay?: number;
  float?: boolean;
  style?: CSSProperties;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute rounded-full",
        "bg-[radial-gradient(circle_at_32%_28%,#ffffff_0%,rgba(255,255,255,0.85)_12%,rgba(180,222,255,0.55)_40%,rgba(61,155,255,0.25)_75%,rgba(61,155,255,0.45)_100%)]",
        "shadow-[inset_0_-4px_10px_rgba(31,95,214,0.25),0_8px_20px_-10px_rgba(31,95,214,0.5)] ring-1 ring-white/70",
        float && "animate-float",
        className,
      )}
      style={{ width: size, height: size, animationDelay: `${delay}s`, ...style }}
    />
  );
}

/** Four-point twinkle star. */
export function Sparkle({
  className,
  color = "#ffffff",
  delay = 0,
}: {
  className?: string;
  color?: string;
  delay?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn("pointer-events-none absolute animate-twinkle", className)}
      style={{ animationDelay: `${delay}s` }}
    >
      <path d="M12 0c.9 6.5 4.6 10.6 12 12-7.4 1.4-11.1 5.5-12 12-.9-6.5-4.6-10.6-12-12C7.4 10.6 11.1 6.5 12 0Z" fill={color} />
    </svg>
  );
}

/** Soft wave used to transition between sections. `fill` is the color of the NEXT section. */
export function Wave({
  className,
  fill = "#ffffff",
  flip = false,
}: {
  className?: string;
  fill?: string;
  flip?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 1440 120"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={cn("block h-10 w-full sm:h-16 lg:h-20", flip && "rotate-180", className)}
    >
      <path
        d="M0 64 C 160 16 320 16 480 52 C 640 88 800 104 960 76 C 1120 48 1280 24 1440 56 L 1440 120 L 0 120 Z"
        fill={fill}
      />
    </svg>
  );
}

/** Deterministic bubble field for section backgrounds (no randomness = stable SSR). */
const FIELD = [
  { top: "8%", left: "4%", size: 28, delay: 0 },
  { top: "18%", left: "88%", size: 44, delay: 1.2 },
  { top: "62%", left: "92%", size: 22, delay: 2.4 },
  { top: "74%", left: "6%", size: 36, delay: 0.8 },
  { top: "40%", left: "50%", size: 14, delay: 3.1 },
  { top: "86%", left: "60%", size: 18, delay: 1.7 },
];

export function BubbleField({ className, count = FIELD.length }: { className?: string; count?: number }) {
  return (
    <div aria-hidden="true" className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      {FIELD.slice(0, count).map((b, i) => (
        <Bubble key={i} size={b.size} delay={b.delay} style={{ top: b.top, left: b.left }} />
      ))}
    </div>
  );
}
