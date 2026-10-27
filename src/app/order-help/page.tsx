import Link from "next/link";
import type { ReactNode } from "react";
import { PageTransition } from "@/components/layout/PageTransition";
import { PageHero } from "@/components/layout/PageHero";
import { Container, Notice } from "@/components/ui/Primitives";
import { ButtonAnchor } from "@/components/ui/Button";
import { MailIcon, StoreIcon, SparklesIcon } from "@/components/icons/Icons";
import { pageMetadata } from "@/lib/seo";
import { siteConfig } from "@/lib/site";

export const metadata = pageMetadata({
  title: "Order help",
  description: "How to get help with a FunkSquish order: what to include when you email us, plus shipping and returns information.",
  path: "/order-help",
});

const topics: { title: string; body: ReactNode }[] = [
  {
    title: "Where's my order?",
    body: (
      <>
        Once our shop is open, you&apos;ll get an order confirmation email from us (Stripe, our payment provider, may also send a
        payment receipt), and we&apos;ll email your tracking number when the order ships (TikTok Shop orders show this in the TikTok
        app). Items from our own stock ship within 2 business days. If something looks wrong, email us with your order number.
      </>
    ),
  },
  {
    title: "Something arrived damaged or wrong",
    body: (
      <>
        Email us your order number and, if you can, a photo of the item and packaging — ideally within 7 days of delivery, but
        please tell us even if it&apos;s later. Please stop using any squishy that is torn, leaking, or sticky. See our{" "}
        <Link href="/returns">returns policy</Link>.
      </>
    ),
  },
  {
    title: "Changing or canceling an order",
    body: (
      <>
        Email us as soon as possible with your order number. If it hasn&apos;t shipped yet, we&apos;ll cancel it and refund
        you in full, including shipping and tax. If part of it has shipped, we can cancel the packages that haven&apos;t. See our{" "}
        <Link href="/returns">returns policy</Link>.
      </>
    ),
  },
  {
    title: "Shipping questions",
    body: (
      <>
        Destinations, costs, processing times and what happens if an order is delayed are on our{" "}
        <Link href="/shipping">shipping page</Link>. Shipping is calculated for your cart and always shown, with your total,
        before you pay.
      </>
    ),
  },
];

export default function OrderHelpPage() {
  return (
    <PageTransition>
      <PageHero
        eyebrow={
          <>
            <StoreIcon className="size-4" /> Order help
          </>
        }
        title={
          <>
            Order <span className="text-squish">help</span>
          </>
        }
        lead="Here's how to reach us, and what to include so we can help quickly."
      />

      <section className="bg-white pb-28 pt-6 sm:pb-36">
        <Container className="max-w-3xl">
          <Notice title="The shop isn't open yet" icon={<SparklesIcon className="size-6" />} className="mb-8">
            No orders have been placed with FunkSquish yet. If anyone claims to sell FunkSquish products before our launch
            announcement on TikTok, it isn&apos;t us.
          </Notice>

          <div className="rounded-[2rem] bg-ice-50 p-6 ring-1 ring-inset ring-sky-200">
            <h2 className="font-display text-2xl font-bold text-ink">When you email us, include:</h2>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-lg text-ink-soft">
              <li>Your order number</li>
              <li>The name used on the order</li>
              <li>What went wrong, with a photo if something is damaged</li>
            </ul>
            <p className="mt-3 text-ink-soft">
              Please email us from the address you used for the order — for your privacy, we only discuss an order with its buyer.
              Don&apos;t send card numbers or passwords by email — we will never ask for them.
            </p>
            <ButtonAnchor href={`mailto:${siteConfig.email}?subject=Order%20help`} className="mt-5">
              <MailIcon className="size-5" />
              Email {siteConfig.email}
            </ButtonAnchor>
          </div>

          <div className="mt-8 space-y-3">
            {topics.map((t) => (
              <details key={t.title} className="group rounded-[1.5rem] bg-white ring-1 ring-inset ring-sky-200 open:shadow-[var(--shadow-card)]">
                <summary className="flex min-h-14 cursor-pointer list-none items-center px-5 py-4 font-display text-lg font-semibold text-ink [&::-webkit-details-marker]:hidden">
                  {t.title}
                </summary>
                <p className="px-5 pb-5 text-[1.05rem] leading-relaxed text-ink-soft [&_a]:font-semibold [&_a]:text-royal [&_a]:underline">{t.body}</p>
              </details>
            ))}
          </div>
        </Container>
      </section>
    </PageTransition>
  );
}
