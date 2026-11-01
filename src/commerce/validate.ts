import type { Product } from "./types";

/**
 * Runtime validation for the PUBLIC product catalog.
 *
 * Runs at build time (the site fails to build on bad data) and from the
 * catalog scripts. Uses only erasable TypeScript so Node can run it directly.
 */

const CATEGORIES = ["fruity-slushies", "jelly-squishies", "crunchy-squishies", "cute-collectibles"];
const PUBLICATION = ["draft", "preview", "published", "archived"];
const ART = ["slushie", "jelly", "crunchy", "capsule"];
const TEXTURES = ["soft", "slow-rise", "jelly", "crunchy", "buttery"];
/**
 * Real media must be our own files: under /public/products/ (build-time catalog),
 * or uploaded through the owner dashboard and served from /media/<content hash>.
 * Never hotlinked or copied images.
 */
const MEDIA_SRC = /^(\/products\/[a-z0-9-]+\/[\w.-]+|\/media\/[a-f0-9]{32}\.(jpg|png|webp|mp4|webm))$/i;

/** Keys that indicate private data. They must never appear in public JSON. */
const FORBIDDEN_KEY = /(cost|supplier|vendor|internal|note|margin|invoice|wholesale|compliance|certificate|purchase_?order)/i;

export class CatalogError extends Error {}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === "string";
const isNullableStr = (v: unknown) => v === null || isStr(v);
const isNullableNum = (v: unknown) => v === null || (typeof v === "number" && Number.isFinite(v) && v >= 0);

function scanForbidden(value: unknown, path: string, errors: string[]) {
  if (Array.isArray(value)) value.forEach((v, i) => scanForbidden(v, `${path}[${i}]`, errors));
  else if (isObj(value))
    for (const [k, v] of Object.entries(value)) {
      // `externalPurchaseUrl` is a public buy link, not private purchasing data.
      if (FORBIDDEN_KEY.test(k) && k !== "externalPurchaseUrl") errors.push(`${path}.${k}: private-looking field is not allowed in public catalog data`);
      scanForbidden(v, `${path}.${k}`, errors);
    }
}

function checkMoney(v: unknown, path: string, errors: string[]) {
  if (v === null) return;
  if (!isObj(v) || !Number.isInteger(v.amount) || (v.amount as number) < 0 || v.currency !== "USD")
    errors.push(`${path}: must be null or { amount: <integer cents>, currency: "USD" }`);
}

