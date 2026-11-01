import "server-only";
import type { StoredFile } from "@/lib/storage/files";

/**
 * A stored file as an HTTP response, with byte-range support (Safari only
 * plays MP4 video when the server answers Range requests with 206).
 */
export function fileResponse(file: StoredFile, req: Request, headers: Record<string, string>): Response {
  const size = file.bytes.length;
  // Defence in depth: even if a file were ever opened as a page, it could run nothing and load nothing.
  const base = { "Content-Type": file.contentType, "Accept-Ranges": "bytes", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox", ...headers };
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
  const body = (b: Uint8Array) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
  if (range && (range[1] || range[2])) {
    let start = range[1] ? Number(range[1]) : size - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : size - 1;
    start = Math.max(0, start);
    end = Math.min(size - 1, end);
    if (start > end || start >= size) return new Response(null, { status: 416, headers: { ...base, "Content-Range": `bytes */${size}` } });
    return new Response(body(file.bytes.subarray(start, end + 1)), { status: 206, headers: { ...base, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) } });
  }
  return new Response(body(file.bytes), { headers: { ...base, "Content-Length": String(size) } });
}
