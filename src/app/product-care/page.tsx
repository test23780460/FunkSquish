import Link from "next/link";
import { PageTransition } from "@/components/layout/PageTransition";
import { PageHero } from "@/components/layout/PageHero";
import { Container, Notice } from "@/components/ui/Primitives";
import { HeartIcon } from "@/components/icons/Icons";
import { Mascot } from "@/components/illustrations/Mascot";
import { generalCare, CPSC_SQUISHY_ALERT_URL } from "@/content/product-care";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Product care & safety",
  description: "How to keep squishies safe and squishy: never heat or microwave them, what to watch for, and how to read product labels.",
  path: "/product-care",
});

const checks = [
  "The manufacturer or importer's name",
  "Age grading (for example, the youngest age the toy is meant for)",
  "Any required safety warnings",
  "Tracking information, such as a batch or production date",
];

export default function ProductCarePage() {
  return (
    <PageTransition>
      <PageHero
        eyebrow={
          <>
            <HeartIcon className="size-4" /> Care &amp; safety
          </>
        }
        title={
          <>
            Happy, safe <span className="text-squish">squishing</span>
          </>
        }
        lead="A few simple habits keep squishies fun — and keep everyone safe."
        art={<Mascot className="w-full animate-bob" mood="happy" />}
      />

      <section className="bg-white pb-28 pt-6 sm:pb-36">
        <Container className="max-w-3xl">
          <div className="rounded-[2rem] border-4 border-ink bg-lemon-soft p-6" role="note">
            <p className="font-display text-2xl font-bold text-ink">Never heat or microwave a squishy</p>
            <p className="mt-2 text-lg text-ink">
              Heated squishies can burst and release hot, sticky material that causes serious burns. Don&apos;t copy viral
              heating or melting videos, and keep squishies out of hot cars and away from heaters.
            </p>
          </div>

          <h2 className="mt-12 font-display text-3xl font-bold text-ink">Everyday care</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-lg leading-relaxed text-ink-soft">
            {generalCare.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>

          <h2 className="mt-12 font-display text-3xl font-bold text-ink">Check the label</h2>
          <p className="mt-3 text-lg text-ink-soft">Toys sold for children in the U.S. should show:</p>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-lg text-ink-soft">
            {checks.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <p className="mt-3 text-lg text-ink-soft">
            Each FunkSquish product page will list the age grading and warnings exactly as they appear on that product&apos;s
            label.
          </p>

          <h2 className="mt-12 font-display text-3xl font-bold text-ink">If a squishy gets damaged</h2>
          <p className="mt-3 text-lg text-ink-soft">
            Stop using it if it&apos;s torn, punctured, leaking, sticky, oily, discolored, or smells strongly of chemicals. Keep
            the filling away from little ones and pets. If you ever find tiny gel beads (&ldquo;water beads&rdquo;) inside a squishy, keep
            them away from children — they can be dangerous if swallowed. If you bought it from us,{" "}
            <Link href="/order-help" className="font-semibold text-royal underline">let us know</Link>, even if it&apos;s been a while since
            delivery.
          </p>

          <h2 className="mt-12 font-display text-3xl font-bold text-ink">Recalls and safety notices</h2>
          <p className="mt-3 text-lg text-ink-soft">
            If we learn of a recall or safety issue affecting something we sold, we&apos;ll email the buyers using the contact details
            on their orders and post a notice on this page. You can also check the{" "}
            <a href="https://www.cpsc.gov/Recalls" target="_blank" rel="noopener noreferrer" className="font-semibold text-royal underline">
              CPSC recalls list
            </a>{" "}
            and report a product-safety problem to the CPSC at{" "}
            <a href="https://www.saferproducts.gov" target="_blank" rel="noopener noreferrer" className="font-semibold text-royal underline">
              SaferProducts.gov
            </a>
            . If we ever issue a recall, the notice will appear here.
          </p>

          <Notice tone="sky" title="Where this guidance comes from" className="mt-12">
            These tips follow the U.S. Consumer Product Safety Commission&apos;s{" "}
            <a href={CPSC_SQUISHY_ALERT_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-royal underline">
              consumer safety alert about squishy toys
            </a>
            . In an emergency, call 911. For burns, the CPSC advises cooling the skin under cool running water for at least 20
            minutes (no ice), and getting medical care for severe burns or any burn on a young child.
          </Notice>
        </Container>
      </section>
    </PageTransition>
  );
}
