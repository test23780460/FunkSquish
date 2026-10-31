import "server-only";

/**
 * Private binary file storage (product photos/videos, supplier documents).
 * Netlify Blobs on Netlify — private to the site; nothing here is reachable
 * by URL unless a route handler deliberately serves it. In memory locally.
 * Keys are content hashes chosen by the server, never names from the browser.
 */
export interface StoredFile {
  bytes: Uint8Array;
  contentType: string;
  /** Small, non-secret facts (size, width, height, uploaded at). */
  meta: Record<string, string>;
}

export interface FileStore {
  readonly durable: boolean;
  put(key: string, file: StoredFile): Promise<void>;
  get(key: string): Promise<StoredFile | null>;
  /** Content type and metadata only (no bytes). */
  head(key: string): Promise<Omit<StoredFile, "bytes"> | null>;
  delete(key: string): Promise<void>;
  list(prefix: string): Promise<string[]>;
}

export class MemoryFileStore implements FileStore {
  readonly durable = false;
  private data = new Map<string, StoredFile>();
  async put(key: string, file: StoredFile) {
    this.data.set(key, { ...file, bytes: new Uint8Array(file.bytes) });
  }
  async get(key: string) {
    const f = this.data.get(key);
    return f ? { ...f, bytes: new Uint8Array(f.bytes) } : null;
  }
  async head(key: string) {
    const f = this.data.get(key);
    return f ? { contentType: f.contentType, meta: { ...f.meta } } : null;
  }
  async delete(key: string) {
    this.data.delete(key);
  }
  async list(prefix: string) {
    return [...this.data.keys()].filter((k) => k.startsWith(prefix)).sort();
  }
}

function withTimeout<T>(op: string, p: Promise<T>, ms = 10_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    p.finally(() => clearTimeout(timer)),
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`File storage ${op} took too long`)), ms);
    }),
  ]);
}

export async function createBlobsFileStore(name: string): Promise<FileStore> {
  const { getStore } = await import("@netlify/blobs");
  const blobsFetch: typeof fetch = (input, init) => {
    const patched = globalThis.fetch as typeof fetch & { _nextOriginalFetch?: typeof fetch };
    return (patched._nextOriginalFetch ?? patched)(input, { ...init, cache: "no-store" });
  };
  const raw = getStore({ name, consistency: "strong", fetch: blobsFetch });
  const exists = async (key: string) => (await withTimeout("list", raw.list({ prefix: key }))).blobs.some((b) => b.key === key);
  return {
    durable: true,
    async put(key, file) {
      const body = file.bytes.buffer.slice(file.bytes.byteOffset, file.bytes.byteOffset + file.bytes.byteLength) as ArrayBuffer;
      await withTimeout("write", raw.set(key, body, { metadata: { ...file.meta, contentType: file.contentType } }));
    },
    async get(key) {
      // Reads of missing keys can hang on Netlify: check first (see kv-core.ts).
      if (!(await exists(key))) return null;
      const r = await withTimeout("read", raw.getWithMetadata(key, { type: "arrayBuffer" }));
      if (!r) return null;
      const { contentType, ...meta } = (r.metadata ?? {}) as Record<string, string>;
      return { bytes: new Uint8Array(r.data), contentType: contentType ?? "application/octet-stream", meta };
    },
    async head(key) {
      if (!(await exists(key))) return null;
      const r = await withTimeout("read", raw.getMetadata(key));
      if (!r) return null;
      const { contentType, ...meta } = (r.metadata ?? {}) as Record<string, string>;
      return { contentType: contentType ?? "application/octet-stream", meta };
    },
    async delete(key) {
      await withTimeout("delete", raw.delete(key));
    },
    async list(prefix) {
      return (await withTimeout("list", raw.list({ prefix }))).blobs.map((b) => b.key).sort();
    },
  };
}
