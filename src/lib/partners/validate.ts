import { CONSENT_VERSION, fieldsFor, isPartnerType, type FieldDef, type PartnerType } from "./schema";

/**
 * Strict server-side validation for partner applications (pure; also usable
 * in the browser for instant feedback). Unknown fields are ignored, every
 * value is length-capped, links must be plain public http(s) URLs and
 * choices must come from the published option lists.
 */
export type PartnerFields = Record<string, string | string[]>;

export interface PartnerInput {
  type: PartnerType;
  fields: PartnerFields;
  consentVersion: string;
}

export type ValidationResult = { ok: true; data: PartnerInput } | { ok: false; errors: Record<string, string> };

export const MAX_ENTRIES = 60;
export const MAX_TOTAL_CHARS = 12_000;

const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;
// Control characters (keep tab/newline for multi-line answers).
const CONTROL_RANGES: [number, number][] = [[0x00, 0x08], [0x0b, 0x0c], [0x0e, 0x1f], [0x7f, 0x7f], [0x200b, 0x200f], [0x2028, 0x202e], [0x2066, 0x2069]];
const CONTROL = new RegExp(`[${CONTROL_RANGES.map(([a, b]) => `${String.fromCharCode(a)}-${String.fromCharCode(b)}`).join("")}]`, "g");

function clean(value: string, multiline: boolean) {
  const v = value.replace(CONTROL, "").replace(/\r\n?/g, "\n");
  return (multiline ? v.replace(/\n{3,}/g, "\n\n") : v.replace(/\s+/g, " ")).trim();
}

/** Returns a normalized public http(s) URL, or null. Never fetched by the server. */
export function safeUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value || value.length > 300 || /\s/.test(value)) return null;
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  if (!host.includes(".") || host.endsWith(".")) return null;
  if (/^[\d.]+$/.test(host) || host.includes(":") || host.startsWith("[")) return null; // IP addresses
  if (/(^|\.)(localhost|local|internal|lan|home|test|invalid|example)$/.test(host)) return null;
  return url.toString();
}

function checkField(def: FieldDef, values: string[], errors: Record<string, string>): string | string[] | undefined {
  if (def.kind === "checkboxes") {
    const picked = [...new Set(values.map((v) => clean(v, false)))].filter((v) => def.options?.includes(v));
    if (values.length > (def.options?.length ?? 0) || picked.length !== new Set(values).size) errors[def.name] = "Please choose from the list.";
    if (def.required && picked.length === 0) errors[def.name] = "Please choose at least one.";
    return picked.length ? picked : undefined;
  }

  const raw = values[0] ?? "";
  const value = clean(raw, def.kind === "textarea");
  if (!value) {
    if (def.required) errors[def.name] = "This is required.";
    return undefined;
  }
  if (value.length > def.max) {
    errors[def.name] = `Please keep this under ${def.max} characters.`;
    return undefined;
  }
  switch (def.kind) {
    case "email": {
      const email = value.toLowerCase();
      if (!EMAIL.test(email)) errors[def.name] = "Please enter a valid email address.";
      return email;
    }
    case "url": {
      const url = safeUrl(value);
      if (!url) errors[def.name] = "Please enter a public web link (starting with https://).";
      return url ?? undefined;
    }
    case "select":
      if (!def.options?.includes(value)) errors[def.name] = "Please choose from the list.";
      return value;
    default:
      return value;
  }
}

/** Validates raw form entries (e.g. `[...formData.entries()]`). */
export function validatePartnerEntries(entries: [string, FormDataEntryValue | string][]): ValidationResult {
  if (entries.length > MAX_ENTRIES) return { ok: false, errors: { form: "That form was too large." } };
  if (entries.some(([, v]) => typeof v !== "string")) return { ok: false, errors: { form: "File uploads aren't accepted. Please share links instead." } };
  const strings = entries as [string, string][];
  if (strings.reduce((n, [k, v]) => n + k.length + v.length, 0) > MAX_TOTAL_CHARS) return { ok: false, errors: { form: "That's a bit too much text. Please shorten your answers." } };

  const all = (name: string) => strings.filter(([k]) => k === name).map(([, v]) => v);
  const type = all("type")[0];
  if (!isPartnerType(type)) return { ok: false, errors: { type: "Please choose what kind of partner you are." } };

  const errors: Record<string, string> = {};
  const fields: PartnerFields = {};
  for (const def of fieldsFor(type)) {
    const v = checkField(def, all(def.name), errors);
    if (v !== undefined) fields[def.name] = v;
  }
  if (all("consent")[0] !== "yes") errors.consent = "Please tick the box so we can store your application and reply.";

  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, data: { type, fields, consentVersion: CONSENT_VERSION } };
}
