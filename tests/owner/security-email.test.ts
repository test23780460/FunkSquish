import { afterEach, describe, expect, it, vi } from "vitest";
import { securityEmail, sendSecurityEmail, type SecurityEvent } from "@/lib/owner/security-email";

afterEach(() => vi.unstubAllGlobals());

const ENV = { PARTNER_NOTIFY_EMAIL: "owner@example.com", PARTNER_NOTIFY_FROM: "site@example.com", BREVO_API_KEY: "fake-brevo-key" };

describe("owner security emails", () => {
  it("are sent for setup, turning off, recovery codes, sign-out-everywhere and wrong codes — with no secrets", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    for (const e of ["mfa-on", "mfa-off", "recovery-used", "signed-out-everywhere", "wrong-code"] as SecurityEvent[]) expect(await sendSecurityEmail(e, ENV)).toBe("sent");
    expect(fetchMock).toHaveBeenCalledTimes(5);
    const body = JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(body).toMatchObject({ to: [{ email: "owner@example.com" }], subject: "Security: two-step sign-in was turned on", tags: ["owner-security"] });
    expect(body.htmlContent).toMatch(/If this wasn't you/);
  });

  it("do nothing without email settings, and never throw", async () => {
    expect(await sendSecurityEmail("mfa-on", {})).toBe("not-configured");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network"); }));
    expect(await sendSecurityEmail("mfa-off", ENV)).toBe("failed");
  });

  it("include the time in Eastern Time", () => {
    expect(securityEmail("mfa-on", new Date("2026-10-27T15:00:00Z")).html).toMatch(/Oct 27, 2026, 11:00\s?AM \(Eastern Time\)/);
  });
});