export function validateProducts(input: unknown): Product[] {
  const errors: string[] = [];
  if (!Array.isArray(input)) throw new CatalogError("Catalog must be a JSON array of products.");

  scanForbidden(input, "products", errors);
  const slugs = new Set<string>();
  const skus = new Set<string>();

  input.forEach((p, i) => {
    const at = `products[${i}]`;
    if (!isObj(p)) return void errors.push(`${at}: must be an object`);
    for (const key of ["id", "slug", "name", "shortDescription", "description", "createdAt"])
      if (!isStr(p[key]) || !(p[key] as string).trim()) errors.push(`${at}.${key}: required text`);
    if (isStr(p.slug)) {
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.slug)) errors.push(`${at}.slug: lowercase letters, numbers and dashes only`);
      if (slugs.has(p.slug)) errors.push(`${at}.slug: duplicate "${p.slug}"`);
      slugs.add(p.slug);
    }
    if (!CATEGORIES.includes(p.category as string)) errors.push(`${at}.category: one of ${CATEGORIES.join(", ")}`);
    if (!PUBLICATION.includes(p.publication as string)) errors.push(`${at}.publication: one of ${PUBLICATION.join(", ")}`);
    if (!ART.includes(p.art as string)) errors.push(`${at}.art: one of ${ART.join(", ")}`);
    if (!Array.isArray(p.tags) || !p.tags.every(isStr)) errors.push(`${at}.tags: list of text`);
    if (typeof p.featuredRank !== "number") errors.push(`${at}.featuredRank: number`);

    if (!Array.isArray(p.media)) errors.push(`${at}.media: list`);
    else
      p.media.forEach((m, j) => {
        if (!isObj(m) || !["image", "video"].includes(m.type as string) || !isStr(m.src) || !isStr(m.alt) || !m.alt.trim())
          errors.push(`${at}.media[${j}]: needs type (image|video), src and descriptive alt text`);
        else if (!(typeof m.width === "number" && typeof m.height === "number")) errors.push(`${at}.media[${j}]: width and height required`);
        else {
          if (!MEDIA_SRC.test(m.src as string)) errors.push(`${at}.media[${j}].src: must be a file under /products/<slug>/ or an uploaded /media/ file`);
          if (m.poster !== undefined && !(isStr(m.poster) && MEDIA_SRC.test(m.poster))) errors.push(`${at}.media[${j}].poster: must be a file under /products/<slug>/ or an uploaded /media/ file`);
          if (m.captions !== undefined && !(isStr(m.captions) && MEDIA_SRC.test(m.captions) && m.captions.endsWith(".vtt")))
            errors.push(`${at}.media[${j}].captions: must be a .vtt file under /products/<slug>/`);
        }
      });

    if (p.textures !== undefined && !(Array.isArray(p.textures) && p.textures.every((t) => TEXTURES.includes(t as string))))
      errors.push(`${at}.textures: list of ${TEXTURES.join(", ")}`);

    if (p.salesTerms !== undefined) {
      const st = p.salesTerms;
      if (!isObj(st) || Object.keys(st).some((k) => !["finalSaleOnceOpened", "processingBusinessDays"].includes(k)))
        errors.push(`${at}.salesTerms: only finalSaleOnceOpened and processingBusinessDays are allowed`);
      else {
        if (st.finalSaleOnceOpened !== undefined && typeof st.finalSaleOnceOpened !== "boolean") errors.push(`${at}.salesTerms.finalSaleOnceOpened: true or false`);
        if (st.processingBusinessDays !== undefined && !(Number.isInteger(st.processingBusinessDays) && (st.processingBusinessDays as number) >= 1 && (st.processingBusinessDays as number) <= 30))
          errors.push(`${at}.salesTerms.processingBusinessDays: whole number of business days, 1–30`);
      }
    }

    const specs = p.specs;
    if (!isObj(specs) || !["material", "fill", "texture", "sizeDescription"].every((k) => isNullableStr(specs[k])))
      errors.push(`${at}.specs: material, fill, texture, sizeDescription (text or null)`);
    const safety = p.safety;
    if (
      !isObj(safety) ||
      !isNullableStr(safety.ageGrade) ||
      !isNullableStr(safety.manufacturerOrImporter) ||
      !isNullableStr(safety.countryOfOrigin) ||
      !Array.isArray(safety.warnings) ||
      !Array.isArray(safety.careInstructions)
    )
      errors.push(`${at}.safety: ageGrade, manufacturerOrImporter, countryOfOrigin (text or null), warnings[], careInstructions[]`);

    if (!Array.isArray(p.variants) || p.variants.length === 0) return void errors.push(`${at}.variants: at least one variant`);
    p.variants.forEach((v, j) => {
      const vat = `${at}.variants[${j}]`;
      if (!isObj(v)) return void errors.push(`${vat}: must be an object`);
      for (const key of ["id", "sku", "name", "swatch"]) if (!isStr(v[key]) || !(v[key] as string).trim()) errors.push(`${vat}.${key}: required text`);
      if (isStr(v.sku)) {
        if (skus.has(v.sku)) errors.push(`${vat}.sku: duplicate "${v.sku}"`);
        skus.add(v.sku);
      }
      checkMoney(v.price, `${vat}.price`, errors);
      checkMoney(v.compareAtPrice, `${vat}.compareAtPrice`, errors);
      const inv = v.inventory;
      if (!isObj(inv) || typeof inv.tracked !== "boolean" || !(inv.available === null || Number.isInteger(inv.available)))
        errors.push(`${vat}.inventory: { tracked: boolean, available: integer or null }`);
      if (!isNullableNum(v.weightGrams)) errors.push(`${vat}.weightGrams: number or null`);
      if (v.externalPurchaseUrl !== null && !(isStr(v.externalPurchaseUrl) && v.externalPurchaseUrl.startsWith("https://")))
        errors.push(`${vat}.externalPurchaseUrl: https URL or null`);
      if (!isObj(v.palette)) errors.push(`${vat}.palette: required (illustration colors)`);
    });
  });

  if (errors.length) throw new CatalogError(`Invalid product catalog:\n - ${errors.join("\n - ")}`);
  return input as Product[];
}
