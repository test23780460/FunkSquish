import { describe, expect, it } from "vitest";
import { SIGNUP_LIMITS, takeSignup } from "@/lib/newsletter/limits";

/* Documentation-range IPs (RFC 5737); in-memory counters (no storage configured in tests). */
const from = (ip: string) => new Headers({ "x-nf-client-connection-ip": ip });

describe("public email sign-up limits", () => {
  it("one network gets a few sign-ups an hour, then is told to wait", async () => {
    const t = Date.parse("2026-11-02T10:00:00Z");
    const results = [];
    for (let i = 0; i < SIGNUP_LIMITS.perNetworkPerHour + 2; i++) results.push(await takeSignup("newsletter", from("198.51.100.7"), t));
    expect(results.filter(Boolean)).toHaveLength(SIGNUP_LIMITS.perNetworkPerHour);
    expect(await takeSignup("newsletter", from("198.51.100.8"), t)).toBe(true); // another network isn't affected
    expect(await takeSignup("drop-alerts", from("198.51.100.7"), t)).toBe(true); // separate form, separate count
    expect(await takeSignup("newsletter", from("198.51.100.7"), t + 3601_000)).toBe(true); // next hour
  });

  it("caps sign-ups per day per network too", async () => {
    const start = Date.parse("2026-11-03T00:00:00Z");
    let ok = 0;
    for (let h = 0; h < 5; h++) for (let i = 0; i < SIGNUP_LIMITS.perNetworkPerHour; i++) if (await takeSignup("drop-alerts", from("203.0.113.99"), start + h * 3601_000)) ok++;
    expect(ok).toBe(SIGNUP_LIMITS.perNetworkPerDay);
  });
});
