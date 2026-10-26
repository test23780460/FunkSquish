import { describe, expect, it } from "vitest";
import { validatePartnerEntries, MAX_TOTAL_CHARS } from "@/lib/partners/validate";
import { FIELD_GROUPS, PARTNER_FIELDS, PARTNER_TYPES, RESELLER_ACK, fieldsFor, type PartnerType } from "@/lib/partners/schema";
import { screeningFlags } from "@/lib/partners/screening";
import { goodForm } from "./helpers";

const entries = (f: FormData) => [...f.entries()];
const names = (t: PartnerType) => fieldsFor(t).map((f) => f.name);

/** A realistic, fully filled-in application of the given type (every question answered). */
function fullForm(type: PartnerType) {
  const f = new FormData();
  f.append("type", type);
  f.append("consent", "yes");
  for (const def of fieldsFor(type)) {
    if (def.kind === "checkboxes" || def.kind === "select") {
      const opts = (def.options ?? []).filter((o) => o !== def.exclusive);
      for (const o of def.kind === "select" ? opts.slice(0, 1) : opts) f.append(def.name, o);
    } else if (def.kind === "email") f.append(def.name, "sales@supplier.example.co");
    else if (def.kind === "url") f.append(def.name, "https://supplier.co/catalog");
    else f.append(def.name, "A realistic answer. ".repeat(def.kind === "textarea" ? 20 : 3).slice(0, def.max).trim());
  }
  return f;
}

