import type { Metadata } from "next";
import { Container } from "@/components/ui/Primitives";
import { ButtonLink } from "@/components/ui/Button";
import { Mascot } from "@/components/illustrations/Mascot";
import { Bubble } from "@/components/decor/Decor";
import { ArrowLeftIcon } from "@/components/icons/Icons";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <section className="relative overflow-hidden sky-wash pb-32 pt-32 sm:pb-40 sm:pt-40">
      <Bubble size={30} className="left-[10%] top-[30%]" />
      <Bubble size={18} className="right-[14%] top-[40%]" delay={1.4} />
      <Container className="relative flex flex-col items-center text-center">
        <Mascot className="w-40 animate-bob sm:w-48" mood="sleepy" />
        <p className="mt-6 font-display text-sm font-semibold uppercase tracking-[0.14em] text-royal">Error 404</p>
        <h1 className="mt-2 font-display text-4xl font-bold text-ink sm:text-6xl">
          This page got <span className="text-squish">squished</span>
        </h1>
        <p className="mt-4 max-w-md text-lg text-ink-soft">
          We couldn&apos;t find what you were looking for. Let&apos;s bounce back to the homepage.
        </p>
        <ButtonLink href="/" size="lg" className="mt-8">
          <ArrowLeftIcon className="size-5" />
          Back home
        </ButtonLink>
      </Container>
    </section>
  );
}
