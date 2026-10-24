import { notFound } from "next/navigation";
import { Container, Notice } from "@/components/ui/Primitives";
import { pageMetadata } from "@/lib/seo";
import { testCheckoutEnabled } from "@/commerce/checkout/environment";
import { TEST_BAD_CARTS, TEST_FIXTURE_PRODUCTS } from "@/commerce/checkout/test-fixtures";
import { TestCheckoutHarness } from "@/components/checkout/TestCheckoutHarness";

export const metadata = pageMetadata({
  title: "Stripe test checkout",
  description: "Internal Stripe test-mode checkout harness.",
  path: "/checkout/test",
  noindex: true,
});

/**
 * Internal Stripe TEST-mode harness. 404 unless the test integration is
 * enabled — which is impossible on the production site.
 */
export default function StripeTestCheckoutPage() {
  if (!testCheckoutEnabled()) notFound();
  return (
    <section className="sky-wash pb-28 pt-28 sm:pt-36">
      <Container className="max-w-3xl">
        <p className="font-display text-sm font-semibold uppercase tracking-[0.14em] text-royal">Internal · Stripe test mode</p>
        <h1 className="mt-2 font-display text-4xl font-bold text-ink sm:text-5xl">Test checkout</h1>
        <Notice tone="berry" title="Test mode only — nothing here is for sale" className="mt-6">
          These are made-up test products with made-up prices. Payments use Stripe test mode, so no real card is ever charged.
          Never use a real card number here.
        </Notice>
        <div className="mt-10">
          <TestCheckoutHarness products={TEST_FIXTURE_PRODUCTS} attacks={TEST_BAD_CARTS} />
        </div>
      </Container>
    </section>
  );
}
