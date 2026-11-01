import { createHash } from "node:crypto";

/**
 * Upload checks for product photos and short videos. The file's own bytes
 * decide what it is (never its name or the browser's claimed type), and only
 * JPEG, PNG, WebP, MP4 and WebM are accepted — no SVG (it can carry scripts),
 * no HTML, no archives.
 *
 * Photos lose their hidden metadata before storage: phone photos carry the
 * GPS location they were taken at (often your home), camera serial numbers
 * and editing history in EXIF/XMP blocks. Files that can't be fully parsed
 * are refused — never stored unsanitized. Pixels are untouched; resizing and
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
/*
 * Fail closed. Each sanitizer walks the WHOLE file and rebuilds it from an
 * allow-list of image parts. A damaged, truncated or oddly structured file is
 * refused (null) — the original bytes are never stored as a fallback. Anything
 * after the image's end marker (phones append extra pictures there, each with
 * its own EXIF/GPS) is dropped, and the result is scanned once more for
 * EXIF/XMP signatures before it can be saved.
 */

/** JPEG segments kept: image data, tables, JFIF (APP0), ICC colour profile (APP2 "ICC_PROFILE") and Adobe (APP14). Everything else (EXIF/XMP APP1, MPF APP2, IPTC APP13, comments, other APPn) is dropped. */
function keepJpegSegment(marker: number, b: Uint8Array, at: number, len: number): boolean {
  if (marker === 0xe0 || marker === 0xee) return true;
  if (marker === 0xe2) return len >= 14 && ascii(b, at + 4, 12) === "ICC_PROFILE\0";
  if (marker >= 0xe1 && marker <= 0xef) return false; // other APPn
  if (marker === 0xfe) return false; // COM
  return true; // SOFn, DHT, DQT, DRI, DNL, DAC, …
}

