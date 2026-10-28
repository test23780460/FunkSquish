import "server-only";
import { connection } from "next/server";
import { purchasingEnabled } from "@/lib/features";
import { LOW_STOCK_THRESHOLD } from "./availability";
import { availableUnits, getLedger, type VariantLedger } from "./orders/inventory";
import { getLiveOrderStore, type KvStore } from "./orders/store";
import type { Product, ProductVariant } from "./types";

/**
 * Stock shown to shoppers, from the ONE shared stock record per variant
 * (src/commerce/orders/inventory.ts) — the same record the owner's TikTok
 * sales, restocks and pauses change and website checkouts reserve from:
 *
 *   shown = owner's count (or the catalog count until the owner sets one)
 *           − website orders not yet shipped − units in shoppers' open checkouts
 *
 * - Paused on the website → "Unavailable", no buy button.
 * - Live stock can't be read → "Unavailable", no buy button (never a guess).
 * - Pages render "Checking stock…" first and the live numbers per request, so
 *   a cached page can't advertise stock that has since gone.
 * - Exact counts aren't sent to browsers: at most LOW_STOCK_THRESHOLD + 1, which
 *   gives exactly the same labels ("Only a few left" at 3 or fewer).
 *
 * While selling is switched off (`purchasingEnabled` false, as today) no page
 * can claim stock at all, so nothing is read and pages stay fully static —
 * production behaviour doesn't change until launch.
 *
 * Checkout re-checks the same record when it reserves stock, so a sale made
 * between page load and "Buy" is still refused there.
 */

/** The most units a page ever reveals for one variant. */
export const MAX_SHOWN_UNITS = LOW_STOCK_THRESHOLD + 1;

const showable = (p: Product) => p.publication === "published";

function withInventory(v: ProductVariant, inventory: ProductVariant["inventory"]): ProductVariant {
  return { ...v, inventory };
}

/** Every published variant shows "Checking stock…": what a page renders before the live numbers arrive. */
export function pendingStock(products: Product[]): Product[] {
  return products.map((p) =>
    showable(p) ? { ...p, variants: p.variants.map((v) => withInventory(v, { tracked: true, available: null, status: "checking" })) } : p,
  );
}

type Read = { ok: true; ledger: VariantLedger | null } | { ok: false };

/**
 * Overlay live stock from `store` onto copies of `products` (the catalog
 * objects are never changed). Pure apart from the reads; used by the pages
 * through `withLiveStock` and directly by tests.
 */
export async function applyLiveStock(products: Product[], store: KvStore, nowSec = Math.floor(Date.now() / 1000)): Promise<Product[]> {
  const ids = [...new Set(products.filter(showable).flatMap((p) => p.variants.map((v) => v.id)))];
  const reads = new Map<string, Read>(
    await Promise.all(
      ids.map(async (id): Promise<[string, Read]> => {
        try {
          return [id, { ok: true, ledger: await getLedger(store, id) }];
        } catch {
          return [id, { ok: false }];
        }
      }),
    ),
  );
  const failed = [...reads.values()].filter((r) => !r.ok).length;
  // Counts only — no product or shopper details.
  if (failed) console.error(`[stock] couldn't read live stock for ${failed} of ${ids.length} variant(s); shown as unavailable`);

  return products.map((p) => {
    if (!showable(p)) return p;
    return {
      ...p,
      variants: p.variants.map((v) => {
        const read = reads.get(v.id);
        if (!read?.ok) return withInventory(v, { tracked: true, available: null, status: "unknown" });
        const ledger = read.ledger;
        if (ledger?.paused) return withInventory(v, { tracked: true, available: 0, status: "paused" });
        const catalogCount = v.inventory.tracked ? v.inventory.available : null;
        // No count anywhere (untracked and never counted by the owner): claim nothing.
        if (typeof ledger?.onHand !== "number" && catalogCount === null) return withInventory(v, { tracked: false, available: null });
        const free = availableUnits(catalogCount ?? 0, ledger, nowSec);
        return withInventory(v, { tracked: true, available: Math.min(free, MAX_SHOWN_UNITS) });
      }),
    };
  });
}

/** Hide exact counts when there's no live record to read (e.g. a deploy preview showing real products). */
function capped(products: Product[]): Product[] {
  return products.map((p) =>
    showable(p)
      ? {
          ...p,
          variants: p.variants.map((v) =>
            v.inventory.available === null ? v : withInventory(v, { ...v.inventory, available: Math.min(v.inventory.available, MAX_SHOWN_UNITS) }),
          ),
        }
      : p,
  );
}

/**
 * Where the real shared stock lives: the live order store, on production only.
 * Elsewhere (previews, local dev) real products have no live record.
 */
async function liveStockStore(): Promise<KvStore | null> {
  return process.env.BUILD_CONTEXT === "production" ? getLiveOrderStore() : null;
}

async function readLive(products: Product[]): Promise<Product[]> {
  let store: KvStore | null;
  try {
    store = await liveStockStore();
  } catch {
    console.error("[stock] live stock store unavailable; products shown as unavailable");
    return products.map((p) => (showable(p) ? { ...p, variants: p.variants.map((v) => withInventory(v, { tracked: true, available: null, status: "unknown" as const })) } : p));
  }
  return store ? applyLiveStock(products, store) : capped(products);
}

/**
 * What shopper-facing pages show. Selling off → the catalog unchanged (no
 * stock can be claimed). Selling on → per-request live stock.
 */
export async function withLiveStock(products: Product[]): Promise<Product[]> {
  if (!purchasingEnabled) return products;
  await connection(); // never prerendered or cached: stock is read for each request
  return readLive(products);
}
