import { connection } from "next/server";

/**
 * TEMPORARY preview-only diagnostic for Netlify Blobs (remove after debugging).
 * Reports only timings, booleans, key NAMES and error names — never values or tokens.
 */
export async function GET() {
  await connection();
  if (process.env.BUILD_CONTEXT !== "deploy-preview") return new Response("Not found", { status: 404 });

  const out: Record<string, unknown> = {};
  const rawCtx = process.env.NETLIFY_BLOBS_CONTEXT;
  out.hasBlobsContextEnv = !!rawCtx;
  try {
    out.blobsContextKeys = rawCtx ? Object.keys(JSON.parse(Buffer.from(rawCtx, "base64").toString("utf8"))) : null;
  } catch {
    out.blobsContextKeys = "unparseable";
  }
  out.globalContextKeys = Object.keys((globalThis as { netlifyBlobsContext?: object }).netlifyBlobsContext ?? {});
  out.fetchPatched = !!(globalThis.fetch as unknown as { __nextPatched?: boolean }).__nextPatched;

  const { getStore } = await import("@netlify/blobs");
  const timed = async (label: string, fn: () => Promise<unknown>) => {
    const t = Date.now();
    try {
      await Promise.race([fn(), new Promise((_, r) => setTimeout(() => r(new Error("timeout-4s")), 4000))]);
      out[label] = { ok: true, ms: Date.now() - t };
    } catch (e) {
      out[label] = { ok: false, ms: Date.now() - t, error: `${(e as Error).name}: ${String((e as Error).message).slice(0, 160)}` };
    }
  };
  const nativeFetch = (globalThis.fetch as typeof fetch & { _nextOriginalFetch?: typeof fetch })._nextOriginalFetch ?? fetch;

  await timed("eventualGet", () => getStore({ name: "partner-diag-preview" }).get("probe"));
  await timed("strongGet", () => getStore({ name: "partner-diag-preview", consistency: "strong" }).get("probe"));
  await timed("strongGetNativeFetch", () => getStore({ name: "partner-diag-preview", consistency: "strong", fetch: nativeFetch }).get("probe"));
  await timed("list", () => getStore({ name: "partner-diag-preview" }).list());
  await timed("setEventual", () => getStore({ name: "partner-diag-preview" }).set("probe", "1"));

  return Response.json(out, { headers: { "Cache-Control": "no-store" } });
}
