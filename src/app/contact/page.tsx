import Link from "next/link";
import { PageTransition } from "@/components/layout/PageTransition";
import { PageHero } from "@/components/layout/PageHero";
import { Container } from "@/components/ui/Primitives";
import { ButtonAnchor } from "@/components/ui/Button";
import { MailIcon, TikTokIcon, SparklesIcon } from "@/components/icons/Icons";
import { Mascot } from "@/components/illustrations/Mascot";
import { siteConfig } from "@/lib/site";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Contact",
  description: `Get in touch with FunkSquish at ${siteConfig.email} or on TikTok ${siteConfig.tiktok.handle}.`,
  path: "/contact",
});

export default function ContactPage() {
  return (
    <PageTransition>
      <PageHero
        eyebrow={
          <>
            <MailIcon className="size-4" /> Contact
          </>
        }
        title={
          <>
            Say <span className="text-squish">hello!</span>
          </>
        }
        lead="Questions, ideas, supplier or collab inquiries — we'd love to hear from you."
      />

      <section className="bg-white pb-28 pt-6 sm:pb-36">
        <Container className="grid max-w-5xl gap-5 md:grid-cols-2">
          <div className="relative overflow-hidden rounded-[2.25rem] bg-[linear-gradient(160deg,#e4f3ff_0%,#ffffff_70%)] p-6 shadow-[var(--shadow-card)] ring-1 ring-inset ring-sky-200 sm:p-8">
            <Mascot className="absolute -bottom-6 -right-6 w-32 opacity-90" mood="wink" />
            <span className="grid size-14 place-items-center rounded-2xl bg-royal text-white shadow-[0_4px_0_var(--color-navy)]">
              <MailIcon className="size-7" />
            </span>
            <h2 className="mt-5 font-display text-2xl font-bold text-ink sm:text-3xl">Email us</h2>
            <p className="mt-2 max-w-xs text-lg leading-relaxed text-ink-soft">
              The best way to reach us about anything at all.
            </p>
            <a
              href={`mailto:${siteConfig.email}`}
              className="relative mt-5 inline-block break-all font-display text-xl font-semibold text-royal underline decoration-sky-300 decoration-[3px] underline-offset-[6px] hover:decoration-royal sm:text-2xl"
            >
              {siteConfig.email}
            </a>
            <div className="relative mt-6">
              <ButtonAnchor href={`mailto:${siteConfig.email}`}>
                <MailIcon className="size-5" />
                Write an email
              </ButtonAnchor>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[2.25rem] bg-ink p-6 text-white shadow-[var(--shadow-float)] sm:p-8">
            <SparklesIcon className="absolute right-6 top-6 size-8 text-sky-300" />
            <span className="grid size-14 place-items-center rounded-2xl bg-white text-ink">
              <TikTokIcon className="size-7" />
            </span>
            <h2 className="mt-5 font-display text-2xl font-bold sm:text-3xl">Find us on TikTok</h2>
            <p className="mt-2 max-w-xs text-lg leading-relaxed text-sky-200">
              Follow for launch news and sneak peeks, or send us a message there.
            </p>
            <p className="mt-5 font-display text-xl font-semibold sm:text-2xl">{siteConfig.tiktok.handle}</p>
            <div className="mt-6">
              <ButtonAnchor href={siteConfig.tiktok.url}
              data-umami-event="tiktok-click" variant="secondary">
                <TikTokIcon className="size-5" />
                Open TikTok
                <span className="sr-only"> (opens in a new tab)</span>
              </ButtonAnchor>
            </div>
          </div>

          <p className="text-center text-ink-soft md:col-span-2">
            Supplier, wholesale or collab idea? See{" "}
            <Link href="/partners" className="font-semibold text-royal underline decoration-2 underline-offset-4">
              Become a partner
            </Link>
            . Looking for quick answers? Check the{" "}
            <Link href="/faq" className="font-semibold text-royal underline decoration-2 underline-offset-4">
              FAQ
            </Link>
            .
          </p>
        </Container>
      </section>
    </PageTransition>
  );
}
