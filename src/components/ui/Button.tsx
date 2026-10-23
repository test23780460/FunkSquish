import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "tiktok" | "ghost";
type Size = "md" | "lg";

/**
 * Candy-style "squishy" button: a glossy pill sitting on a darker base.
 * Hover lifts it, press squashes it down onto the base.
 */
const variants: Record<Variant, string> = {
  primary:
    "bg-royal text-white shadow-[0_6px_0_var(--color-navy),0_14px_24px_-10px_rgba(19,53,122,0.6)] hover:bg-[#2a6cec] active:shadow-[0_2px_0_var(--color-navy),0_6px_12px_-8px_rgba(19,53,122,0.6)]",
  secondary:
    "bg-white text-ink ring-2 ring-inset ring-sky-200 shadow-[0_6px_0_var(--color-sky-200),0_14px_24px_-12px_rgba(19,53,122,0.35)] hover:ring-sky-300 active:shadow-[0_2px_0_var(--color-sky-200)]",
  tiktok:
    "bg-ink text-white shadow-[0_6px_0_#000c24,0_14px_24px_-10px_rgba(0,12,36,0.6)] hover:bg-navy active:shadow-[0_2px_0_#000c24]",
  ghost: "bg-transparent text-ink hover:bg-ice",
};

const sizes: Record<Size, string> = {
  md: "min-h-11 px-5 text-base gap-2",
  lg: "min-h-14 px-7 text-lg gap-2.5",
};

export function buttonClasses({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: Variant;
  size?: Size;
  className?: string;
}) {
  return cn(
    "group/btn relative inline-flex select-none items-center justify-center rounded-full font-display font-semibold tracking-wide",
    "transition-[transform,box-shadow,background-color] duration-200 ease-squish",
    "hover:-translate-y-0.5 active:translate-y-1 active:scale-x-[1.03] active:scale-y-[0.97]",
    variant !== "ghost" &&
      "before:pointer-events-none before:absolute before:inset-x-3 before:top-1 before:h-[38%] before:rounded-full before:bg-white/25",
    variants[variant],
    sizes[size],
    className,
  );
}

type CommonProps = {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
};

/** Internal link styled as a button. */
export function ButtonLink({
  href,
  variant,
  size,
  className,
  children,
  ...rest
}: CommonProps & Omit<ComponentProps<typeof Link>, "className" | "children">) {
  return (
    <Link href={href} className={buttonClasses({ variant, size, className })} {...rest}>
      {children}
    </Link>
  );
}

/** External link (opens in a new tab) styled as a button. */
export function ButtonAnchor({
  href,
  variant,
  size,
  className,
  children,
  ...rest
}: CommonProps & Omit<ComponentProps<"a">, "className" | "children">) {
  const external = /^https?:\/\//.test(href ?? "");
  return (
    <a
      href={href}
      className={buttonClasses({ variant, size, className })}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      {...rest}
    >
      {children}
    </a>
  );
}

/**
 * Disabled-until-launch button. Renders as a real (disabled) button so the
 * layout is final; flip `disabled` off once the feature is wired up.
 */
export function PendingButton({
  children,
  className,
  size = "md",
  reason,
}: {
  children: ReactNode;
  className?: string;
  size?: Size;
  reason?: string;
}) {
  return (
    <button
      type="button"
      disabled
      aria-disabled="true"
      title={reason}
      className={cn(
        "relative inline-flex cursor-not-allowed select-none items-center justify-center rounded-full font-display font-semibold tracking-wide",
        "border-2 border-dashed border-sky-300 bg-ice text-ink-soft",
        sizes[size],
        className,
      )}
    >
      {children}
    </button>
  );
}
