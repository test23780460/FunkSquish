import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { reviewConfig } from "@/lib/partners/config";
import { ownerAuth } from "@/lib/owner/auth";
import { Container } from "@/components/ui/Primitives";
import { ReviewLogin } from "@/components/partners/ReviewLogin";
import { MfaVerifyForm } from "@/components/owner/SecurityForms";

export const metadata: Metadata = { title: "Two-step sign-in", robots: { index: false, follow: false } };

/** Step 2 of owner sign-in. Shows nothing but the code form; no owner data. */
export default function VerifyPage() {
  if (!reviewConfig()) notFound();
  return (
    <section className="min-h-screen bg-ice-50 pb-24 pt-28 sm:pt-32">
      <Container>
        <Suspense fallback={<p className="text-ink-soft">Loading…</p>}>
          <Verify />
        </Suspense>
      </Container>
    </section>
  );
}

async function Verify() {
  await connection();
  const auth = await ownerAuth();
  if (!auth) return <ReviewLogin />;
  if (auth.status === "full") redirect("/partners/review/today");
  if (auth.status === "needs-enrollment") redirect("/partners/review/security");
  return <MfaVerifyForm />;
}