describe("partner questions", () => {
  it("shows every question in exactly one form section", () => {
    const grouped = FIELD_GROUPS.flatMap((g) => g.fields);
    expect(new Set(grouped).size).toBe(grouped.length);
    expect([...grouped].sort()).toEqual(PARTNER_FIELDS.map((f) => f.name).sort());
  });

  it("asks wholesale suppliers for SKU pricing, MOQs, mixed cases, samples, shipping and turnaround", () => {
    for (const n of ["skuPricing", "moq", "mixedCase", "samples", "sampleCost", "shippingEstimate", "usShipping", "turnaround"]) expect(names("wholesale-supplier")).toContain(n);
  });

  it("asks dropshippers about fees, ordering, custom stores, stock, blind shipping, tracking and returns", () => {
    for (const n of ["subscriptionFee", "perOrderFee", "orderMethods", "customStore", "inventorySync", "blindShipping", "tracking", "returnsRefunds"]) expect(names("dropship")).toContain(n);
    const methods = PARTNER_FIELDS.find((f) => f.name === "orderMethods")?.options ?? [];
    expect(methods.join(" ")).toMatch(/Manual/);
    expect(methods).toContain("CSV upload");
    expect(methods).toContain("API");
  });

  it("requires the key safety answers from anyone supplying products", () => {
    for (const t of ["manufacturer", "wholesale-supplier", "dropship"] as const) {
      for (const n of ["materials", "fillingDetail", "waterBeads", "recalls", "recallDetail", "cpc", "testing"]) expect(names(t)).toContain(n);
      const required = fieldsFor(t).filter((f) => f.required).map((f) => f.name);
      expect(required).toEqual(expect.arrayContaining(["waterBeads", "recalls", "cpc", "authorizedChannels"]));
    }
    const r = validatePartnerEntries(entries(goodForm({ waterBeads: "", recalls: "", cpc: "" })));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["cpc", "recalls", "waterBeads"]);
    // Brands and designers don't supply physical products, so no safety questions.
    expect(names("brand")).not.toContain("waterBeads");
  });

  it("asks which sales channels are authorized, including the website, TikTok Shop and TikTok LIVE", () => {
    const def = PARTNER_FIELDS.find((f) => f.name === "authorizedChannels");
    expect(def?.options).toEqual(expect.arrayContaining(["FunkSquish website (funksquish.com)", "TikTok Shop", "TikTok LIVE selling"]));
    for (const t of ["manufacturer", "wholesale-supplier", "dropship", "brand", "designer"] as const) expect(names(t)).toContain("authorizedChannels");
    const missing = validatePartnerEntries(entries(goodForm({ authorizedChannels: [] })));
    expect(!missing.ok && missing.errors.authorizedChannels).toBeTruthy();
    const ok = validatePartnerEntries(entries(goodForm()));
    expect(ok.ok && ok.data.fields.authorizedChannels).toEqual(["FunkSquish website (funksquish.com)", "TikTok Shop", "TikTok LIVE selling"]);
  });

  it("treats resellers as future interest only, with an explicit acknowledgement", () => {
    expect(PARTNER_TYPES.find((t) => t.id === "reseller")?.blurb).toMatch(/don't have a wholesale program yet/);
    const reseller = names("reseller");
    expect(reseller).toContain("interestAck");
    for (const n of ["skuPricing", "waterBeads", "authorizedChannels", "moq"]) expect(reseller).not.toContain(n);
    const base = { type: "reseller", categories: [], skuPricing: "", waterBeads: "", recalls: "", cpc: "", testing: [], authorizedChannels: [], moq: "", samples: "" };
    const noAck = validatePartnerEntries(entries(goodForm(base)));
    expect(!noAck.ok && noAck.errors.interestAck).toMatch(/tick this box/);
    const forgedAck = validatePartnerEntries(entries(goodForm({ ...base, interestAck: "I am approved" })));
    expect(forgedAck.ok).toBe(false);
    const withAck = validatePartnerEntries(entries(goodForm({ ...base, interestAck: RESELLER_ACK, channels: "Gift shop" })));
    expect(withAck.ok).toBe(true);
  });

  it("won't combine 'None yet' with real lab reports", () => {
    const r = validatePartnerEntries(entries(goodForm({ testing: ["None yet", "Phthalates"] })));
    expect(!r.ok && r.errors.testing).toMatch(/can't be combined/);
  });

  it("accepts a fully answered application of every type within the size limits", () => {
    for (const t of PARTNER_TYPES) {
      const f = fullForm(t.id);
      const size = [...f.entries()].reduce((n, [k, v]) => n + k.length + String(v).length, 0);
      expect(size, t.id).toBeLessThan(MAX_TOTAL_CHARS);
      const r = validatePartnerEntries(entries(f));
      expect(r.ok ? "ok" : JSON.stringify(r.errors), t.id).toBe("ok");
    }
  });
});

describe("safety screening flags", () => {
  const supplier = (over: Record<string, string | string[]>) => ({
    waterBeads: "No — none of our products do",
    recalls: "No",
    cpc: "Yes — for every product",
    testing: ["ASTM F963 (U.S. toy safety)"],
    materials: ["TPR / jelly"],
    ...over,
  });

  it("raises nothing for a clean supplier, and nothing for brands or resellers", () => {
    expect(screeningFlags("manufacturer", supplier({}))).toEqual([]);
    expect(screeningFlags("brand", {})).toEqual([]);
    expect(screeningFlags("reseller", {})).toEqual([]);
  });

  it("flags water beads, recalls, missing CPCs and missing lab reports", () => {
    const loose = screeningFlags("wholesale-supplier", supplier({ waterBeads: "Yes — loose, or they could come loose" }));
    expect(loose[0]).toMatchObject({ level: "serious" });
    expect(screeningFlags("dropship", supplier({ recalls: "Yes" }))[0]).toMatchObject({ level: "serious" });
    expect(screeningFlags("manufacturer", supplier({ cpc: "Not yet" })).map((f) => f.text).join()).toMatch(/Children's Product Certificate/);
    expect(screeningFlags("manufacturer", supplier({ testing: ["None yet"] })).map((f) => f.text).join()).toMatch(/lab reports/);
    expect(screeningFlags("manufacturer", supplier({ materials: ["Water beads"] })).map((f) => f.text).join()).toMatch(/Ask which is right/);
  });
});
