import Link from "next/link";
import { listProducts } from "@/commerce/catalog";
import { getCategory } from "@/commerce/categories";
import { drops } from "@/content/drops";
import { sortDrops } from "@/lib/drops";
import { dropAlertsAvailable } from "@/app/actions/drop-alerts";
import { PageTransition } from "@/components/layout/PageTransition";
import { PageHero } from "@/components/layout/PageHero";
import { Badge, Container, SectionHeading } from "@/components/ui/Primitives";
import { ButtonAnchor } from "@/components/ui/Button";
import { ProductCard } from "@/components/shop/ProductCard";
import { LiveStock } from "@/components/shop/LiveStock";
import { DropAlertForm } from "@/components/drops/DropAlertForm";
import { DropTiming } from "@/components/drops/DropTiming";
import { Mascot } from "@/components/illustrations/Mascot";
import { CheckIcon, SparklesIcon, TikTokIcon } from "@/components/icons/Icons";
import { themeClasses } from "@/components/theme";
import { siteConfig } from "@/lib/site";
import { pageMetadata } from "@/lib/seo";
import { cn } from "@/lib/cn";

export const metadata = pageMetadata({
  title: "New drops",
  description: "Upcoming FunkSquish drops and restocks. Dates are only shown once they're confirmed.",
  path: "/drops",
});

const statusLabel = { planned: "Planned", announced: "Announced", "out-now": "Out now", ended: "Ended" } as const;

const promises = [
  "Dates and countdowns only appear once a drop is actually confirmed.",
  "Restock alerts only go out when an item is really back in stock.",
  "No fake “only 2 left” or “selling fast” messages — stock levels come from our real inventory.",
  "New drops are announced on TikTok first, often in a LIVE reveal.",
];

export default async function DropsPage() {
  const [products, alertsOn] = await Promise.all([listProducts(), dropAlertsAvailable()]);
  const list = sortDrops(drops);

  return (
    <PageTransition>
      <PageHero
        eyebrow={
          <>
            <SparklesIcon className="size-4" /> New drops
          </>
        }
        title={
          <>
            What&apos;s <span className="text-squish">dropping</span>
          </>
        }
        lead="New squishies and restocks, announced here and on TikTok. No made-up dates — we only post a date once it's real."
      />

      <section aria-labelledby="drops-title" className="bg-white pb-16 pt-4 sm:pb-20">
        <Container className="grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-start">
          <div>
            <h2 id="drops-title" className="sr-only">
              Drops
            </h2>
            <ul className="space-y-5">
              {list.map((drop) => {
                const items = drop.productSlugs.flatMap((slug) => products.find((p) => p.slug === slug) ?? []);
                return (
                  <li key={drop.id} className="rounded-[2.25rem] bg-white p-5 shadow-[var(--shadow-card)] ring-1 ring-inset ring-sky-200 sm:p-7">
                    <div className="flex flex-wrap gap-2">
                      <Badge tone={drop.kind === "restock" ? "mint" : "grape"}>{drop.kind === "restock" ? "Restock" : "New drop"}</Badge>
                      <Badge tone={drop.status === "out-now" ? "mint" : drop.status === "announced" ? "sky" : "white"}>{statusLabel[drop.status]}</Badge>
                    </div>
                    <h3 className="mt-3 font-display text-2xl font-bold text-ink sm:text-3xl">{drop.title}</h3>
                    <p className="mt-2 text-lg leading-relaxed text-ink-soft">{drop.summary}</p>
                    <div className="mt-5">
                      <DropTiming drop={drop} />
                    </div>
                    {drop.collections.length > 0 && (
                      <div className="mt-5">
                        <p className="font-display font-semibold text-ink">Collections</p>
                        <ul className="mt-2 flex flex-wrap gap-2">
                          {drop.collections.map((slug) => {
                            const c = getCategory(slug);
                            if (!c) return null;
                            return (
                              <li key={slug}>
                                <Link
                                  href={`/shop?category=${slug}`}
                                  className={cn("inline-flex min-h-10 items-center rounded-full px-4 font-display text-sm font-semibold text-ink ring-1 ring-inset", themeClasses[c.theme].soft, themeClasses[c.theme].ring)}
                                >
                                  {c.name}
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                    {items.length > 0 && (
                      <LiveStock products={items}>
                        {(shown) => (
                          <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
                            {shown.map((p) => (
                              <li key={p.id}>
                                <ProductCard product={p} />
                              </li>
                            ))}
                          </ul>
                        )}
                      </LiveStock>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          <aside id="alerts" aria-label="Drop alerts" className="space-y-5 lg:sticky lg:top-28">
            <DropAlertForm enabled={alertsOn} />
            <div className="relative overflow-hidden rounded-[2rem] bg-ink p-6 text-white">
              <Mascot className="absolute -bottom-6 -right-4 w-24 opacity-90" mood="wink" />
              <h2 className="font-display text-xl font-bold">First to know: TikTok</h2>
              <p className="mt-2 max-w-[16rem] text-sky-200">Drops are revealed on TikTok first — often LIVE.</p>
              <ButtonAnchor href={siteConfig.tiktok.url} data-umami-event="tiktok-click" variant="secondary" className="relative mt-4">
                <TikTokIcon className="size-5" />
                Follow {siteConfig.tiktok.handle}
                <span className="sr-only"> (opens in a new tab)</span>
              </ButtonAnchor>
            </div>
          </aside>
        </Container>
      </section>

      <section aria-labelledby="promise-title" className="relative overflow-hidden bg-ice-50 pb-28 pt-14 sm:pb-36">
        <div aria-hidden="true" className="absolute inset-0 dots opacity-60" />
        <Container className="relative">
          <SectionHeading eyebrow="Our drop promise" title={<span id="promise-title">No hype tricks. Ever.</span>} />
          <ul className="mx-auto mt-10 grid max-w-4xl gap-3 sm:grid-cols-2">
            {promises.map((p) => (
              <li key={p} className="flex items-start gap-3 rounded-[1.75rem] bg-white p-5 ring-1 ring-inset ring-sky-200">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-mint-soft text-[#0f7a60]">
                  <CheckIcon className="size-4" />
                </span>
                <span className="text-ink">{p}</span>
              </li>
            ))}
          </ul>
        </Container>
      </section>
    </PageTransition>
  );
}
