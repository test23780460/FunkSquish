import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { reviewConfig } from "@/lib/partners/config";
import { ownerAuth } from "@/lib/owner/auth";
import { OwnerShell } from "@/components/owner/OwnerUi";
import { ReviewLogin } from "@/components/partners/ReviewLogin";
import { MfaVerifyForm } from "@/components/owner/SecurityForms";

export const metadata: Metadata = { title: "Two-step sign-in", robots: { index: false, follow: false } };

/** Step 2 of owner sign-in. Shows nothing but the code form; no owner data. */
export default function VerifyPage() {
  if (!reviewConfig()) notFound();
  return (
    <OwnerShell narrow>
      <Verify />
    </OwnerShell>
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
