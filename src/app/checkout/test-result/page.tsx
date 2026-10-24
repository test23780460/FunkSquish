import Link from "next/link";

export const metadata = {
  title: "Stripe test checkout | FunkSquish",
  robots: { index: false, follow: false },
};

export default function TestResult() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-24 text-center">
      <h1 className="font-display text-3xl font-bold">Test checkout return</h1>
      <p className="mt-4 text-ink-soft">
        This page is for Stripe test mode only. A redirect here does not verify
        payment or create a FunkSquish order. Check the signed webhook and
        Stripe test dashboard for the actual test payment status.
      </p>
      <Link href="/shop" className="mt-8 inline-block font-semibold text-royal underline">
        Return to shop preview
      </Link>
    </main>
  );
}
