/**
 * Ship-by dates for the Shipping Policy's promise (and the FTC Mail Order
 * Rule, 16 CFR 435.2): items from our own stock ship "by the end of the second
 * business day after the day we receive your paid order". Business days are
 * Monday–Friday excluding U.S. federal holidays (5 U.S.C. 6103, with the
 * Saturday→Friday / Sunday→Monday observance rule), counted in Eastern Time.
 *
 * Pure date arithmetic on "YYYY-MM-DD" strings (no time zones inside the
 * math), so it's easy to test and can't drift with the server's clock zone.
 */
export const SHIP_TIME_ZONE = "America/New_York";
/** Owner decision S1 (Shipping Policy). Must match the policy text. */
export const STANDARD_PROCESSING_BUSINESS_DAYS = 2;

const ymd = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const toUtc = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const fromUtc = (d: Date) => ymd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
const dow = (s: string) => toUtc(s).getUTCDay(); // 0 Sun … 6 Sat

/** nth weekday (0=Sun) of a month; n = -1 means the last one. */
function nthWeekday(year: number, month: number, weekday: number, n: number): string {
  if (n > 0) {
    const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
    return ymd(year, month, 1 + ((weekday - first + 7) % 7) + (n - 1) * 7);
  }
  const lastDay = new Date(Date.UTC(year, month, 0));
  const back = (lastDay.getUTCDay() - weekday + 7) % 7;
  return ymd(year, month, lastDay.getUTCDate() - back);
}

function observed(s: string): string {
  const d = dow(s);
  const t = toUtc(s);
  if (d === 6) t.setUTCDate(t.getUTCDate() - 1);
  if (d === 0) t.setUTCDate(t.getUTCDate() + 1);
  return fromUtc(t);
}

/** Observed U.S. federal holidays falling in `year` (includes Jan 1 of next year observed on Dec 31). */
export function federalHolidays(year: number): Set<string> {
  const days = [year, year + 1].flatMap((y) => [
    observed(ymd(y, 1, 1)), // New Year's Day
    nthWeekday(y, 1, 1, 3), // Birthday of Martin Luther King, Jr.
    nthWeekday(y, 2, 1, 3), // Washington's Birthday
    nthWeekday(y, 5, 1, -1), // Memorial Day
    observed(ymd(y, 6, 19)), // Juneteenth
    observed(ymd(y, 7, 4)), // Independence Day
    nthWeekday(y, 9, 1, 1), // Labor Day
    nthWeekday(y, 10, 1, 2), // Columbus Day
    observed(ymd(y, 11, 11)), // Veterans Day
    nthWeekday(y, 11, 4, 4), // Thanksgiving Day
    observed(ymd(y, 12, 25)), // Christmas Day
  ]);
  return new Set(days.filter((d) => d.startsWith(`${year}-`)));
}

export function isBusinessDay(day: string): boolean {
  const d = dow(day);
  return d !== 0 && d !== 6 && !federalHolidays(Number(day.slice(0, 4))).has(day);
}

/** Calendar date of an instant in Eastern Time. */
export function easternDate(at: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: SHIP_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** The n-th business day after `day` (the day itself never counts). */
export function addBusinessDays(day: string, n: number): string {
  const t = toUtc(day);
  let left = n;
  while (left > 0) {
    t.setUTCDate(t.getUTCDate() + 1);
    if (isBusinessDay(fromUtc(t))) left--;
  }
  return fromUtc(t);
}

export function addCalendarDays(day: string, n: number): string {
  const t = toUtc(day);
  t.setUTCDate(t.getUTCDate() + n);
  return fromUtc(t);
}

/** Ship-by date for a paid order received at `paidAt`. */
export function shipByFor(paidAt: Date, businessDays = STANDARD_PROCESSING_BUSINESS_DAYS): string {
  return addBusinessDays(easternDate(paidAt), businessDays);
}

export type ShipByState = "on-track" | "due-today" | "overdue";

/** Compares the ship-by date with today's date in Eastern Time. */
export function shipByState(shipBy: string, now: Date): ShipByState {
  const today = easternDate(now);
  if (today < shipBy) return "on-track";
  return today === shipBy ? "due-today" : "overdue";
}

export const isValidDay = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && fromUtc(toUtc(s)) === s;
