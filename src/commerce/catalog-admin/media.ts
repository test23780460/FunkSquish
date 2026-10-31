import { createHash } from "node:crypto";

/**
 * Upload checks for product photos and short videos. The file's own bytes
 * decide what it is (never its name or the browser's claimed type), and only
 * JPEG, PNG, WebP, MP4 and WebM are accepted — no SVG (it can carry scripts),
 * no HTML, no archives.
 *
 * Photos lose their hidden metadata before storage: phone photos carry the
 * GPS location they were taken at (often your home), camera serial numbers
 * and editing history in EXIF/XMP blocks. Pixels are untouched; resizing and
 * modern formats are done when the image is served (next/image).
 */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 4 * 1024 * 1024;
export const MIN_IMAGE_SIDE = 400;
export const MAX_IMAGE_SIDE = 8000;

export type MediaKind = "image" | "video";
export interface Sniffed {
  kind: MediaKind;
  contentType: "image/jpeg" | "image/png" | "image/webp" | "video/mp4" | "video/webm";
  ext: "jpg" | "png" | "webp" | "mp4" | "webm";
}

const ascii = (b: Uint8Array, at: number, len: number) => String.fromCharCode(...b.subarray(at, at + len));

export function sniff(b: Uint8Array): Sniffed | null {
  if (b.length < 16) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { kind: "image", contentType: "image/jpeg", ext: "jpg" };
  if ([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v)) return { kind: "image", contentType: "image/png", ext: "png" };
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP") return { kind: "image", contentType: "image/webp", ext: "webp" };
  if (ascii(b, 4, 4) === "ftyp" && /^(isom|iso2|mp41|mp42|avc1|M4V |dash)$/.test(ascii(b, 8, 4))) return { kind: "video", contentType: "video/mp4", ext: "mp4" };
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return { kind: "video", contentType: "video/webm", ext: "webm" };
  return null;
}

const u16be = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];
const u32be = (b: Uint8Array, i: number) => ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];
const u16le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8);
const u24le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
const u32le = (b: Uint8Array, i: number) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;

/** Pixel size from the file header, or null if the header can't be read (the file is then refused). */
export function imageSize(b: Uint8Array, type: Sniffed["contentType"]): { width: number; height: number } | null {
  try {
    if (type === "image/png") return u32be(b, 12) === 0x49484452 ? { width: u32be(b, 16), height: u32be(b, 20) } : null;
    if (type === "image/jpeg") {
      let i = 2;
      while (i + 9 < b.length) {
        if (b[i] !== 0xff) return null;
        const marker = b[i + 1];
        if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
          i += 2;
          continue;
        }
        const len = u16be(b, i + 2);
        // SOF0..SOF15 except DHT (C4), JPG (C8) and DAC (CC)
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { height: u16be(b, i + 5), width: u16be(b, i + 7) };
        i += 2 + len;
      }
      return null;
    }
    if (type === "image/webp") {
      const chunk = ascii(b, 12, 4);
      if (chunk === "VP8 ") return { width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff };
      if (chunk === "VP8L") {
        const bits = u32le(b, 21);
        return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
      }
      if (chunk === "VP8X") return { width: u24le(b, 24) + 1, height: u24le(b, 27) + 1 };
      return null;
    }
  } catch {
    return null;
  }
  return null;
}

/* ------------------------------ metadata stripping ------------------------------ */

/** JPEG: drop APP1 (EXIF/XMP, incl. GPS) and APP13 (IPTC/Photoshop) segments before the image data starts. */
function stripJpeg(b: Uint8Array): Uint8Array {
  const out: Uint8Array[] = [b.subarray(0, 2)];
  let i = 2;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) return b; // not a well-formed segment list: leave as is (it was still sniffed as JPEG)
    const marker = b[i + 1];
    if (marker === 0xda) {
      out.push(b.subarray(i)); // start of scan: the rest is image data
      return concat(out);
    }
    const len = u16be(b, i + 2);
    if (len < 2 || i + 2 + len > b.length) return b;
    if (marker !== 0xe1 && marker !== 0xed) out.push(b.subarray(i, i + 2 + len));
    i += 2 + len;
  }
  return b;
}

/** PNG: drop eXIf and text chunks (tEXt, zTXt, iTXt can hold XMP, GPS, software history). */
function stripPng(b: Uint8Array): Uint8Array {
  const drop = new Set(["eXIf", "tEXt", "zTXt", "iTXt", "tIME"]);
  const out: Uint8Array[] = [b.subarray(0, 8)];
  let i = 8;
  while (i + 12 <= b.length) {
    const len = u32be(b, i);
    const type = ascii(b, i + 4, 4);
    const end = i + 12 + len;
    if (end > b.length) return b;
    if (!drop.has(type)) out.push(b.subarray(i, end));
    i = end;
    if (type === "IEND") break;
  }
  return concat(out);
}

