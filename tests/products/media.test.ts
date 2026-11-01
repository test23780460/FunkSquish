import { describe, expect, it } from "vitest";
import { crc32 } from "node:zlib";
import { checkUpload, imageSize, sniff, stripImageMetadata } from "@/commerce/catalog-admin/media";

/* Tiny synthetic files: just enough header for the checks (no real photos). */
const bytes = (...parts: (number[] | string)[]) => new Uint8Array(parts.flatMap((p) => (typeof p === "string" ? [...p].map((c) => c.charCodeAt(0)) : p)));
const be16 = (n: number) => [(n >> 8) & 255, n & 255];
const be32 = (n: number) => [(n >>> 24) & 255, (n >> 16) & 255, (n >> 8) & 255, n & 255];
const le32 = (n: number) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255];

function jpeg(w: number, h: number, withExif = true) {
  const exif = bytes("Exif", [0, 0], "GPS-LATITUDE-38.2,-85.7-SERIAL-12345");
  return bytes(
    [0xff, 0xd8],
    [0xff, 0xe0], be16(16), "JFIF", [0, 1, 1, 0, 0, 1, 0, 1, 0, 0],
    ...(withExif ? [[0xff, 0xe1], be16(exif.length + 2), [...exif]] : []),
    [0xff, 0xc0], be16(17), [8], be16(h), be16(w), [3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1],
    [0xff, 0xda], be16(12), [3, 1, 0, 2, 0x11, 3, 0x11, 0, 0x3f, 0], [1, 2, 3, 4, 5],
    [0xff, 0xd9],
  );
}

const pngChunk = (type: string, data: number[]) => {
  const td = [...[...type].map((c) => c.charCodeAt(0)), ...data];
  return [...be32(data.length), ...td, ...be32(crc32(Buffer.from(td)))];
};

function png(w: number, h: number, withText = true) {
  const chunk = pngChunk;
  return bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], chunk("IHDR", [...be32(w), ...be32(h), 8, 6, 0, 0, 0]), ...(withText ? [chunk("tEXt", [...bytes("GPS\0home-address")])] : []), chunk("IDAT", [1, 2, 3]), chunk("IEND", []));
}

function webpExt(w: number, h: number) {
  const vp8x = [...bytes("VP8X"), ...le32(10), 0x08 | 0x04, 0, 0, 0, (w - 1) & 255, ((w - 1) >> 8) & 255, 0, (h - 1) & 255, ((h - 1) >> 8) & 255, 0];
  const exif = [...bytes("EXIF"), ...le32(4), ...bytes("GPS!")];
  const img = [...bytes("VP8L"), ...le32(4), 1, 2, 3, 4];
  const body = [...bytes("WEBP"), ...vp8x, ...exif, ...img];
  return bytes("RIFF", le32(body.length), body);
}

describe("upload type checks use the file's own bytes", () => {
  it("recognizes JPEG, PNG, WebP, MP4 and WebM", () => {
    expect(sniff(jpeg(800, 600))?.contentType).toBe("image/jpeg");
    expect(sniff(png(800, 600))?.contentType).toBe("image/png");
    expect(sniff(webpExt(800, 600))?.contentType).toBe("image/webp");
    expect(sniff(bytes([0, 0, 0, 24], "ftypisom", [0, 0, 0, 0, 0, 0, 0, 0]))?.contentType).toBe("video/mp4");
    expect(sniff(bytes([0x1a, 0x45, 0xdf, 0xa3], new Array(20).fill(0)))?.contentType).toBe("video/webm");
  });

  it("refuses SVG, HTML, GIF, PDF, ZIP and executables whatever they're named", () => {
    for (const evil of ['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', "<!doctype html><script>alert(1)</script>", "GIF89a............", "%PDF-1.7 ..........", "PK\u0003\u0004..............", "MZ................"])
      expect(checkUpload(bytes(evil)).ok, evil.slice(0, 10)).toBe(false);
  });

  it("reads pixel sizes from the header", () => {
    expect(imageSize(jpeg(1200, 900), "image/jpeg")).toEqual({ width: 1200, height: 900 });
    expect(imageSize(png(640, 480), "image/png")).toEqual({ width: 640, height: 480 });
    expect(imageSize(webpExt(1000, 750), "image/webp")).toEqual({ width: 1000, height: 750 });
  });

  it("refuses photos that are too small, too big in pixels, or over 4 MB", () => {
    expect(checkUpload(jpeg(300, 300))).toMatchObject({ ok: false });
    expect(checkUpload(jpeg(9000, 9000))).toMatchObject({ ok: false });
    const huge = new Uint8Array(4 * 1024 * 1024 + 1);
    huge.set(jpeg(1000, 1000));
    expect(checkUpload(huge)).toMatchObject({ ok: false, error: expect.stringMatching(/4 MB/) });
  });
});

