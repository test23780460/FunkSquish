import { meterLabels, type TextureMeters as Meters } from "@/content/textures";
import { cn } from "@/lib/cn";

/** Five-dot meters (squish, bounce-back, sound). Relative, not measurements. */
export function TextureMeters({ meters, solid, className }: { meters: Meters; solid: string; className?: string }) {
  return (
    <dl className={cn("space-y-2.5", className)}>
      {(Object.keys(meterLabels) as (keyof Meters)[]).map((key) => (
        <div key={key} className="flex items-center justify-between gap-4">
          <dt className="font-display font-semibold text-ink">{meterLabels[key]}</dt>
          <dd className="flex items-center gap-1.5">
            <span className="sr-only">
              {meters[key]} out of 5
            </span>
            {[1, 2, 3, 4, 5].map((i) => (
              <span
                key={i}
                aria-hidden="true"
                className={cn(
                  "h-3 w-6 rounded-full ring-1 ring-inset sm:w-7",
                  i <= meters[key] ? cn(solid, "ring-ink/25") : "bg-ice-50 ring-sky-200",
                )}
              />
            ))}
          </dd>
        </div>
      ))}
    </dl>
  );
}
