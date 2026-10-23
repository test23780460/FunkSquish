import type { Metadata } from "next";
import { Fragment } from "react";
import { siteConfig } from "@/lib/site";
import { faqGroups } from "@/content/faq";
import { PageTransition } from "@/components/layout/PageTransition";
import { PageHero } from "@/components/layout/PageHero";
import { Container, Badge } from "@/components/ui/Primitives";
import { ButtonLink } from "@/components/ui/Button";
import { ChevronDownIcon, MailIcon, SparklesIcon } from "@/components/icons/Icons";
import { Mascot } from "@/components/illustrations/Mascot";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Answers about FunkSquish's upcoming launch, squishies, pricing, shipping, and returns.",
};

const linkClass = "font-semibold text-royal underline decoration-2 underline-offset-4";

/** Turns our email address and TikTok handle inside answers into links. */
function linkify(text: string) {
  const pattern = new RegExp(`(${siteConfig.email.replace(/\./g, "\\.")}|${siteConfig.tiktok.handle})`, "g");
  return text.split(pattern).map((part, i) => {
    if (part === siteConfig.email)
      return (
        <a key={i} href={`mailto:${siteConfig.email}`} className={linkClass}>
          {part}
        </a>
      );
    if (part === siteConfig.tiktok.handle)
      return (
        <a key={i} href={siteConfig.tiktok.url} target="_blank" rel="noopener noreferrer" className={linkClass}>
          {part}
        </a>
      );
    return <Fragment key={i}>{part}</Fragment>;
  });
}

export default function FaqPage() {
  return (
    <PageTransition>
      <PageHero
        eyebrow={
          <>
            <SparklesIcon className="size-4" /> FAQ
          </>
        }
        title={
          <>
            Squishy <span className="text-squish">questions</span>
          </>
        }
        lead="We're still getting ready to launch, so some answers are marked “coming soon.” We'll fill them in as soon as they're decided."
      />

      <section className="bg-white pb-28 pt-6 sm:pb-36">
        <Container className="grid max-w-5xl gap-10 lg:grid-cols-[14rem_1fr]">
          {/* Jump links */}
          <nav aria-label="FAQ topics" className="min-w-0 lg:sticky lg:top-28 lg:self-start">
            <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-col lg:px-0 [&::-webkit-scrollbar]:hidden">
              {faqGroups.map((g) => (
                <li key={g.id} className="shrink-0">
                  <a
                    href={`#${g.id}`}
                    className="inline-flex min-h-11 items-center rounded-full bg-ice-50 px-4 font-display font-semibold text-ink ring-1 ring-inset ring-sky-200 transition-colors hover:bg-ice hover:text-royal lg:flex"
                  >
                    {g.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="min-w-0 space-y-12">
            {faqGroups.map((group) => (
              <section key={group.id} id={group.id} aria-labelledby={`${group.id}-title`}>
                <h2 id={`${group.id}-title`} className="font-display text-2xl font-bold text-ink sm:text-3xl">
                  {group.title}
                </h2>
                <div className="mt-4 space-y-3">
                  {group.items.map((item) => (
                    <details
                      key={item.q}
                      className="group rounded-[1.5rem] bg-ice-50 ring-1 ring-inset ring-sky-200 transition-colors open:bg-white open:shadow-[var(--shadow-card)]"
                    >
                      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 rounded-[1.5rem] px-5 py-4 font-display text-lg font-semibold text-ink [&::-webkit-details-marker]:hidden">
                        <span className="flex-1">
                          {item.q}
                          {item.pending && (
                            <Badge tone="lemon" className="ml-2 align-middle text-xs">
                              Coming soon
                            </Badge>
                          )}
                        </span>
                        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-royal ring-1 ring-inset ring-sky-200 transition-transform duration-300 ease-squish group-open:rotate-180">
                          <ChevronDownIcon className="size-5" />
                        </span>
                      </summary>
                      <p className="px-5 pb-5 text-[1.05rem] leading-relaxed text-ink-soft">{linkify(item.a)}</p>
                    </details>
                  ))}
                </div>
              </section>
            ))}

            <div className="flex flex-col items-center gap-4 rounded-[2rem] bg-ice p-6 text-center sm:flex-row sm:text-left">
              <Mascot className="w-20 shrink-0" mood="happy" />
              <div className="flex-1">
                <p className="font-display text-xl font-bold text-ink">Still have a question?</p>
                <p className="text-ink-soft">We&apos;re happy to help — just send us a note.</p>
              </div>
              <ButtonLink href="/contact">
                <MailIcon className="size-5" />
                Contact us
              </ButtonLink>
            </div>
          </div>
        </Container>
      </section>
    </PageTransition>
  );
}
