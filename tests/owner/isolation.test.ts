import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { deployStorage } from "@/lib/partners/config";

/** Production and preview data never mix: the store name comes from the build's deploy context, nothing a request sends. */
describe("production / preview isolation", () => {
  const env = (o: Record<string, string>) => o as unknown as NodeJS.ProcessEnv;

  it("each deploy context gets its own stores", () => {
    expect(deployStorage(env({ BUILD_CONTEXT: "production" }))).toEqual({ storage: "blobs", storeSuffix: "" });
    expect(deployStorage(env({ BUILD_CONTEXT: "deploy-preview" }))).toEqual({ storage: "blobs", storeSuffix: "-preview" });
    expect(deployStorage(env({ BUILD_CONTEXT: "branch-deploy" }))).toEqual({ storage: "blobs", storeSuffix: "-preview" });
    expect(deployStorage(env({}))).toBeNull(); // a plain local build has no private storage at all
    expect(deployStorage(env({ NODE_ENV: "development", PARTNER_DEV_MEMORY_STORE: "true" }))).toEqual({ storage: "memory", storeSuffix: "-dev" });
    expect(deployStorage(env({ NODE_ENV: "production", PARTNER_DEV_MEMORY_STORE: "true" }))).toBeNull(); // memory store never outside dev
  });

  it("dashboard stores are named with that suffix", () => {
    const src = fs.readFileSync("src/lib/owner/data.ts", "utf8");
    expect(src).toContain("createBlobsKvStore(`owner-data${cfg.storeSuffix}`)");
    expect(src).toContain("createBlobsFileStore(`owner-media${cfg.storeSuffix}`)");
  });

  it("real orders are only ever stored on production", () => {
    const src = fs.readFileSync("src/commerce/orders/store.ts", "utf8");
    expect(src).toMatch(/if \(process\.env\.BUILD_CONTEXT !== "production"\) throw new Error\("Live orders are only stored on production\."\);/);
  });
});
