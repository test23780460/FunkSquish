import { Mascot } from "@/components/illustrations/Mascot";
import { JellyArt, SlushieArt } from "@/components/illustrations/ProductArt";
import { HeartIcon, TikTokIcon } from "@/components/icons/Icons";
import { previewPalettes as p } from "@/commerce/providers/preview";
import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/cn";

/**
 * Cartoon phone showing what a FunkSquish LIVE could look like.
 * Clearly labelled "soon" — it never claims we're currently live.
 */
export function PhoneLive({ className }: { className?: string }) {
  return (
    <figure className={cn("relative mx-auto w-full max-w-[19rem]", className)}>
      <div className="relative rotate-[3deg] rounded-[2.75rem] bg-ink p-2.5 shadow-[0_8px_0_#000c24,0_40px_60px_-30px_rgba(0,0,0,0.7)] ring-1 ring-white/10">
        <div className="relative aspect-[9/17] overflow-hidden rounded-[2.2rem] bg-[linear-gradient(180deg,#bfe3ff_0%,#e4f3ff_55%,#ffffff_100%)]">
          {/* notch */}
          <div aria-hidden="true" className="absolute left-1/2 top-2 z-20 h-5 w-24 -translate-x-1/2 rounded-full bg-ink" />

          {/* top bar */}
          <div className="absolute inset-x-3 top-10 z-10 flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-full bg-white ring-2 ring-royal">
              <Mascot className="size-6" mood="happy" />
            </span>
            <span className="font-display text-sm font-bold text-ink">{siteConfig.tiktok.handle}</span>
            <span className="ml-auto rounded-md bg-lemon px-2 py-0.5 font-display text-[0.7rem] font-bold uppercase tracking-wide text-ink">
              LIVE soon
            </span>
          </div>

          {/* "table" scene */}
          <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[34%] rounded-t-[50%] bg-white shadow-[0_-10px_30px_-10px_rgba(31,95,214,0.25)]" />
          <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[34%] rounded-t-[50%] dots opacity-60" />

          <Mascot className="absolute left-1/2 top-[24%] w-[62%] -translate-x-1/2 animate-bob" mood="grin" wave />
          <SlushieArt palette={p.blueRaspberry} className="absolute bottom-[9%] left-[8%] w-[30%] -rotate-6" />
          <JellyArt palette={p.strawberry} className="absolute bottom-[8%] right-[8%] w-[28%] rotate-6" />

          {/* floating hearts */}
          <div aria-hidden="true" className="absolute bottom-[36%] right-4 h-32 w-8">
            {[0, 1.2, 2.4].map((d, i) => (
              <HeartIcon
                key={d}
                className={cn("absolute bottom-0 size-6 animate-heart", ["text-berry", "text-sky", "text-grape"][i])}
                style={{ animationDelay: `${d}s`, left: `${i * 6}px` }}
              />
            ))}
          </div>

          {/* bottom bar */}
          <div className="absolute inset-x-3 bottom-3 z-10 flex items-center gap-2 rounded-full bg-white/90 py-1.5 pl-3 pr-1.5 ring-1 ring-sky-200">
            <span className="text-xs font-semibold text-ink-soft">Follow for the first LIVE</span>
            <span className="ml-auto grid size-7 place-items-center rounded-full bg-ink text-white">
              <TikTokIcon className="size-4" />
            </span>
          </div>
        </div>
      </div>
      <figcaption className="sr-only">
        Illustration of a phone showing the FunkSquish mascot on a future TikTok LIVE. We are not live yet.
      </figcaption>
    </figure>
  );
}
