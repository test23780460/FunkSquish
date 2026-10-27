import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";

vi.mock("server-only", () => ({}));
// Selling switched on (external "Buy now" links, as the launch would do), so labels can claim stock.
vi.mock("@/lib/features", () => ({
  features: { commerce: true, checkoutMode: "external-links", newsletter: false, dropAlerts: false, partnerApplications: false, accounts: false },
  purchasingEnabled: true,
}));
const live = { store: null as unknown, connection: vi.fn(async () => {}) };
vi.mock("next/server", async (orig) => ({ ...(await orig<object>()), connection: () => live.connection() }));
vi.mock("@/commerce/orders/store", async (orig) => ({ ...(await orig<object>()), getLiveOrderStore: async () => live.store }));

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryKvStore, type KvStore } from "@/lib/storage/kv-core";
import type { Product } from "@/commerce/types";
import { canPurchase, getAvailability, availabilityLabel } from "@/commerce/availability";
import { MAX_SHOWN_UNITS, applyLiveStock, pendingStock, withLiveStock } from "@/commerce/live-stock";
import { reserveStock, commitStock, type VariantLedger } from "@/commerce/orders/inventory";
import { adjustStock, setPaused } from "@/commerce/orders/stock-admin";
import { productJsonLd } from "@/lib/seo";
import { toProductSummary } from "@/commerce/summary";
import { ProductCard } from "@/components/shop/ProductCard";
import { ProductShowcase } from "@/components/shop/ProductShowcase";

const NOW = new Date("2026-11-03T15:00:00Z");
const nowSec = Math.floor(NOW.getTime() / 1000);

function product(over: Partial<Product> = {}, catalogCount: number | null = 20): Product {
  return {
    id: "p1",
    slug: "berry-jelly",
    name: "Berry Jelly",
    category: "jelly-squishies",
    publication: "published",
    shortDescription: "Short.",
    description: "Long.",
    media: [{ type: "image", src: "/img/berry.jpg", alt: "Berry Jelly" }],
    art: "jelly",
    variants: [
      {
        id: "v-berry",
        sku: "FS-BERRY",
        name: "Berry",
        swatch: "#e0457b",
        palette: { base: "#e0457b", light: "#f7b8cd", shade: "#9e2c55", accent: "#ffffff" },
        price: { amount: 899, currency: "USD" },
        compareAtPrice: null,
        inventory: { tracked: catalogCount !== null, available: catalogCount },
        weightGrams: 80,
        dimensions: null,
        externalPurchaseUrl: "https://shop.tiktok.com/view/product/1",
      },
    ],
    specs: { material: "TPR", fill: "Gel", texture: "Jelly", sizeDescription: "8 cm" },
    safety: { ageGrade: "Ages 3+", warnings: [], careInstructions: [], manufacturerOrImporter: "Example Toys Inc.", countryOfOrigin: "China" },
    tags: [],
    featuredRank: 1,
    createdAt: "2026-10-27",
    ...over,
  } as Product;
}

