import { connection } from "next/server";
import { requireReviewer } from "@/lib/partners/review-auth";
import { appendAudit, ownerDataStore } from "@/lib/owner/data";
import { SHIPPING_ORIGINS } from "@/commerce/origins";
import { exportJson, loadDraft } from "@/commerce/shipping-admin";

/**
 * PRIVATE download: the draft shipping table as shipping-origins.json, ready to
 * replace src/commerce/data/shipping-origins.json. Contains only public
 * fields (no supplier names, costs or private notes).
 */
export async function GET() {
  await connection();
  const ctx = await requireReviewer();
  if (!ctx) return new Response("Not found", { status: 404, headers: { "Cache-Control": "private, no-store" } });
  const data = await ownerDataStore(ctx.cfg);
  const draft = await loadDraft(data, SHIPPING_ORIGINS);
  let body: string;
  try {
    body = exportJson(draft);
  } catch (e) {
    return new Response(`The draft isn't valid: ${(e as Error).message}`, { status: 422, headers: { "Cache-Control": "private, no-store", "Content-Type": "text/plain; charset=utf-8" } });
  }
  await appendAudit(data, { area: "shipping", action: "export", target: null, summary: "Downloaded the shipping table file to apply" });
  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="shipping-origins.json"',
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