describe("hidden photo data (GPS, serial numbers) is removed", () => {
  const has = (b: Uint8Array, s: string) => Buffer.from(b).includes(Buffer.from(s));

  it("JPEG: drops EXIF, keeps the image", () => {
    const r = checkUpload(jpeg(1200, 900));
    if (!r.ok) throw new Error(r.error);
    expect(has(r.bytes, "GPS-LATITUDE")).toBe(false);
    expect(r.strippedBytes).toBeGreaterThan(0);
    expect(imageSize(r.bytes, "image/jpeg")).toEqual({ width: 1200, height: 900 });
    expect(has(r.bytes, "JFIF")).toBe(true);
  });

  it("PNG: drops text chunks", () => {
    const out = stripImageMetadata(png(800, 600), "image/png")!;
    expect(has(out, "home-address")).toBe(false);
    expect(has(out, "IEND")).toBe(true);
  });

  it("WebP: drops the EXIF chunk and its flag", () => {
    const out = stripImageMetadata(webpExt(800, 600), "image/webp")!;
    expect(has(out, "GPS!")).toBe(false);
    expect(out[20] & 0x08).toBe(0); // VP8X flags byte
    expect(imageSize(out, "image/webp")).toEqual({ width: 800, height: 600 });
  });

  it("the same picture uploaded twice gets the same name (stored once)", () => {
    const a = checkUpload(jpeg(800, 800));
    const b = checkUpload(jpeg(800, 800));
    expect(a.ok && b.ok && a.hash === b.hash).toBe(true);
  });
});

