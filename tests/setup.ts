import { vi } from "vitest";

/*
 * Tests run outside Next.js, where the "use cache" directive isn't compiled and
 * its helpers throw. Treat them as no-ops: cached functions just run.
 */
vi.mock("next/cache", async (orig) => ({
  ...(await orig<typeof import("next/cache")>()),
  cacheTag: () => {},
  cacheLife: () => {},
  updateTag: () => {},
  revalidateTag: () => {},
  revalidatePath: () => {},
}));

/* "server-only" refuses to load outside React Server Components; tests are server code. */
vi.mock("server-only", () => ({}));
