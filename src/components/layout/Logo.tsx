import Image from "next/image";
import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/cn";

/**
 * Brand logo.
 *
 * When the official FunkSquish logo file is added (see `siteConfig.logo.src`),
 * it is rendered everywhere automatically. Until then we show a typographic
 * wordmark placeholder so no unrelated logo is ever used.
 */
export function Logo({
  className,
  size = "md",
  invert = false,
  priority = false,
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  invert?: boolean;
  priority?: boolean;
}) {
  const heights = { sm: "h-8", md: "h-10", lg: "h-14" };

  if (siteConfig.logo.src) {
    return (
      <Image
        src={siteConfig.logo.src}
        alt={siteConfig.logo.alt}
        width={siteConfig.logo.width}
        height={siteConfig.logo.height}
        priority={priority}
        className={cn("w-auto", heights[size], className)}
      />
    );
  }

  const text = { sm: "text-xl", md: "text-2xl", lg: "text-4xl" };

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className={cn("shrink-0", heights[size], "w-auto")} />
      <span
        className={cn(
          "font-display font-bold leading-none tracking-tight",
          text[size],
          invert ? "text-white" : "text-ink",
        )}
      >
        Funk<span className={invert ? "text-sky-300" : "text-royal"}>Squish</span>
      </span>
    </span>
  );
}

/** Small blob mark used beside the placeholder wordmark (and as the favicon). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path
        d="M32 9c15 0 24 12 25 26 1 14-7 22-25 22S6 49 7 35C8 21 17 9 32 9Z"
        fill="#3d9bff"
        stroke="#13357a"
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      <path d="M32 9c-1.5-4 0-7.5 4-7.5 3.4 0 4.6 3.8 1.8 5" fill="none" stroke="#13357a" strokeWidth="3.5" strokeLinecap="round" />
      <ellipse cx="20" cy="22" rx="6.5" ry="3.6" transform="rotate(-38 20 22)" fill="#fff" opacity="0.85" />
      <ellipse cx="25" cy="35" rx="2.8" ry="3.6" fill="#13357a" />
      <ellipse cx="39" cy="35" rx="2.8" ry="3.6" fill="#13357a" />
      <circle cx="26" cy="33.6" r="1.1" fill="#fff" />
      <circle cx="40" cy="33.6" r="1.1" fill="#fff" />
      <path d="M28.5 41.5c2 2.2 5 2.2 7 0" fill="none" stroke="#13357a" strokeWidth="2.6" strokeLinecap="round" />
      <ellipse cx="18" cy="41" rx="3.4" ry="2" fill="#ff8fb8" opacity="0.8" />
      <ellipse cx="46" cy="41" rx="3.4" ry="2" fill="#ff8fb8" opacity="0.8" />
    </svg>
  );
}