/* ------------- regression: malformed files carrying location data are refused or cleaned, never stored as-is ------------- */
describe("damaged or tricky photos never keep their hidden data (review finding, PR #27)", () => {
  const has = (b: Uint8Array, s: string) => Buffer.from(b).includes(Buffer.from(s));
  const GPS = "GPS-LATITUDE-38.2,-85.7";
  const exifSeg = () => { const e = bytes("Exif", [0, 0], GPS); return [0xff, 0xe1, ...be16(e.length + 2), ...e]; };
  const sof = (w: number, h: number) => [0xff, 0xc0, ...be16(17), 8, ...be16(h), ...be16(w), 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1];
  const sos = [0xff, 0xda, ...be16(12), 3, 1, 0, 2, 0x11, 3, 0x11, 0, 0x3f, 0];
  /** checkUpload must either refuse the file or return bytes without any trace of the GPS text. */
  const safe = (file: Uint8Array) => {
    const r = checkUpload(file);
    return { refused: !r.ok, leaked: r.ok && has(r.bytes, GPS) };
  };

  it("JPEG cut off in the middle of its EXIF block is refused", () => {
    const full = jpeg(1200, 900);
    const cut = full.subarray(0, 40); // header + part of APP1
    expect(safe(cut)).toEqual({ refused: true, leaked: false });
  });

  it("JPEG with a segment length pointing past the end is refused", () => {
    const f = bytes([0xff, 0xd8], [0xff, 0xe1], be16(5000), "Exif", [0, 0], GPS, sof(1200, 900));
    expect(safe(f)).toEqual({ refused: true, leaked: false });
  });

  it("JPEG with garbage between segments (where the old code gave up and kept everything) is refused", () => {
    const f = bytes([0xff, 0xd8], sof(1200, 900), [0x00, 0x11], exifSeg(), sos, [1, 2, 3], [0xff, 0xd9]);
    expect(safe(f)).toEqual({ refused: true, leaked: false });
  });

  it("JPEG with no end marker (truncated scan) is refused", () => {
    const f = bytes([0xff, 0xd8], exifSeg(), sof(1200, 900), sos, [1, 2, 3, 4, 5, 6]);
    expect(safe(f)).toEqual({ refused: true, leaked: false });
  });

  it("JPEG with a second photo + EXIF appended after the end (phone MPF / depth images) keeps only the first image", () => {
    const f = bytes([0xff, 0xd8], sof(1200, 900), sos, [1, 2, 3], [0xff, 0xd9], [0xff, 0xd8], exifSeg(), sof(1200, 900), sos, [4, 5], [0xff, 0xd9]);
    const r = checkUpload(f);
    expect(r.ok).toBe(true);
    if (r.ok) expect(has(r.bytes, GPS)).toBe(false);
  });

  it("JPEG with EXIF hidden between scans, in comments or in an MPF segment is cleaned", () => {
    const com = [0xfe, ...be16(GPS.length + 2), ...bytes(GPS)];
    const mpf = [0xe2, ...be16(4 + 2 + GPS.length), ...bytes("MPF", [0], GPS)];
    const f = bytes([0xff, 0xd8], sof(1200, 900), [0xff, ...com], [0xff, ...mpf], sos, [1, 2, 0xff, 0x00, 3], exifSeg(), sos, [4, 5], [0xff, 0xd9]);
    const r = checkUpload(f);
    expect(r.ok).toBe(true);
    if (r.ok) expect(has(r.bytes, GPS)).toBe(false);
  });

  it("JPEG keeps its colour profile", () => {
    const icc = [0xff, 0xe2, ...be16(2 + 12 + 4), ...bytes("ICC_PROFILE", [0]), 1, 1, 9, 9];
    const r = checkUpload(bytes([0xff, 0xd8], icc, sof(1200, 900), sos, [1, 2], [0xff, 0xd9]));
    expect(r.ok && has(r.bytes, "ICC_PROFILE")).toBe(true);
  });

  it("PNG with a damaged chunk (bad checksum), no IEND, or a chunk running past the end is refused", () => {
    const good = png(800, 600);
    const badCrc = new Uint8Array(good); badCrc[good.length - 30] ^= 0xff; // flips a byte inside a chunk
    expect(safe(badCrc).leaked).toBe(false);
    expect(safe(badCrc).refused).toBe(true);
    const noEnd = good.subarray(0, good.length - 12);
    expect(safe(noEnd)).toEqual({ refused: true, leaked: false });
    const overrun = bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], pngChunk("IHDR", [...be32(800), ...be32(600), 8, 6, 0, 0, 0]), be32(9999), "eXIf", GPS);
    expect(safe(overrun)).toEqual({ refused: true, leaked: false });
  });

  it("PNG with metadata in an eXIf chunk, an unknown chunk or after IEND is cleaned", () => {
    const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    const f = bytes(sig, pngChunk("IHDR", [...be32(800), ...be32(600), 8, 6, 0, 0, 0]), pngChunk("eXIf", [...bytes("MM", GPS)]), pngChunk("caBX", [...bytes(GPS)]), pngChunk("IDAT", [1, 2, 3]), pngChunk("IEND", []), "trailing " + GPS);
    const r = checkUpload(f);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(has(r.bytes, GPS)).toBe(false);
      expect(imageSize(r.bytes, "image/png")).toEqual({ width: 800, height: 600 });
    }
  });

  it("WebP that is truncated (RIFF size longer than the file) or has a chunk overrunning it is refused", () => {
    const good = webpExt(800, 600);
    expect(safe(good.subarray(0, good.length - 3))).toEqual({ refused: true, leaked: false });
    const lie = new Uint8Array(good); lie[46] = 0xff; // EXIF chunk length → past the end
    expect(safe(lie).leaked).toBe(false);
  });

  it("WebP with EXIF in an unknown chunk or after the RIFF end is cleaned", () => {
    const vp8x = [...bytes("VP8X"), ...le32(10), 0x08, 0, 0, 0, 0x1f, 0x03, 0, 0x57, 0x02, 0];
    const odd = [...bytes("ZZZZ"), ...le32(GPS.length + (GPS.length % 2)), ...bytes(GPS), ...(GPS.length % 2 ? [0] : [])];
    const img = [...bytes("VP8L"), ...le32(4), 1, 2, 3, 4];
    const body = [...bytes("WEBP"), ...vp8x, ...odd, ...img];
    const f = bytes("RIFF", le32(body.length), body, "EXIF" + GPS);
    const r = checkUpload(f);
    expect(r.ok).toBe(true);
    if (r.ok) expect(has(r.bytes, GPS)).toBe(false);
  });

  it("stripImageMetadata itself never returns the original bytes for a file it can't parse", () => {
    const broken = bytes([0xff, 0xd8], [0xff, 0xe1], be16(4000), "Exif", [0, 0], GPS);
    expect(stripImageMetadata(broken, "image/jpeg")).toBeNull();
  });
});
