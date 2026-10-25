import { Container } from "@/components/ui/Primitives";
import { ButtonAnchor, ButtonLink } from "@/components/ui/Button";
import { Mascot } from "@/components/illustrations/Mascot";
import { TikTokIcon } from "@/components/icons/Icons";
import { pageMetadata } from "@/lib/seo";
import { siteConfig } from "@/lib/site";

export const metadata = pageMetadata({
  title: "Drop alerts are on",
  description: "Your FunkSquish drop and restock alerts are confirmed.",
  path: "/drops/confirmed",
  noindex: true,
});

/** Landing page after someone clicks the confirmation link in the Brevo email. */
export default function DropAlertsConfirmedPage() {
  return (
    <section className="relative overflow-hidden sky-wash pb-32 pt-32 sm:pb-40 sm:pt-40">
      <Container className="flex flex-col items-center text-center">
        <Mascot className="w-40 animate-bob sm:w-48" mood="grin" wave />
        <h1 className="mt-6 font-display text-4xl font-bold text-ink sm:text-6xl">
          Drop alerts <span className="text-squish">on!</span>
        </h1>
        <p className="mt-4 max-w-md text-lg text-ink-soft">
          Thanks for confirming. We&apos;ll email you when a new drop or restock is announced. You can unsubscribe anytime from any of our emails.
        </p>
        <div className="mt-8 flex flex-col gap-4 min-[440px]:flex-row">
          <ButtonLink href="/drops" size="lg">See upcoming drops</ButtonLink>
          <ButtonAnchor href={siteConfig.tiktok.url}
              data-umami-event="tiktok-click" variant="secondary" size="lg">
            <TikTokIcon className="size-5" />
            {siteConfig.tiktok.handle}
          </ButtonAnchor>
        </div>
      </Container>
    </section>
  );
}