function stripJpeg(b: Uint8Array): Uint8Array | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  const out: Uint8Array[] = [b.subarray(0, 2)];
  let i = 2;
  let sawFrame = false;
  while (true) {
    if (i + 2 > b.length || b[i] !== 0xff) return null; // truncated or not a marker where one must be
    while (b[i + 1] === 0xff && i + 2 < b.length) i++; // fill bytes
    const marker = b[i + 1];
    if (marker === 0xd9) {
      out.push(b.subarray(i, i + 2)); // EOI: stop here; anything after it is dropped
      return sawFrame ? concat(out) : null;
    }
    if (marker === 0x00 || marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) return null; // not valid between segments
    if (i + 4 > b.length) return null;
    const len = u16be(b, i + 2);
    if (len < 2 || i + 2 + len > b.length) return null;
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) sawFrame = true;
    if (keepJpegSegment(marker, b, i, len)) out.push(b.subarray(i, i + 2 + len));
    i += 2 + len;
    if (marker === 0xda) {
      // Entropy-coded scan data runs until the next real marker (FF followed by anything but 00 or a restart marker).
      const scanStart = i;
      while (i + 1 < b.length && !(b[i] === 0xff && b[i + 1] !== 0x00 && !(b[i + 1] >= 0xd0 && b[i + 1] <= 0xd7))) i++;
      if (i + 1 >= b.length) return null; // no end marker: truncated
      out.push(b.subarray(scanStart, i));
    }
  }
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(b: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** PNG chunks kept: pixels, palette, transparency and colour information. Text, EXIF, time, and any unknown chunk are dropped. */
const PNG_KEEP = new Set(["IHDR", "PLTE", "IDAT", "IEND", "tRNS", "gAMA", "cHRM", "sRGB", "iCCP", "sBIT", "pHYs", "bKGD"]);

function stripPng(b: Uint8Array): Uint8Array | null {
  const out: Uint8Array[] = [b.subarray(0, 8)];
  let i = 8;
  let first = true;
  let sawData = false;
  while (true) {
    if (i + 12 > b.length) return null; // ran out before IEND: truncated
    const len = u32be(b, i);
    const type = ascii(b, i + 4, 4);
    const end = i + 12 + len;
    if (len > 0x7fffffff || end > b.length || !/^[A-Za-z]{4}$/.test(type)) return null;
    if (crc32(b.subarray(i + 4, i + 8 + len)) !== u32be(b, i + 8 + len)) return null; // damaged chunk
    if (first && type !== "IHDR") return null;
    first = false;
    if (type === "IDAT") sawData = true;
    if (PNG_KEEP.has(type)) out.push(b.subarray(i, end));
    i = end;
    if (type === "IEND") return sawData ? concat(out) : null; // anything after IEND is dropped
  }
}

/** WebP chunks kept: the image itself, alpha, colour profile and animation frames. EXIF, XMP and unknown chunks are dropped. */
const WEBP_KEEP = new Set(["VP8 ", "VP8L", "VP8X", "ALPH", "ICCP", "ANIM", "ANMF"]);

function stripWebp(b: Uint8Array): Uint8Array | null {
  if (b.length < 20) return null;
  const riffEnd = 8 + u32le(b, 4);
  if (riffEnd > b.length || riffEnd < 20) return null; // truncated
  const chunks: Uint8Array[] = [];
  let i = 12;
  let sawImage = false;
  while (i < riffEnd) {
    if (i + 8 > riffEnd) return null;
    const type = ascii(b, i, 4);
    const len = u32le(b, i + 4);
    const end = i + 8 + len + (len % 2);
    if (end > riffEnd) return null;
    if (i === 12 && !["VP8 ", "VP8L", "VP8X"].includes(type)) return null;
    if (type === "VP8 " || type === "VP8L" || type === "ANMF") sawImage = true;
    if (WEBP_KEEP.has(type)) chunks.push(b.subarray(i, end));
    i = end;
  }
  if (!sawImage) return null;
  const body = new Uint8Array(concat(chunks)); // anything after the RIFF size is dropped
  if (ascii(body, 0, 4) === "VP8X") body[8] &= ~(0x08 | 0x04); // VP8X flags: EXIF (0x08), XMP (0x04) — now absent
  const header = new Uint8Array(12);
  header.set([0x52, 0x49, 0x46, 0x46]);
  const size = body.length + 4;
  header.set([size & 255, (size >> 8) & 255, (size >> 16) & 255, (size >>> 24) & 255], 4);
  header.set([0x57, 0x45, 0x42, 0x50], 8);
  return concat([header, body]);
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

/** Signatures that must never survive (defence in depth after the allow-list). */
const METADATA_SIGNATURES = ["Exif\0\0", "http://ns.adobe.com/xap/", "<x:xmpmeta", "<?xpacket"].map((s) => Buffer.from(s, "latin1"));
export function containsMetadata(b: Uint8Array): boolean {
  const buf = Buffer.from(b.buffer, b.byteOffset, b.length);
  return METADATA_SIGNATURES.some((sig) => buf.includes(sig));
}

/** The photo without hidden metadata, or null if the file is damaged or unusual (then it's refused, never stored as-is). */
export function stripImageMetadata(b: Uint8Array, type: Sniffed["contentType"]): Uint8Array | null {
  let out: Uint8Array | null = null;
  try {
    if (type === "image/jpeg") out = stripJpeg(b);
    else if (type === "image/png") out = stripPng(b);
    else if (type === "image/webp") out = stripWebp(b);
  } catch {
    return null;
  }
  return out && !containsMetadata(out) ? out : null;
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
    // Never fall back to the original: a file we can't fully read and clean is refused.
    if (!bytes) return { ok: false, error: "That photo file looks damaged, incomplete or unusual, so its hidden data (like location) can't be removed safely. Open it and re-save or export it as a JPEG, then upload again." };
    const clean = imageSize(bytes, s.contentType);
    if (!clean || clean.width !== size.width || clean.height !== size.height) return { ok: false, error: "That photo file looks damaged or unusual. Re-save it as JPEG and try again." };
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
