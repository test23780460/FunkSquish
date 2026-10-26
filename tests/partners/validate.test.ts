import { describe, expect, it } from "vitest";
import { safeUrl, validatePartnerEntries } from "@/lib/partners/validate";
import { PARTNER_TYPES, fieldsFor } from "@/lib/partners/schema";
import { goodForm } from "./helpers";

const entries = (f: FormData) => [...f.entries()];

describe("partner form validation", () => {
  it("accepts a complete application and keeps only known fields for that type", () => {
    const f = goodForm({ channels: "my shop", isAdmin: "true", status: "approved" });
    const r = validatePartnerEntries(entries(f));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.type).toBe("manufacturer");
    expect(r.data.fields.email).toBe("pat@squishfactory.example.com");
    expect(r.data.fields).not.toHaveProperty("channels"); // reseller-only field
    expect(r.data.fields).not.toHaveProperty("isAdmin");
    expect(r.data.fields).not.toHaveProperty("status"); // applicants can't set their own stage
    expect(r.data.fields.message).toBe("Hello!\nWe make jelly squishies.");
  });

  it("requires a type, the core fields and consent", () => {
    expect(validatePartnerEntries([["type", "hacker"]])).toEqual({ ok: false, errors: { type: expect.any(String) } });
    const r = validatePartnerEntries(entries(goodForm({ name: "", email: "not-an-email", consent: "no" })));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(Object.keys(r.errors).sort()).toEqual(["consent", "email", "name"]);
  });

  it("rejects unsafe or private links", () => {
    for (const bad of ["javascript:alert(1)", "data:text/html,hi", "ftp://x.com", "http://localhost:3000", "http://127.0.0.1/admin", "http://[::1]/", "https://user:pw@evil.com", "https://intranet", "http://10.0.0.1", "https://printer.local", "https://a b.com"])
      expect(safeUrl(bad), bad).toBeNull();
    expect(safeUrl("squishfactory.co")).toBe("https://squishfactory.co/");
    const r = validatePartnerEntries(entries(goodForm({ website: "javascript:alert(document.cookie)" })));
    expect(!r.ok && r.errors.website).toBeTruthy();
  });

  it("only accepts listed choices", () => {
    const r1 = validatePartnerEntries(entries(goodForm({ samples: "<img src=x onerror=alert(1)>" })));
    expect(!r1.ok && r1.errors.samples).toBeTruthy();
    const r2 = validatePartnerEntries(entries(goodForm({ categories: ["Crunchy squishies", "Free money"] })));
    expect(!r2.ok && r2.errors.categories).toBeTruthy();
  });

  it("enforces length limits, size caps and no files", () => {
    const long = validatePartnerEntries(entries(goodForm({ business: "x".repeat(500) })));
    expect(!long.ok && long.errors.business).toMatch(/under 120/);
    const huge = validatePartnerEntries(entries(goodForm({ message: "x".repeat(20_000) })));
    expect(!huge.ok && huge.errors.form).toBeTruthy();
    const many = goodForm();
    for (let i = 0; i < 120; i++) many.append(`junk${i}`, "x");
    expect(validatePartnerEntries(entries(many)).ok).toBe(false);
    const withFile = goodForm();
    withFile.append("upload", new File(["MZ"], "evil.exe"));
    const r = validatePartnerEntries(entries(withFile));
    expect(!r.ok && r.errors.form).toMatch(/File uploads/);
  });

  it("strips invisible control characters", () => {
    const r = validatePartnerEntries(entries(goodForm({ business: `Squish${String.fromCharCode(0)}${String.fromCharCode(0x202e)} Co` })));
    expect(r.ok && r.data.fields.business).toBe("Squish Co");
  });

  it("every partner type has its own workflow fields plus the shared core", () => {
    for (const t of PARTNER_TYPES) {
      const names = fieldsFor(t.id).map((f) => f.name);
      for (const core of ["name", "email", "business", "website", "country", "message"]) expect(names).toContain(core);
    }
    expect(fieldsFor("dropship").map((f) => f.name)).toContain("customStore");
    expect(fieldsFor("reseller").map((f) => f.name)).toContain("channels");
    expect(fieldsFor("designer").map((f) => f.name)).toContain("portfolio");
    expect(fieldsFor("reseller").map((f) => f.name)).not.toContain("moq");
  });
});
