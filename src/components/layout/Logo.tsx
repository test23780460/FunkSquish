import Image from "next/image";
import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/cn";

/**
 * Official FunkSquish logo: the round badge, optionally followed by the
 * name in our headline font so it stays readable at small sizes.
 * The badge is always rendered square (object-contain) so it never distorts.
 */
export function Logo({
  className,
  size = "md",
  invert = false,
  priority = false,
  wordmark = true,
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  invert?: boolean;
  priority?: boolean;
  wordmark?: boolean;
}) {
  const badge = {
    sm: "size-14 sm:size-16 -my-3",
    md: "size-20",
    lg: "size-28",
  };
  const text = { sm: "text-xl sm:text-[1.4rem]", md: "text-2xl", lg: "text-4xl" };
  // Largest rendered size in CSS px; next/image adds a 2x version for sharp screens.
  const px = { sm: 64, md: 80, lg: 112 };

  return (
    <span className={cn("inline-flex items-center gap-2 sm:gap-2.5", className)}>
      <Image
        src={siteConfig.logo.src}
        alt={wordmark ? "" : siteConfig.logo.alt}
        width={px[size]}
        height={px[size]}
        loading={priority ? "eager" : "lazy"}
        className={cn(
          "shrink-0 rounded-full object-contain drop-shadow-[0_6px_10px_rgba(19,53,122,0.25)] transition-transform duration-300 ease-squish group-hover/logo:-rotate-6 group-hover/logo:scale-105",
          badge[size],
        )}
      />
      {wordmark && (
        <span
          className={cn(
            "font-display font-bold leading-none tracking-tight",
            text[size],
            invert ? "text-white" : "text-ink",
          )}
        >
          Funk<span className={invert ? "text-sky-300" : "text-royal"}>Squish</span>
        </span>
      )}
    </span>
  );
}
