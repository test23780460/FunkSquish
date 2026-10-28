/**
 * Small private key-value store with compare-and-set, used for partner
 * applications, rate limits and retention records. No "server-only" import, so
 * the Netlify scheduled cleanup function can use it too; app code imports
 * "@/lib/storage/kv" instead.
 *  - Netlify Blobs (on Netlify): durable, private to the site, never served publicly.
 *  - In-memory (tests, and local `next dev` when explicitly allowed): NOT durable.
 */
export interface Versioned<T> {
  value: T;
  etag: string;
}

export interface KvStore {
  readonly durable: boolean;
  get<T>(key: string): Promise<Versioned<T> | null>;
  /** Writes only if the key doesn't exist yet. */
  create<T>(key: string, value: T): Promise<boolean>;
  /** Writes only if the stored etag still matches. */
  replace<T>(key: string, value: T, etag: string): Promise<boolean>;
  delete(key: string): Promise<void>;
  list(prefix: string): Promise<string[]>;
}

export class ConflictError extends Error {
  constructor(key: string) {
    super(`Too many concurrent updates for ${key}`);
  }
}

/** Optimistic read-modify-write. Return `undefined` from `fn` to leave the value unchanged. */
export async function updateWithRetry<T>(
  store: KvStore,
  key: string,
  fn: (current: T | null) => T | undefined,
  attempts = 8,
): Promise<{ value: T | null; changed: boolean }> {
  for (let i = 0; i < attempts; i++) {
    const current = await store.get<T>(key);
    const next = fn(current ? structuredClone(current.value) : null);
    if (next === undefined) return { value: current?.value ?? null, changed: false };
    const ok = current ? await store.replace(key, next, current.etag) : await store.create(key, next);
    if (ok) return { value: next, changed: true };
  }
  throw new ConflictError(key);
}

export class MemoryKvStore implements KvStore {
  readonly durable = false;
  private data = new Map<string, { json: string; version: number }>();
  private counter = 0;

  async get<T>(key: string) {
    const e = this.data.get(key);
    return e ? { value: JSON.parse(e.json) as T, etag: String(e.version) } : null;
  }
  async create<T>(key: string, value: T) {
    if (this.data.has(key)) return false;
    this.data.set(key, { json: JSON.stringify(value), version: ++this.counter });
    return true;
  }
  async replace<T>(key: string, value: T, etag: string) {
    const e = this.data.get(key);
    if (!e || String(e.version) !== etag) return false;
    this.data.set(key, { json: JSON.stringify(value), version: ++this.counter });
    return true;
  }
  async delete(key: string) {
    this.data.delete(key);
  }
  async list(prefix: string) {
    return [...this.data.keys()].filter((k) => k.startsWith(prefix)).sort();
  }

  /** Test helper: every key, in insertion order. */
  keys(): string[] {
    return [...this.data.keys()];
  }
}

export class StorageTimeoutError extends Error {
  constructor(op: string) {
    super(`Storage ${op} took too long`);
    this.name = "StorageTimeoutError";
  }
}

/** Never let one storage call hang a request until the platform kills it. */
function withTimeout<T>(op: string, p: Promise<T>, ms = 5000): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    p.finally(() => clearTimeout(timer)),
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new StorageTimeoutError(op)), ms);
    }),
  ]);
}

export async function createBlobsKvStore(name: string): Promise<KvStore> {
  const { getStore } = await import("@netlify/blobs");
  // Use the platform's own fetch, not Next.js's patched (caching) fetch: through the
  // patched one, strongly-consistent Blobs reads never returned inside server actions.
  const blobsFetch: typeof fetch = (input, init) => {
    const patched = globalThis.fetch as typeof fetch & { _nextOriginalFetch?: typeof fetch };
    return (patched._nextOriginalFetch ?? patched)(input, { ...init, cache: "no-store" });
  };
  const raw = getStore({ name, consistency: "strong", fetch: blobsFetch });
  const store = {
    getWithMetadata: (key: string, o: { type: "json" }) => withTimeout("read", raw.getWithMetadata(key, o)),
    setJSON: (key: string, v: unknown, o: Parameters<typeof raw.setJSON>[2]) => withTimeout("write", raw.setJSON(key, v, o)),
    delete: (key: string) => withTimeout("delete", raw.delete(key)),
    list: (o: { prefix: string }) => withTimeout("list", raw.list(o)),
  };
  return {
    durable: true,
    async get<T>(key: string) {
      // On Netlify, reading a key that doesn't exist can hang instead of returning
      // "not found" (seen on the PR #10 preview), so check it exists first (fast).
      const { blobs } = await store.list({ prefix: key });
      if (!blobs.some((b) => b.key === key)) return null;
      const r = await store.getWithMetadata(key, { type: "json" });
      if (!r || !r.etag) return null;
      return { value: r.data as T, etag: r.etag };
    },
    async create<T>(key: string, value: T) {
      return (await store.setJSON(key, value, { onlyIfNew: true })).modified;
    },
    async replace<T>(key: string, value: T, etag: string) {
      return (await store.setJSON(key, value, { onlyIfMatch: etag })).modified;
    },
    async delete(key: string) {
      await store.delete(key);
    },
    async list(prefix: string) {
      const { blobs } = await store.list({ prefix });
      return blobs.map((b) => b.key).sort();
    },
  };
}
