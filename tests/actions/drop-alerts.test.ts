import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { subscribeToDropAlertsAction } from "@/app/actions/drop-alerts";
import { subscribeWithDoubleOptIn } from "@/lib/newsletter/brevo";

const idle = { status: "idle" as const, message: "" };
const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};

const ENV = {
  BREVO_API_KEY: "test-key-not-real",
  BREVO_LIST_ID: "3",
  BREVO_DOI_TEMPLATE_ID: "1",
  BREVO_DROPS_LIST_ID: "7",
  BREVO_DROPS_DOI_TEMPLATE_ID: "8",
  DROP_ALERTS_ENABLED: "true",
};

describe("drop alert sign-up", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v);
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("refuses to take an address while switched off", async () => {
    vi.stubEnv("DROP_ALERTS_ENABLED", "");
    const r = await subscribeToDropAlertsAction(idle, form({ email: "a@example.com", consent: "yes" }));
    expect(r.status).toBe("error");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses when the separate drops list isn't configured", async () => {
    vi.stubEnv("BREVO_DROPS_LIST_ID", "");
    const r = await subscribeToDropAlertsAction(idle, form({ email: "a@example.com", consent: "yes" }));
    expect(r.status).toBe("error");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("quietly drops bot submissions (honeypot)", async () => {
    const r = await subscribeToDropAlertsAction(idle, form({ email: "a@example.com", consent: "yes", company: "Spam Inc" }));
    expect(r.status).toBe("success");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requires a valid email and consent", async () => {
    expect((await subscribeToDropAlertsAction(idle, form({ email: "nope", consent: "yes" }))).status).toBe("error");
    expect((await subscribeToDropAlertsAction(idle, form({ email: "a@example.com" }))).message).toMatch(/tick the box/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses the drops list and template — never the launch newsletter list", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 201 }));
    const r = await subscribeToDropAlertsAction(idle, form({ email: " A@Example.com ", consent: "yes" }));
    expect(r.status).toBe("success");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual({ email: "a@example.com", includeListIds: [7], templateId: 8, redirectionUrl: "https://funksquish.com/drops/confirmed" });
  });

  it("shows a neutral error if Brevo fails, without logging the address", async () => {
    fetchMock.mockResolvedValue(Response.json({ code: "unauthorized", message: "bad key for a@example.com" }, { status: 401 }));
    const r = await subscribeToDropAlertsAction(idle, form({ email: "a@example.com", consent: "yes" }));
    expect(r.status).toBe("error");
    const logged = vi.mocked(console.error).mock.calls.flat().join(" ");
    expect(logged).toContain("[drop-alerts]");
    expect(logged).not.toContain("a@example.com");
  });

  it("leaves the launch newsletter on its own list (refactor regression)", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    expect(await subscribeWithDoubleOptIn("b@example.com")).toBe("confirmation-sent");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toMatchObject({ includeListIds: [3], templateId: 1, redirectionUrl: "https://funksquish.com/newsletter/confirmed" });
  });
});
