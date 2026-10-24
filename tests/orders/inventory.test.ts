import { describe, expect, it } from "vitest";
import { availableUnits, commitStock, getReservation, releaseStock, reserveStock, type VariantLedger } from "@/commerce/orders/inventory";
import { MemoryKvStore } from "@/commerce/orders/store";

const NOW = 1_800_000_000;
const EXP = NOW + 1860;
const line = (variantId: string, quantity: number, onHand: number) => ({ variantId, quantity, onHand });

async function available(store: MemoryKvStore, variantId: string, onHand: number, now = NOW) {
  const ledger = (await store.get<VariantLedger>(`stock/${variantId}`))?.value ?? null;
  return availableUnits(onHand, ledger, now);
}

describe("stock reservations", () => {
  it("holds stock for a checkout", async () => {
    const store = new MemoryKvStore();
    expect(await reserveStock(store, "c1", [line("a", 2, 5)], EXP, NOW)).toEqual({ ok: true });
    expect(await available(store, "a", 5)).toBe(3);
    expect((await getReservation(store, "c1"))?.status).toBe("held");
  });

  it("refuses to oversell and reports what is left", async () => {
    const store = new MemoryKvStore();
    await reserveStock(store, "c1", [line("a", 4, 5)], EXP, NOW);
    expect(await reserveStock(store, "c2", [line("a", 2, 5)], EXP, NOW)).toEqual({ ok: false, variantId: "a", available: 1 });
  });

  it("is all-or-nothing across several items", async () => {
    const store = new MemoryKvStore();
    await reserveStock(store, "c1", [line("b", 1, 1)], EXP, NOW);
    const r = await reserveStock(store, "c2", [line("a", 2, 5), line("b", 1, 1)], EXP, NOW);
    expect(r).toMatchObject({ ok: false, variantId: "b" });
    expect(await available(store, "a", 5)).toBe(5); // hold on "a" was rolled back
  });

  it("lets only one of many simultaneous shoppers take the last unit", async () => {
    const store = new MemoryKvStore();
    const results = await Promise.all(Array.from({ length: 8 }, (_, i) => reserveStock(store, `c${i}`, [line("last", 1, 1)], EXP, NOW)));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await available(store, "last", 1)).toBe(0);
  });

  it("frees holds automatically once the session has expired", async () => {
    const store = new MemoryKvStore();
    await reserveStock(store, "c1", [line("a", 5, 5)], EXP, NOW);
    expect(await available(store, "a", 5, NOW)).toBe(0);
    expect(await available(store, "a", 5, EXP + 1)).toBe(5);
    expect(await reserveStock(store, "c2", [line("a", 5, 5)], EXP + 3600, EXP + 1)).toEqual({ ok: true });
  });

  it("releases held stock (idempotent)", async () => {
    const store = new MemoryKvStore();
    await reserveStock(store, "c1", [line("a", 2, 5)], EXP, NOW);
    await releaseStock(store, "c1");
    await releaseStock(store, "c1");
    expect(await available(store, "a", 5)).toBe(5);
    expect((await getReservation(store, "c1"))?.status).toBe("released");
  });

  it("commits a sale exactly once, even when called repeatedly or concurrently", async () => {
    const store = new MemoryKvStore();
    await reserveStock(store, "c1", [line("a", 2, 5)], EXP, NOW);
    await Promise.all([commitStock(store, "c1", [line("a", 2, 5)], NOW), commitStock(store, "c1", [line("a", 2, 5)], NOW)]);
    await commitStock(store, "c1", [line("a", 2, 5)], NOW);
    expect(await available(store, "a", 5, EXP + 999)).toBe(3); // sold units never expire
    expect((await getReservation(store, "c1"))?.status).toBe("committed");
  });

  it("never releases stock that has already been sold", async () => {
    const store = new MemoryKvStore();
    await reserveStock(store, "c1", [line("a", 2, 5)], EXP, NOW);
    await commitStock(store, "c1", [line("a", 2, 5)], NOW);
    await releaseStock(store, "c1");
    expect(await available(store, "a", 5)).toBe(3);
  });

  it("flags an oversell if payment arrives after the hold expired and stock ran out", async () => {
    const store = new MemoryKvStore();
    await reserveStock(store, "slow", [line("a", 1, 1)], EXP, NOW);
    await reserveStock(store, "fast", [line("a", 1, 1)], EXP + 4000, EXP + 10); // slow's hold expired
    await commitStock(store, "fast", [line("a", 1, 1)], EXP + 20);
    expect(await commitStock(store, "slow", [line("a", 1, 1)], EXP + 30)).toEqual({ oversold: true });
  });
});
