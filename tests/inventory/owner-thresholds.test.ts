import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { BOTH_CHANNELS_WARNING_UNITS, LOW_STOCK_WARNING_UNITS, stockRow, type StockItem } from "@/commerce/orders/stock-admin";
import { LOW_STOCK_THRESHOLD } from "@/commerce/availability";
import { SIGNATURE_POLICY, signatureRecommended } from "@/commerce/signature";

/** Owner decisions confirmed 2026-10-27: keep these exactly as they are. */
const NOW = new Date("2026-11-03T15:00:00Z");
const item: StockItem = {
  variantId: "v1",
  productId: "p1",
  sku: "FS-1",
  productName: "Berry Jelly",
  variantName: "Berry",
  published: true,
  websiteSellable: true,
  supplier: false,
};
const codes = (free: number, tiktok = false) =>
  stockRow(item, { variantId: "v1", entries: {}, onHand: free, lastCountedAt: NOW.toISOString(), tiktokListed: tiktok }, null, { now: NOW }).warnings.map((w) => w.code);

describe("owner low-stock warning stays at 5 units (D-INV-1)", () => {
  it("is 5 for both the low warning and the 'on both channels' warning", () => {
    expect(LOW_STOCK_WARNING_UNITS).toBe(5);
    expect(BOTH_CHANNELS_WARNING_UNITS).toBe(5);
  });

  it("warns at 5 or fewer, not at 6", () => {
    expect(codes(5)).toContain("low");
    expect(codes(1)).toContain("low");
    expect(codes(6)).not.toContain("low");
    expect(codes(0)).toEqual(["sold-out"]);
  });

  it("tells the owner to pause on the website when a TikTok-listed item is down to 5", () => {
    expect(codes(5, true)).toContain("both-channels-low");
    expect(codes(6, true)).not.toContain("both-channels-low");
  });

  it("is separate from the public 'Only a few left' label (unchanged at 3)", () => {
    expect(LOW_STOCK_THRESHOLD).toBe(3);
  });
});

describe("$150 signature confirmation stays advisory only (D-OPS-2b)", () => {
  it("is recommended to the owner at $150, never charged to customers or advertised", () => {
    expect(SIGNATURE_POLICY).toEqual({ recommendAtOrAboveCents: 150_00, chargeCustomer: false, advertised: false });
    expect(signatureRecommended(149_99)).toBe(false);
    expect(signatureRecommended(150_00)).toBe(true);
  });
});
