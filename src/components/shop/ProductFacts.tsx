import type { Product } from "@/commerce/types";
import { CheckIcon } from "@/components/icons/Icons";
import { cn } from "@/lib/cn";

/**
 * "What we've confirmed" checklist: shows shoppers exactly which details are
 * verified for this product and which are still pending. Nothing is ticked
 * unless the catalog actually contains it.
 */
export function productFacts(product: Product): { label: string; confirmed: boolean; detail?: string }[] {
  const s = product.safety;
  const images = product.media.filter((m) => m.type === "image").length;
  const videos = product.media.filter((m) => m.type === "video").length;
  return [
    { label: "Real product photos", confirmed: images > 0, detail: images > 0 ? `${images} photo${images === 1 ? "" : "s"}` : undefined },
    { label: "Squeeze video", confirmed: videos > 0, detail: videos > 0 ? `${videos} video${videos === 1 ? "" : "s"}` : undefined },
    { label: "Material & filling", confirmed: !!(product.specs.material && product.specs.fill) },
    { label: "Size & weight", confirmed: !!product.specs.sizeDescription && product.variants.every((v) => v.weightGrams !== null) },
    { label: "Age grading from the label", confirmed: !!s.ageGrade, detail: s.ageGrade ?? undefined },
    { label: "Label warnings", confirmed: s.warnings.length > 0 },
    { label: "Manufacturer or importer", confirmed: !!s.manufacturerOrImporter },
    { label: "Country of origin", confirmed: !!s.countryOfOrigin, detail: s.countryOfOrigin ?? undefined },
  ];
}

export function ProductFacts({ product, className }: { product: Product; className?: string }) {
  const facts = productFacts(product);
  const done = facts.filter((f) => f.confirmed).length;
  const preview = product.publication === "preview";

  return (
    <section aria-labelledby="facts-title" className={cn("rounded-[1.75rem] bg-white p-5 ring-1 ring-inset ring-sky-200", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="facts-title" className="font-display text-lg font-bold text-ink">
          What we&apos;ve confirmed
        </h2>
        <p className="font-display text-sm font-semibold text-ink-soft">
          {done} of {facts.length}
        </p>
      </div>
      <div aria-hidden="true" className="mt-2 h-2 overflow-hidden rounded-full bg-ice">
        <div className="h-full rounded-full bg-mint" style={{ width: `${(done / facts.length) * 100}%` }} />
      </div>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {facts.map((f) => (
          <li key={f.label} className="flex items-start gap-2.5 text-[0.95rem]">
            <span
              aria-hidden="true"
              className={cn(
                "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full",
                f.confirmed ? "bg-mint-soft text-[#0f7a60]" : "border-2 border-dashed border-sky-300",
              )}
            >
              {f.confirmed && <CheckIcon className="size-3" />}
            </span>
            <span className={f.confirmed ? "text-ink" : "text-ink-soft"}>
              {f.label}
              <span className="sr-only">{f.confirmed ? ": confirmed" : ": not confirmed yet"}</span>
              {f.detail && <span className="text-ink-soft"> · {f.detail}</span>}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm leading-relaxed text-ink-soft">
        {preview
          ? "This is a sample design, so none of these details are confirmed yet. Real products get them from real samples and their labels."
          : "Details come from the product's own label and our real samples. Anything not ticked is still being checked."}
      </p>
    </section>
  );
}
