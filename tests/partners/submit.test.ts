import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { handleSubmission } from "@/lib/partners/submit";
import { issueFormToken } from "@/lib/partners/security";
import { listApplications, partnerStores, updateApplication, withStatus, deleteApplication, getApplication, pastRetention } from "@/lib/partners/store";
import { notificationEmail } from "@/lib/partners/notify";
import { config, goodForm, resetMemoryStores } from "./helpers";

const T0 = 1_800_000_000_000;
const later = T0 + 30_000;
const ipHeaders = (ip = "198.51.100.7") => new Headers({ "x-nf-client-connection-ip": ip });

function signed(overrides: Record<string, string | string[]> = {}) {
  const f = goodForm(overrides);
  f.set("token", issueFormToken(config.secret, T0));
  return f;
}

describe("partner application submission", () => {
  const fetchMock = vi.fn();
  let logs: string[];

  beforeEach(() => {
    resetMemoryStores();
    fetchMock.mockReset().mockResolvedValue(Response.json({ messageId: "x" }, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    logs = [];
    for (const level of ["info", "warn", "error", "log"] as const) vi.spyOn(console, level).mockImplementation((...a) => void logs.push(a.join(" ")));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("stores a valid application privately and notifies the owner without contact details", async () => {
    const r = await handleSubmission(config, signed(), ipHeaders(), later);
    expect(r).toEqual({ status: "success", reference: expect.stringMatching(/^FS-P-\d{8}-[A-Z2-9]{8}$/) });
    const apps = await listApplications((await partnerStores(config)).apps);
    expect(apps).toHaveLength(1);
    expect(apps[0]).toMatchObject({ status: "new", type: "manufacturer", notification: { status: "sent" }, consent: { version: expect.any(String) } });
    expect(apps[0].audit.ipHash).not.toContain("198.51");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    const body = JSON.parse(init.body);
    expect(body.to).toEqual([{ email: "owner@example.com" }]);
    expect(JSON.stringify(body)).not.toContain("pat@squishfactory");
    expect(JSON.stringify(body)).not.toContain("Pat Example");
    expect(JSON.stringify(body)).not.toContain("MOQ 300");
    expect(body.htmlContent).toContain(`/partners/review/${apps[0].id}`);
    // never touches Brevo contact lists
    expect(fetchMock.mock.calls.every(([u]) => !String(u).includes("/contacts"))).toBe(true);
  });

  it("logs no names, emails or answers", async () => {
    await handleSubmission(config, signed(), ipHeaders(), later);
    const all = logs.join("\n");
    for (const secret of ["Pat Example", "pat@", "Squish Factory", "MOQ", "198.51.100.7", "fake-brevo-key"]) expect(all).not.toContain(secret);
    expect(all).toMatch(/\[partners\] stored FS-P-/);
  });

  it("still saves the application when the notification fails, and records why", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ code: "unauthorized" }, { status: 401 }));
    const r = await handleSubmission(config, signed(), ipHeaders(), later);
    expect(r.status).toBe("success");
    const [app] = await listApplications((await partnerStores(config)).apps);
    expect(app.notification).toMatchObject({ status: "failed", code: "brevo-401-unauthorized" });
  });

  it("handles a network timeout from the email provider", async () => {
    fetchMock.mockRejectedValueOnce(Object.assign(new Error("t"), { name: "TimeoutError" }));
    await handleSubmission(config, signed(), ipHeaders(), later);
    const [app] = await listApplications((await partnerStores(config)).apps);
    expect(app.notification.code).toBe("timeout");
  });

  it("quietly ignores bots: honeypot, instant posts, missing or forged tokens", async () => {
    const hp = signed({ fax_number: "555-0100" });
    expect(await handleSubmission(config, hp, ipHeaders(), later)).toEqual({ status: "success", reference: null });
    expect((await handleSubmission(config, signed(), ipHeaders(), T0 + 1000)).status).toBe("error");
    const noToken = goodForm();
    expect((await handleSubmission(config, noToken, ipHeaders(), later)).status).toBe("error");
    const forged = goodForm();
    forged.set("token", issueFormToken("attacker-secret-xxxxxxxxxxxxxxxxxxxxxxxx", T0));
    expect((await handleSubmission(config, forged, ipHeaders(), later)).status).toBe("error");
    expect(await listApplications((await partnerStores(config)).apps)).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns field errors without storing anything", async () => {
    const r = await handleSubmission(config, signed({ email: "bad", website: "http://localhost" }), ipHeaders(), later);
    expect(r).toMatchObject({ status: "error", errors: { email: expect.any(String), website: expect.any(String) } });
    expect(await listApplications((await partnerStores(config)).apps)).toHaveLength(0);
  });

  it("rate-limits per IP and per email address", async () => {
    for (let i = 0; i < 5; i++) {
      const r = await handleSubmission(config, signed({ email: `p${i}@squishfactory.example.com` }), ipHeaders(), later);
      expect(r.status).toBe("success");
    }
    expect((await handleSubmission(config, signed({ email: "p9@squishfactory.example.com" }), ipHeaders(), later)).status).toBe("error");
    // same email from other IPs: 3 per day
    resetMemoryStores();
    for (let i = 0; i < 3; i++) expect((await handleSubmission(config, signed(), ipHeaders(`203.0.113.${i}`), later)).status).toBe("success");
    expect((await handleSubmission(config, signed(), ipHeaders("203.0.113.99"), later)).status).toBe("error");
  });

  it("tells the applicant to email instead when storage fails", async () => {
    const stores = await partnerStores(config);
    vi.spyOn(stores.apps, "create").mockRejectedValue(new Error("blobs down"));
    const r = await handleSubmission(config, signed(), ipHeaders(), later);
    expect(r).toMatchObject({ status: "error", message: expect.stringContaining("email") });
    expect(logs.join(" ")).toContain("[partners] storage error");
  });
});

describe("review workflow store helpers", () => {
  beforeEach(() => {
    resetMemoryStores();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 201 })));
    vi.spyOn(console, "info").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("moves through stages with history and private notes, and deletes on request", async () => {
    const r = await handleSubmission(config, signed(), ipHeaders(), later);
    const id = r.status === "success" ? r.reference! : "";
    const { apps } = await partnerStores(config);
    await updateApplication(apps, id, (a) => withStatus(a, "under-review", "Looks promising"));
    await updateApplication(apps, id, (a) => withStatus(a, "approved"));
    const app = (await getApplication(apps, id))!;
    expect(app.status).toBe("approved");
    expect(app.history.map((h) => h.to)).toEqual(["new", "under-review", "approved"]);
    expect(app.notes.map((n) => n.text)).toEqual(["Looks promising"]);
    expect(await getApplication(apps, "../../etc/passwd")).toBeNull();
    await deleteApplication(apps, id);
    expect(await getApplication(apps, id)).toBeNull();
  });

  it("flags applications past the proposed retention period", () => {
    const old = { updatedAt: "2020-01-01T00:00:00Z" } as Parameters<typeof pastRetention>[0];
    expect(pastRetention(old, new Date("2026-10-25"))).toBe(true);
  });

  it("escapes applicant text in the owner email", () => {
    const { html, subject } = notificationEmail(
      { id: "FS-P-20261025-ABCDEFGH", type: "brand", fields: { business: '<script>alert("x")</script>', country: "US" } } as never,
      "https://funksquish.com/partners/review/FS-P-20261025-ABCDEFGH",
    );
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(subject).toBe("New partner application FS-P-20261025-ABCDEFGH (Brand)");
  });
});
