import { describe, expect, it } from "vitest";
import { addBusinessDays, easternDate, federalHolidays, isBusinessDay, isValidDay, shipByFor, shipByState, STANDARD_PROCESSING_BUSINESS_DAYS } from "@/commerce/orders/ship-by";

describe("ship-by dates (Shipping Policy: end of the 2nd business day after the paid order, Eastern Time)", () => {
  it("uses the owner-approved 2 business days", () => {
    expect(STANDARD_PROCESSING_BUSINESS_DAYS).toBe(2);
  });

  it("knows the observed federal holidays", () => {
    const h2026 = federalHolidays(2026);
    for (const d of ["2026-01-01", "2026-01-19", "2026-02-16", "2026-05-25", "2026-06-19", "2026-07-03", "2026-09-07", "2026-10-12", "2026-11-11", "2026-11-26", "2026-12-25"])
      expect(h2026.has(d), d).toBe(true);
    expect(h2026.has("2026-07-04")).toBe(false); // Saturday → observed Friday July 3
    // New Year's Day 2028 is a Saturday: observed Friday Dec 31, 2027.
    expect(federalHolidays(2027).has("2027-12-31")).toBe(true);
    expect(federalHolidays(2027).size).toBe(12); // includes that Dec 31 observance
  });

  it("matches the policy's own example: paid on a Saturday ships by the end of Tuesday", () => {
    // Saturday Nov 7, 2026, 3pm Eastern
    expect(shipByFor(new Date("2026-11-07T20:00:00Z"))).toBe("2026-11-10");
  });

  it("doesn't count the order day, weekends or holidays", () => {
    expect(addBusinessDays("2026-10-26", 2)).toBe("2026-10-28"); // Mon → Wed
    expect(addBusinessDays("2026-11-25", 2)).toBe("2026-11-30"); // Wed before Thanksgiving → Mon (Thu is a holiday; Fri counts)
  });

  it("uses Eastern Time for the order day (late-night orders count as that day)", () => {
    // 11:30pm Eastern on Monday Oct 26 is already Tuesday in UTC.
    const lateMonday = new Date("2026-10-27T03:30:00Z");
    expect(easternDate(lateMonday)).toBe("2026-10-26");
    expect(shipByFor(lateMonday)).toBe("2026-10-28");
  });

  it("flags orders due today and overdue", () => {
    expect(shipByState("2026-10-28", new Date("2026-10-27T15:00:00Z"))).toBe("on-track");
    expect(shipByState("2026-10-28", new Date("2026-10-28T15:00:00Z"))).toBe("due-today");
    expect(shipByState("2026-10-28", new Date("2026-10-29T13:00:00Z"))).toBe("overdue");
  });

  it("validates dates", () => {
    expect(isValidDay("2026-02-28")).toBe(true);
    expect(isValidDay("2026-02-30")).toBe(false);
    expect(isValidDay("tomorrow")).toBe(false);
    expect(isBusinessDay("2026-10-31")).toBe(false); // Saturday
  });
});
