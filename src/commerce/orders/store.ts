/**
 * Tiny key-value store with compare-and-set, used for orders, stock holds and
 * webhook de-duplication. Two implementations:
 *  - Netlify Blobs (deploy previews): durable, encrypted at rest, private to the site.
 *  - In-memory (unit tests and `next dev`): NOT durable — fine for local testing only.
 *
 * Conditional writes ("create only if new", "replace only if unchanged") are
 * what make duplicate webhook deliveries and concurrent checkouts safe.
 */

export interface Versioned<T> {
  value: T;
  etag: string;
}

export interface KvStore {
  readonly durable: boolean;
  get<T>(key: string): Promise<Versioned<T> | null>;
  /** Writes only if the key does not exist. Returns false if it already existed. */
  create<T>(key: string, value: T): Promise<boolean>;
  /** Writes only if the stored etag still matches. Returns false on a conflict. */
  replace<T>(key: string, value: T, etag: string): Promise<boolean>;
}

export class ConflictError extends Error {
  constructor(key: string) {
    super(`Too many concurrent updates for ${key}`);
  }
}

/**
 * Read-modify-write with optimistic concurrency. `fn` receives the current
 * value (or null) and returns the next value, or `undefined` to leave it as is.
 */
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
    const written = current ? await store.replace(key, next, current.etag) : await store.create(key, next);
    if (written) return { value: next, changed: true };
  }
  throw new ConflictError(key);
}

export class MemoryKvStore implements KvStore {
  readonly durable = false;
  private data = new Map<string, { json: string; version: number }>();
  private counter = 0;

  async get<T>(key: string): Promise<Versioned<T> | null> {
    const entry = this.data.get(key);
    return entry ? { value: JSON.parse(entry.json) as T, etag: String(entry.version) } : null;
  }

  async create<T>(key: string, value: T): Promise<boolean> {
    if (this.data.has(key)) return false;
    this.data.set(key, { json: JSON.stringify(value), version: ++this.counter });
    return true;
  }

  async replace<T>(key: string, value: T, etag: string): Promise<boolean> {
    const entry = this.data.get(key);
    if (!entry || String(entry.version) !== etag) return false;
    this.data.set(key, { json: JSON.stringify(value), version: ++this.counter });
    return true;
  }

  /** Test helper. */
  keys(): string[] {
    return [...this.data.keys()];
  }
}

/** Netlify Blobs-backed store with strong consistency. Server-only. */
export async function createBlobsKvStore(name: string): Promise<KvStore> {
  const { getStore } = await import("@netlify/blobs");
  const store = getStore({ name, consistency: "strong" });
  return {
    durable: true,
    async get<T>(key: string) {
      const result = await store.getWithMetadata(key, { type: "json" });
      if (!result || !result.etag) return null;
      return { value: result.data as T, etag: result.etag };
    },
    async create<T>(key: string, value: T) {
      const { modified } = await store.setJSON(key, value, { onlyIfNew: true });
      return modified;
    },
    async replace<T>(key: string, value: T, etag: string) {
      const { modified } = await store.setJSON(key, value, { onlyIfMatch: etag });
      return modified;
    },
  };
}

let memorySingleton: MemoryKvStore | null = null;

/**
 * The store used by the Stripe TEST integration. Netlify Blobs on deploy
 * previews (Netlify injects credentials); in-memory under `next dev`.
 */
export async function getTestOrderStore(): Promise<KvStore> {
  // BUILD_CONTEXT is frozen at build time (next.config.ts); runtime-only Netlify vars aren't reliable.
  if (process.env.BUILD_CONTEXT === "deploy-preview") return createBlobsKvStore("stripe-test-orders");
  memorySingleton ??= new MemoryKvStore();
  return memorySingleton;
}
