import { describe, expect, it } from "vitest";
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

function png(w: number, h: number, withText = true) {
  const chunk = (type: string, data: number[]) => [...be32(data.length), ...[...type].map((c) => c.charCodeAt(0)), ...data, 0, 0, 0, 0];
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
    const out = stripImageMetadata(png(800, 600), "image/png");
    expect(has(out, "home-address")).toBe(false);
    expect(has(out, "IEND")).toBe(true);
  });

  it("WebP: drops the EXIF chunk and its flag", () => {
    const out = stripImageMetadata(webpExt(800, 600), "image/webp");
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