let store: MemoryKvStore;
beforeEach(() => {
  store = new MemoryKvStore();
  live.store = store;
  live.connection.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

const shown = async (p: Product = product()) => (await applyLiveStock([p], store, nowSec))[0];
const card = (p: Product) => renderToStaticMarkup(createElement(ProductCard, { product: p }));
const page = (p: Product) => renderToStaticMarkup(createElement(ProductShowcase, { product: p, themeSoft: "", header: null }));
const sellTikTok = (quantity: number, catalogOnHand = 20) =>
  adjustStock(store, { variantId: "v-berry", sku: "FS-BERRY", kind: "tiktok-sale", quantity, requestId: randomUUID(), catalogOnHand }, NOW);
const setCount = (quantity: number) => adjustStock(store, { variantId: "v-berry", sku: "FS-BERRY", kind: "count", quantity, requestId: randomUUID(), catalogOnHand: 20 }, NOW);

describe("product pages show the shared TikTok/website stock", () => {
  it("with no changes recorded, the catalog count applies (In stock)", async () => {
    const p = await shown();
    expect(getAvailability(p)).toBe("in-stock");
    expect(card(p)).toContain("In stock");
    expect(card(p)).toContain("Buy now");
  });

  it("TikTok sales recorded by the owner lower the website's stock: 'Only a few left', then 'Sold out'", async () => {
    await sellTikTok(17);
    let p = await shown();
    expect(getAvailability(p)).toBe("low-stock");
    expect(page(p)).toContain("Only a few left");
    await sellTikTok(3);
    p = await shown();
    expect(getAvailability(p)).toBe("sold-out");
    expect(canPurchase(p, p.variants[0])).toBe(false);
    expect(card(p)).toContain("Sold out");
    expect(card(p)).not.toContain("Buy now");
    expect(page(p)).not.toContain("Buy now");
  });

  it("a shelf count of 0 shows Sold out even if the catalog file still says 20", async () => {
    await setCount(0);
    const p = await shown();
    expect(getAvailability(p)).toBe("sold-out");
    expect(productJsonLd(p)?.offers.availability).toBe("https://schema.org/OutOfStock");
  });

  it("a paused item is 'Unavailable' with no buy button and no stock claim for search engines", async () => {
    await setPaused(store, ["v-berry"], true, "TikTok LIVE", "live", NOW);
    const p = await shown();
    expect(getAvailability(p)).toBe("unavailable");
    expect(canPurchase(p, p.variants[0])).toBe(false);
    const html = page(p);
    expect(html).toContain("Unavailable");
    expect(html).toContain("(unavailable)");
    expect(html).not.toContain("Buy now");
    expect(html).not.toMatch(/In stock|Only a few left/);
    expect(card(p)).not.toContain("Buy now");
    expect(productJsonLd(p)).toBeNull();
    expect(toProductSummary(p).availability).toBe("unavailable");
  });

  it("units in shoppers' open checkouts aren't advertised; they come back when the hold expires", async () => {
    await setCount(3);
    expect((await reserveStock(store, "chk-1", [{ variantId: "v-berry", quantity: 3, onHand: 20 }], nowSec + 1800, nowSec)).ok).toBe(true);
    let p = await shown();
    expect(getAvailability(p)).toBe("sold-out");
    p = (await applyLiveStock([product()], store, nowSec + 1801))[0];
    expect(getAvailability(p)).toBe("low-stock");
  });

  it("paid website orders not yet shipped aren't advertised either", async () => {
    await setCount(2);
    await reserveStock(store, "chk-2", [{ variantId: "v-berry", quantity: 2, onHand: 20 }], nowSec + 1800, nowSec);
    await commitStock(store, "chk-2", [{ variantId: "v-berry", quantity: 2, onHand: 20 }], nowSec);
    const p = (await applyLiveStock([product()], store, nowSec + 99_999))[0];
    expect(getAvailability(p)).toBe("sold-out");
  });

  it("if live stock can't be read, nothing is claimed and nothing can be bought", async () => {
    const broken: KvStore = { ...store, durable: true, get: async () => Promise.reject(new Error("timeout")), create: store.create.bind(store), replace: store.replace.bind(store), delete: store.delete.bind(store), list: store.list.bind(store) };
    const p = (await applyLiveStock([product()], broken, nowSec))[0];
    expect(getAvailability(p)).toBe("unavailable");
    expect(canPurchase(p, p.variants[0])).toBe(false);
    expect(card(p)).not.toContain("Buy now");
    expect(productJsonLd(p)).toBeNull();
    expect(JSON.stringify((console.error as unknown as ReturnType<typeof vi.spyOn>).mock.calls)).not.toContain("Berry");
  });

  it("while the live stock loads, pages say 'Checking stock…' and offer no buy button", () => {
    const [p] = pendingStock([product()]);
    expect(getAvailability(p)).toBe("checking");
    expect(availabilityLabel.checking).toBe("Checking stock…");
    expect(card(p)).toContain("Checking stock…");
    expect(card(p)).not.toContain("Buy now");
    expect(page(p)).not.toContain("Buy now");
    expect(productJsonLd(p)).toBeNull();
  });

  it("exact counts never reach the browser, but labels stay exactly the same", async () => {
    for (const count of [0, 1, 2, 3, 4, 5, 20, 500]) {
      await setCount(count);
      const p = await shown();
      expect(p.variants[0].inventory.available).toBeLessThanOrEqual(MAX_SHOWN_UNITS);
      const exact = { ...p, variants: [{ ...p.variants[0], inventory: { tracked: true, available: count } }] };
      expect(getAvailability(p)).toBe(getAvailability(exact));
    }
  });

  it("leaves catalog objects, preview samples and drafts untouched", async () => {
    await setCount(0);
    const base = product();
    const preview = product({ id: "p2", publication: "preview" });
    const [a, b] = await applyLiveStock([base, preview], store, nowSec);
    expect(base.variants[0].inventory).toEqual({ tracked: true, available: 20 });
    expect(a.variants[0].inventory.available).toBe(0);
    expect(b).toBe(preview);
  });

  it("an untracked item the owner never counted claims no stock", async () => {
    const p = await shown(product({}, null));
    expect(getAvailability(p)).toBe("coming-soon");
    expect(card(p)).not.toContain("Buy now");
  });
});

describe("when the live stock is read", () => {
  it("production: from the live store, once per request (never prerendered)", async () => {
    vi.stubEnv("BUILD_CONTEXT", "production");
    await setCount(1);
    const [p] = await withLiveStock([product()]);
    expect(live.connection).toHaveBeenCalledTimes(1);
    expect(getAvailability(p)).toBe("low-stock");
    vi.unstubAllEnvs();
  });

  it("anywhere else real products have no live record: exact counts are still hidden", async () => {
    vi.stubEnv("BUILD_CONTEXT", "deploy-preview");
    const [p] = await withLiveStock([product()]);
    expect(p.variants[0].inventory.available).toBe(MAX_SHOWN_UNITS);
    expect(getAvailability(p)).toBe("in-stock");
    vi.unstubAllEnvs();
  });

  it("the store can't be opened: everything is unavailable", async () => {
    vi.stubEnv("BUILD_CONTEXT", "production");
    live.store = Promise.reject(new Error("no blobs"));
    (live.store as Promise<unknown>).catch(() => {});
    const [p] = await withLiveStock([product()]);
    expect(getAvailability(p)).toBe("unavailable");
    vi.unstubAllEnvs();
  });

  it("the ledger the checkout uses is the one the page reads (same key)", async () => {
    await sellTikTok(1);
    const ledger = (await store.get<VariantLedger>("stock/v-berry"))?.value;
    expect(ledger?.onHand).toBe(19);
  });
});
