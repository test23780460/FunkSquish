import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: ({ name }: { name: string }) => void jar.delete(name),
  }),
  headers: async () => new Headers({ "x-nf-client-connection-ip": "198.51.100.20" }),
}));
class Redirect extends Error {
  constructor(public url: string) {
    super(url);
  }
}
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Redirect(url);
  },
}));

import { deleteApplicationAction, loginAction, updateStatusAction } from "@/app/partners/review/actions";
import { hashPassphrase, SESSION_COOKIE } from "@/lib/partners/security";
import { createApplication, getApplication, partnerStores } from "@/lib/partners/store";
import { resetMemoryStores, SECRET } from "./helpers";

const PASS = "four random squishy words";

async function seed() {
  const stores = await partnerStores({ storage: "memory", storeSuffix: "-dev" });
  return createApplication(stores.apps, { type: "brand", fields: { business: "B", email: "b@b.co" }, consentVersion: "v" }, "hash");
}
const fd = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};
const catchRedirect = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    if (e instanceof Redirect) return e.url;
    throw e;
  }
  return null;
};

describe("review actions", () => {
  beforeEach(async () => {
    resetMemoryStores();
    jar.clear();
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("PARTNER_DEV_MEMORY_STORE", "true");
    vi.stubEnv("PARTNER_SECRET", SECRET);
    vi.stubEnv("PARTNER_REVIEW_PASSPHRASE_HASH", await hashPassphrase(PASS, 16384));
    for (const level of ["info", "warn"] as const) vi.spyOn(console, level).mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("refuses to change or delete anything without a valid session", async () => {
    const app = await seed();
    jar.set(SESSION_COOKIE, "forged.token.value.sig");
    expect(await catchRedirect(updateStatusAction(fd({ id: app.id, status: "approved" })))).toBe("/partners/review");
    expect(await catchRedirect(deleteApplicationAction(fd({ id: app.id, confirm: app.id })))).toBe("/partners/review");
    const stores = await partnerStores({ storage: "memory", storeSuffix: "-dev" });
    expect((await getApplication(stores.apps, app.id))?.status).toBe("new");
  });

  it("signs in with the right passphrase, then allows changes", async () => {
    expect((await loginAction({ error: null }, fd({ passphrase: "wrong passphrase" }))).error).toMatch(/didn't match/);
    expect(jar.has(SESSION_COOKIE)).toBe(false);
    expect(await catchRedirect(loginAction({ error: null }, fd({ passphrase: PASS })))).toBe("/partners/review");
    expect(jar.has(SESSION_COOKIE)).toBe(true);

    const app = await seed();
    expect(await catchRedirect(updateStatusAction(fd({ id: app.id, status: "under-review", note: "call them" })))).toBe(`/partners/review/${app.id}?saved=1`);
    const stores = await partnerStores({ storage: "memory", storeSuffix: "-dev" });
    expect((await getApplication(stores.apps, app.id))?.status).toBe("under-review");

    // delete needs the typed reference
    expect(await catchRedirect(deleteApplicationAction(fd({ id: app.id, confirm: "nope" })))).toContain("delete=confirm");
    expect(await getApplication(stores.apps, app.id)).not.toBeNull();
    expect(await catchRedirect(deleteApplicationAction(fd({ id: app.id, confirm: app.id })))).toBe("/partners/review?deleted=1");
    expect(await getApplication(stores.apps, app.id)).toBeNull();
  });

  it("locks out repeated wrong passphrases", async () => {
    for (let i = 0; i < 5; i++) await loginAction({ error: null }, fd({ passphrase: `wrong ${i}` }));
    const r = await loginAction({ error: null }, fd({ passphrase: PASS }));
    expect(r.error).toMatch(/Too many attempts/);
    expect(jar.has(SESSION_COOKIE)).toBe(false);
  });
});