/** WebP (extended): drop EXIF and XMP chunks and clear their flags. */
function stripWebp(b: Uint8Array): Uint8Array {
  if (ascii(b, 12, 4) !== "VP8X") return b; // simple WebP files can't hold metadata
  const chunks: Uint8Array[] = [];
  let i = 12;
  while (i + 8 <= b.length) {
    const type = ascii(b, i, 4);
    const len = u32le(b, i + 4);
    const end = i + 8 + len + (len % 2);
    if (end > b.length + 1) return b;
    if (type !== "EXIF" && type !== "XMP ") chunks.push(b.subarray(i, Math.min(end, b.length)));
    i = end;
  }
  const body = concat(chunks);
  const copy = new Uint8Array(body);
  copy[8] &= ~(0x08 | 0x04); // VP8X flags byte (offset 8 within the chunk): EXIF (0x08), XMP (0x04)
  const header = new Uint8Array(12);
  header.set([0x52, 0x49, 0x46, 0x46]);
  const size = copy.length + 4;
  header.set([size & 255, (size >> 8) & 255, (size >> 16) & 255, (size >>> 24) & 255], 4);
  header.set([0x57, 0x45, 0x42, 0x50], 8);
  return concat([header, copy]);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

export function stripImageMetadata(b: Uint8Array, type: Sniffed["contentType"]): Uint8Array {
  if (type === "image/jpeg") return stripJpeg(b);
  if (type === "image/png") return stripPng(b);
  if (type === "image/webp") return stripWebp(b);
  return b;
}

/* ------------------------------ the whole check ------------------------------ */

export type VideoShape = "portrait" | "square" | "landscape";
export const VIDEO_SHAPES: Record<VideoShape, { width: number; height: number; label: string }> = {
  portrait: { width: 1080, height: 1920, label: "Tall (9:16, like TikTok)" },
  square: { width: 1080, height: 1080, label: "Square" },
  landscape: { width: 1920, height: 1080, label: "Wide (16:9)" },
};

export type CheckedUpload =
  | { ok: true; kind: MediaKind; contentType: Sniffed["contentType"]; ext: Sniffed["ext"]; bytes: Uint8Array; width: number; height: number; hash: string; strippedBytes: number }
  | { ok: false; error: string };

export function checkUpload(input: Uint8Array, opts: { videoShape?: VideoShape } = {}): CheckedUpload {
  if (input.length === 0) return { ok: false, error: "That file is empty." };
  const s = sniff(input);
  if (!s) return { ok: false, error: "Only JPEG, PNG or WebP photos and MP4 or WebM videos can be uploaded. (iPhone photos are converted to JPEG automatically when you pick them here.)" };
  if (s.kind === "image") {
    if (input.length > MAX_IMAGE_BYTES) return { ok: false, error: "Photos can be up to 4 MB. Export a smaller JPEG (around 2000 px wide is plenty)." };
    const size = imageSize(input, s.contentType);
    if (!size || !size.width || !size.height) return { ok: false, error: "That photo's header couldn't be read. Re-save it as JPEG and try again." };
    if (Math.min(size.width, size.height) < MIN_IMAGE_SIDE) return { ok: false, error: `That photo is too small (${size.width}×${size.height}). Use at least ${MIN_IMAGE_SIDE} px on the short side.` };
    if (Math.max(size.width, size.height) > MAX_IMAGE_SIDE) return { ok: false, error: `That photo is too large (${size.width}×${size.height}). Keep it under ${MAX_IMAGE_SIDE} px.` };
    const bytes = stripImageMetadata(input, s.contentType);
    return { ok: true, ...s, bytes, ...size, hash: contentHash(bytes), strippedBytes: input.length - bytes.length };
  }
  if (input.length > MAX_VIDEO_BYTES) return { ok: false, error: "Videos can be up to 4 MB here (a short, compressed clip). Longer videos are better on TikTok." };
  const shape = VIDEO_SHAPES[opts.videoShape ?? "portrait"];
  return { ok: true, ...s, bytes: input, width: shape.width, height: shape.height, hash: contentHash(input), strippedBytes: 0 };
}

export const contentHash = (b: Uint8Array) => createHash("sha256").update(b).digest("hex").slice(0, 32);

/** Public URL path for a stored media file. */
export const MEDIA_FILE = /^[a-f0-9]{32}\.(jpg|png|webp|mp4|webm)$/;
export const mediaPath = (file: string) => `/media/${file}`;
export const mediaKey = (file: string) => `p/${file}`;
