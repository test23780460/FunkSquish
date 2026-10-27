import type { KvStore } from "./store";
import { KIND_LABEL, type InventoryAdjustment } from "./stock-admin";

/**
 * Inventory history as a CSV file for the owner (decision D-INV-2: export, yes;
 * automatic deletion, NOT until the record-keeping period is confirmed —
 * Q-RET-1. Nothing here or anywhere else deletes stock history.)
 *
 * The file holds stock changes only: product, SKU, what happened, how many,
 * shelf count before/after, who recorded it (owner / owner during a LIVE /
 * website), order reference, the owner's note. No customer names, emails,
 * addresses or payment details.
 */

/** Longest period one file can cover; longer periods are downloaded in parts (keeps each download quick). */
export const MAX_EXPORT_DAYS = 92;
/** Safety cap on rows in one file. */
export const MAX_EXPORT_ROWS = 25_000;
export const DEFAULT_EXPORT_DAYS = 30;

const DAY_MS = 86_400_000;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TZ = "America/New_York";

/** Calendar date in Eastern Time (the owner's day), YYYY-MM-DD. */
export function easternDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

function validDate(s: string): boolean {
  if (!DATE.test(s)) return false;
  const t = Date.parse(`${s}T00:00:00Z`);
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === s;
}

export type ExportRange = { ok: true; from: string; to: string } | { ok: false; error: string };

/** Dates are Eastern Time calendar days, inclusive. Missing = the last 30 days. */
export function parseExportRange(fromRaw: string | null, toRaw: string | null, now = new Date()): ExportRange {
  const today = easternDate(now);
  const to = toRaw?.trim() || today;
  const from = fromRaw?.trim() || easternDate(new Date(Date.parse(`${to}T12:00:00Z`) - (DEFAULT_EXPORT_DAYS - 1) * DAY_MS));
  if (!validDate(from) || !validDate(to)) return { ok: false, error: "Use dates like 2026-11-03." };
  if (from > to) return { ok: false, error: "The start date is after the end date." };
  const days = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS) + 1;
  if (days > MAX_EXPORT_DAYS) return { ok: false, error: `Choose ${MAX_EXPORT_DAYS} days or fewer per file (download longer periods in parts).` };
  return { ok: true, from, to };
}

/**
 * A cell that a spreadsheet could run as a formula (=, +, -, @, tab, return)
 * is prefixed with an apostrophe. Owner notes and names are text, so this never
 * changes a number we wrote ourselves (those are written as plain numbers).
 */
export function csvText(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

const csvNumber = (n: number) => (Number.isFinite(n) ? String(n) : "");

const RECORDED_BY = { owner: "Owner", live: "Owner (TikTok LIVE)", website: "Website" } as const;

export const EXPORT_COLUMNS = [
  "Date (Eastern)",
  "Time (Eastern)",
  "Timestamp (UTC)",
  "Product",
  "Variant",
  "SKU",
  "What happened",
  "Change",
  "Shelf before",
  "Shelf after",
  "Recorded by",
  "Order",
  "Note",
  "Undone",
  "Undoes",
  "Change ID",
  "Variant ID",
] as const;

export function toCsv(rows: InventoryAdjustment[], names: Map<string, { product: string; variant: string }>): string {
  const time = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const lines = [EXPORT_COLUMNS.map(csvText).join(",")];
  // The log is append-only: an undo is its own row pointing back at the change it reversed.
  const undone = new Set(rows.flatMap((a) => (a.undoes ? [a.undoes] : [])));
  for (const a of rows) {
    const at = new Date(a.at);
    const name = names.get(a.variantId);
    lines.push(
      [
        csvText(easternDate(at)),
        csvText(time.format(at)),
        csvText(a.at),
        csvText(name?.product ?? ""),
        csvText(name?.variant ?? ""),
        csvText(a.sku),
        csvText(KIND_LABEL[a.kind] ?? a.kind),
        csvNumber(a.delta),
        csvNumber(a.onHandBefore),
        csvNumber(a.onHandAfter),
        csvText(RECORDED_BY[a.source] ?? a.source),
        csvText(a.orderId ?? ""),
        csvText(a.note ?? ""),
        csvText(a.undoneBy || undone.has(a.id) ? "yes" : ""),
        csvText(a.undoes ?? ""),
        csvText(a.id),
        csvText(a.variantId),
      ].join(","),
    );
  }
  // BOM so Excel opens it as UTF-8; CRLF line endings per RFC 4180.
  return `﻿${lines.join("\r\n")}\r\n`;
}

export type ExportResult = { ok: true; rows: InventoryAdjustment[] } | { ok: false; error: string };

/** Every logged stock change whose Eastern date is within [from, to], oldest first. */
export async function loadHistory(store: KvStore, from: string, to: string): Promise<ExportResult> {
  // The log is keyed by UTC day; an Eastern day spans two UTC days.
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`) + DAY_MS;
  const utcDays: string[] = [];
  for (let t = start; t <= end; t += DAY_MS) utcDays.push(new Date(t).toISOString().slice(0, 10));

  const keys: string[] = [];
  for (let i = 0; i < utcDays.length; i += 10) {
    const batch = await Promise.all(utcDays.slice(i, i + 10).map((d) => store.list(`invlog/${d}/`)));
    keys.push(...batch.flat());
    if (keys.length > MAX_EXPORT_ROWS * 2) return { ok: false, error: "Too many changes for one file. Choose a shorter period." };
  }
  keys.sort();

  const rows: InventoryAdjustment[] = [];
  const read = (k: string) => (store.getListed ? store.getListed<InventoryAdjustment>(k) : store.get<InventoryAdjustment>(k));
  for (let i = 0; i < keys.length; i += 25) {
    const batch = await Promise.all(keys.slice(i, i + 25).map(read));
    for (const r of batch) {
      if (!r) continue;
      const day = easternDate(new Date(r.value.at));
      if (day >= from && day <= to) rows.push(r.value);
    }
  }
  if (rows.length > MAX_EXPORT_ROWS) return { ok: false, error: "Too many changes for one file. Choose a shorter period." };
  return { ok: true, rows };
}
