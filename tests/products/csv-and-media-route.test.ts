import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: async () => {} }));

import { parseCsv, recordsToCsv, rowsToProducts, toCsv } from "@/commerce/catalog-admin/csv";
import { toPublicProduct } from "@/commerce/catalog-admin/record";
import { MemoryFileStore } from "@/lib/storage/files";
import { completeRecord } from "./fixtures";

describe("catalog spreadsheet in the dashboard", () => {
  it("reads the repo's template with the same rules as npm run catalog:import", () => {
    const { products, errors } = rowsToProducts(parseCsv(readFileSync("templates/catalog-template.csv", "utf8")));
    expect(errors).toEqual([]);
    expect(products).toHaveLength(1);
    expect(products[0].product).toMatchObject({ slug: "example-squishy", publication: "draft" });
    expect(products[0].product.variants[0]).toMatchObject({ id: "example-squishy-example-sku-001", sku: "EXAMPLE-SKU-001", inventory: { tracked: true, available: null } });
  });

  it("round-trips: export then import gives the same public product", () => {
    const rec = { ...completeRecord(), status: "published" as const };
    const csv = recordsToCsv([rec], { includePrivate: true, supplierName: () => null });
    const back = rowsToProducts(parseCsv(csv));
    expect(back.errors).toEqual([]);
    const original = toPublicProduct(rec);
    const { textures, ...imported } = back.products[0].product;
    expect(textures).toEqual([]); // the spreadsheet importer writes an empty list, like the script; same meaning
    expect({ ...imported, id: original.id, createdAt: original.createdAt, variants: imported.variants.map((v) => ({ ...v, id: original.variants[0].id })) }).toEqual(original);
    expect(back.products[0].private.variants[Object.keys(back.products[0].private.variants)[0]].costCents).toBe(300);
  });

  it("the public-only export has no private columns", () => {
    const csv = recordsToCsv([completeRecord()], { includePrivate: false });
    expect(csv.split("\n")[0]).not.toMatch(/private_/);
    expect(csv).not.toMatch(/test-cpc\.pdf/);
  });

  it("cells a spreadsheet would run as formulas are neutralized", () => {
    expect(toCsv([{ a: "=HYPERLINK(\"http://evil\")", b: "-5", c: "+1 555", d: "@SUM(A1)" }], ["a", "b", "c", "d"])).toBe("a,b,c,d\n\"'=HYPERLINK(\"\"http://evil\"\")\",-5,'+1 555,'@SUM(A1)\n");
  });

  it("reports bad rows instead of importing half a file", () => {
    const r = rowsToProducts(parseCsv("product_slug,variant_sku,fulfillment_source\nx,SKU1,warehouse\n"));
    expect(r.errors[0]).toMatchObject({ line: 2 });
  });
});

/* ------------------------------ public media route ------------------------------ */

const files = new MemoryFileStore();
let released: { media: { src: string; poster?: string }[] }[] | null = null;
vi.mock("@/lib/partners/config", () => ({ deployStorage: () => ({ storage: "memory", storeSuffix: "-dev" }) }));
vi.mock("@/lib/owner/data", () => ({ ownerMediaStore: async () => files }));
vi.mock("@/commerce/catalog-release", () => ({ cachedReleaseProducts: async () => released }));

const LIVE = "0123456789abcdef0123456789abcdef.jpg";
const DRAFT = "fedcba9876543210fedcba9876543210.jpg";

describe("public /media route serves only published files", () => {
  beforeEach(async () => {
    await files.put(`p/${LIVE}`, { bytes: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), contentType: "image/jpeg", meta: {} });
    await files.put(`p/${DRAFT}`, { bytes: new Uint8Array([9, 9, 9]), contentType: "image/jpeg", meta: {} });
    released = [{ media: [{ src: `/media/${LIVE}` }] }];
  });

  const get = async (file: string, headers: Record<string, string> = {}) => {
    const { GET } = await import("@/app/media/[file]/route");
    return GET(new Request(`https://funksquish.com/media/${file}`, { headers }), { params: Promise.resolve({ file }) });
  };

  it("serves a file the published catalog uses, as an image with caching and nosniff", async () => {
    const r = await get(LIVE);
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("image/jpeg");
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
    expect(r.headers.get("cache-control")).toMatch(/public/);
  });

  it("404s for a draft's photo, a removed photo, odd names and path tricks", async () => {
    expect((await get(DRAFT)).status).toBe(404);
    released = [];
    expect((await get(LIVE)).status).toBe(404);
    for (const bad of ["../owner-data.json", "0123456789abcdef0123456789abcdef.svg", "x.jpg", `${LIVE}?x`]) expect((await get(bad)).status, bad).toBe(404);
  });

  it("answers byte ranges (Safari needs them for video)", async () => {
    const r = await get(LIVE, { range: "bytes=2-5" });
    expect(r.status).toBe(206);
    expect(r.headers.get("content-range")).toBe("bytes 2-5/10");
    expect([...new Uint8Array(await r.arrayBuffer())]).toEqual([3, 4, 5, 6]);
    expect((await get(LIVE, { range: "bytes=50-60" })).status).toBe(416);
  });
});
