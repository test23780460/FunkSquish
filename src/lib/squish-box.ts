/**
 * Build Your Squish Box — pure state helpers.
 *
 * A box is a draft kept in the visitor's browser: a size, a ribbon color, an
 * optional name and a list of variant ids. No prices, discounts or orders —
 * those only exist once real products and prices are confirmed.
 */
export const BOX_SIZES = [
  { id: "mini", slots: 3, name: "Mini box", note: "A tiny trio" },
  { id: "classic", slots: 5, name: "Classic box", note: "Our favorite size" },
  { id: "mega", slots: 8, name: "Mega box", note: "For serious squishers" },
] as const;

export type BoxSizeId = (typeof BOX_SIZES)[number]["id"];

export const RIBBONS = [
  { id: "royal", name: "Royal blue", color: "#1f5fd6" },
  { id: "berry", name: "Berry pink", color: "#ff6fa3" },
  { id: "mint", name: "Mint", color: "#3fd3ae" },
  { id: "lemon", name: "Lemon", color: "#ffd45e" },
] as const;

export type RibbonId = (typeof RIBBONS)[number]["id"];

export interface BoxDraft {
  size: BoxSizeId;
  ribbon: RibbonId;
  /** Up to 30 characters, shown on the box lid. */
  name: string;
  /** Variant ids, in slot order. Length never exceeds the size's slots. */
  items: string[];
}

export const NAME_MAX = 30;
export const emptyBox = (): BoxDraft => ({ size: "classic", ribbon: "royal", name: "", items: [] });

const VARIANT_ID = /^[a-z0-9][a-z0-9-]{0,80}$/;

export function slotsFor(size: BoxSizeId) {
  return BOX_SIZES.find((s) => s.id === size)?.slots ?? 5;
}

export function isBoxSize(v: unknown): v is BoxSizeId {
  return BOX_SIZES.some((s) => s.id === v);
}

export function isRibbon(v: unknown): v is RibbonId {
  return RIBBONS.some((r) => r.id === v);
}

/** Box names are plain text: strip control characters and angle brackets, trim, cap length. */
export function cleanName(v: unknown): string {
  if (typeof v !== "string") return "";
  return v.replace(/[\u0000-\u001f\u007f<>]/g, "").replace(/\s+/g, " ").trimStart().slice(0, NAME_MAX);
}

/**
 * Cleans a stored or shared draft. `knownVariants` (if given) drops ids that
 * aren't in the current catalog.
 */
export function sanitizeBox(raw: unknown, knownVariants?: Set<string>): BoxDraft {
  const base = emptyBox();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, unknown>;
  const size = isBoxSize(r.size) ? r.size : base.size;
  const items = Array.isArray(r.items)
    ? r.items.filter((i): i is string => typeof i === "string" && VARIANT_ID.test(i) && (!knownVariants || knownVariants.has(i)))
    : [];
  return {
    size,
    ribbon: isRibbon(r.ribbon) ? r.ribbon : base.ribbon,
    name: cleanName(r.name).trim(),
    items: items.slice(0, slotsFor(size)),
  };
}

export function addItem(box: BoxDraft, variantId: string): BoxDraft {
  if (!VARIANT_ID.test(variantId) || box.items.length >= slotsFor(box.size)) return box;
  return { ...box, items: [...box.items, variantId] };
}

export function removeAt(box: BoxDraft, index: number): BoxDraft {
  if (index < 0 || index >= box.items.length) return box;
  return { ...box, items: box.items.filter((_, i) => i !== index) };
}

/** Changing size keeps as many picks as fit; the rest are dropped from the end. */
export function setSize(box: BoxDraft, size: BoxSizeId): BoxDraft {
  return { ...box, size, items: box.items.slice(0, slotsFor(size)) };
}

/** Fills the empty slots with random picks (`random` is injectable for tests). */
export function surpriseFill(box: BoxDraft, variantIds: string[], random: () => number = Math.random): BoxDraft {
  if (variantIds.length === 0) return box;
  const items = [...box.items];
  while (items.length < slotsFor(box.size)) items.push(variantIds[Math.floor(random() * variantIds.length)]);
  return { ...box, items };
}

/** Query string for a shareable box link. Contains product variant ids only. */
export function encodeBox(box: BoxDraft): string {
  const p = new URLSearchParams();
  p.set("size", box.size);
  p.set("ribbon", box.ribbon);
  if (box.items.length) p.set("items", box.items.join(","));
  if (box.name.trim()) p.set("name", box.name.trim());
  return p.toString();
}

export function decodeBox(params: URLSearchParams, knownVariants?: Set<string>): BoxDraft | null {
  if (!params.has("items") && !params.has("size")) return null;
  const items = (params.get("items") ?? "").slice(0, 2000).split(",").filter(Boolean);
  return sanitizeBox({ size: params.get("size"), ribbon: params.get("ribbon"), name: params.get("name"), items }, knownVariants);
}
