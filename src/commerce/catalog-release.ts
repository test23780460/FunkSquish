import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { deployStorage } from "@/lib/partners/config";
import { ownerDataStore } from "@/lib/owner/data";
import { validateProducts } from "./validate";
import { currentRelease } from "./catalog-admin/store";
import type { Product } from "./types";

/**
 * The catalog release the owner published from the dashboard (public
 * products only — see src/commerce/catalog-admin/store.ts).
 *
 *  - Pages read a cached copy, refreshed the moment the owner publishes
 *    (updateTag) and at least hourly. If the store can't be read while a page
 *    is being refreshed, the refresh fails and the last good page keeps
 *    being served — the shop never flips back to samples because of an outage.
 *    During a build that can't reach the store, the build-time catalog is used
 *    and re-checked within minutes.
 *  - Checkout reads it fresh every time (never a cached copy) and refuses if
 *    it can't be read.
 *
 * Each deploy context has its own store: production never sees preview data.
 */
export const CATALOG_TAG = "catalog-release";

export async function freshReleaseProducts(): Promise<Product[] | null> {
  const storage = deployStorage();
  if (!storage) return null;
  const release = await currentRelease(await ownerDataStore(storage));
  return release ? validateProducts(release.products) : null;
}

export async function cachedReleaseProducts(): Promise<Product[] | null> {
  "use cache";
  cacheTag(CATALOG_TAG);
  try {
    const products = await freshReleaseProducts();
    cacheLife("hours");
    return products;
  } catch (e) {
    if (process.env.NEXT_PHASE === "phase-production-build") {
      console.warn("[catalog] couldn't read the published catalog during the build; using the build-time catalog and re-checking within minutes");
      cacheLife("minutes");
      return null;
    }
    throw e;
  }
}
