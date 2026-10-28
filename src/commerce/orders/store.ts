/**
 * Order, stock-hold and webhook-dedup storage.
 *
 * Uses the shared store in src/lib/storage/kv-core.ts (the same one partner
 * applications use), which adds what this module's earlier copy lacked:
 * a 5-second limit on every Netlify Blobs call and an existence check before
 * reads (reads of missing keys can hang on Netlify).
 *  - Netlify Blobs on deploy previews (test) and, later, production (live):
 *    durable, private to the site, separate store names per mode.
 *  - In-memory under `next dev` and in tests: NOT durable.
 *
 * Conditional writes ("create only if new", "replace only if unchanged") are
 * what make duplicate webhook deliveries and concurrent checkouts safe.
 */
import { MemoryKvStore, createBlobsKvStore, type KvStore } from "../../lib/storage/kv-core";

export { ConflictError, MemoryKvStore, updateWithRetry, type KvStore, type Versioned } from "../../lib/storage/kv-core";

export type OrderStoreMode = "test" | "live";

/** Netlify Blobs store names. Test and live data never share a store. */
export const ORDER_STORE_NAMES: Record<OrderStoreMode, string> = {
  test: "stripe-test-orders",
  live: "stripe-live-orders",
};

// One in-memory store per server process. A module-level variable isn't enough:
// Next.js dev loads route handlers and pages as separate module copies, so the
// webhook and the result page would otherwise see different stores.
const globalStore = globalThis as { __funksquishTestOrderStore?: MemoryKvStore };

/**
 * The store used by the Stripe TEST integration. Netlify Blobs on deploy
 * previews (Netlify injects credentials); in-memory under `next dev`.
 */
export async function getTestOrderStore(): Promise<KvStore> {
  // BUILD_CONTEXT is frozen at build time (next.config.ts); runtime-only Netlify vars aren't reliable.
  if (process.env.BUILD_CONTEXT === "deploy-preview") return createBlobsKvStore(ORDER_STORE_NAMES.test);
  globalStore.__funksquishTestOrderStore ??= new MemoryKvStore();
  return globalStore.__funksquishTestOrderStore;
}

/** The store for LIVE orders. Only ever used on production; anywhere else this refuses. */
export async function getLiveOrderStore(): Promise<KvStore> {
  if (process.env.BUILD_CONTEXT !== "production") throw new Error("Live orders are only stored on production.");
  return createBlobsKvStore(ORDER_STORE_NAMES.live);
}
