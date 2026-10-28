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

import {
  completeDeletionRequestAction,
  confirmActiveAction,
  createDeletionRequestAction,
  deleteApplicationAction,
  deletionExceptionAction,
  legalHoldAction,
  loginAction,
  releaseHoldAction,
  runCleanupAction,
  updateStatusAction,
} from "@/app/partners/review/actions";
import { listDeletionRequests } from "@/lib/partners/deletion-requests";
import { lastActivity } from "@/lib/partners/retention";
import { lastRuns } from "@/lib/partners/cleanup";
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

  it("retention and deletion-request actions also refuse without a session", async () => {
    const app = await seed();
    const stores = await partnerStores({ storage: "memory", storeSuffix: "-dev" });
    for (const p of [
      runCleanupAction(fd({})),
      legalHoldAction(fd({ id: app.id, reason: "x" })),
      confirmActiveAction(fd({ id: app.id })),
      createDeletionRequestAction(fd({ email: "b@b.co", receivedOn: new Date().toISOString().slice(0, 10) })),
    ])
      expect(await catchRedirect(p)).toBe("/partners/review");
    expect(await listDeletionRequests(stores.ops)).toEqual([]);
    expect((await lastRuns(stores.ops)).last).toBeNull();
    expect((await getApplication(stores.apps, app.id))?.legalHold).toBeUndefined();
  });

  it("handles a deletion request end to end without storing the requester's email", async () => {
    await catchRedirect(loginAction({ error: null }, fd({ passphrase: PASS })));
    const stores = await partnerStores({ storage: "memory", storeSuffix: "-dev" });
    const mine = await seed(); // email b@b.co
    const other = await createApplication(stores.apps, { type: "brand", fields: { business: "Other", email: "someone@else.co" }, consentVersion: "v" }, "hash");
    const today = new Date().toISOString().slice(0, 10);

    expect(await catchRedirect(createDeletionRequestAction(fd({ email: "not an email", receivedOn: today })))).toContain("error=email");
    expect(await catchRedirect(createDeletionRequestAction(fd({ email: "b@b.co", receivedOn: "2099-01-01" })))).toContain("error=date");
    const url = await catchRedirect(createDeletionRequestAction(fd({ email: "  B@B.CO ", receivedOn: today })));
    const [req] = await listDeletionRequests(stores.ops);
    expect(url).toBe(`/partners/review/requests?saved=${req.id}`);
    expect(req.matchedIds).toEqual([mine.id]);
    expect(Date.parse(req.dueAt) - Date.parse(req.receivedAt)).toBe(30 * 86_400_000);
    expect(JSON.stringify(req)).not.toContain("b@b.co");

    expect(await catchRedirect(completeDeletionRequestAction(fd({ id: req.id, confirm: "wrong" })))).toContain("error=confirm");
    expect(await getApplication(stores.apps, mine.id)).not.toBeNull();
    await catchRedirect(completeDeletionRequestAction(fd({ id: req.id, confirm: req.id })));
    expect(await getApplication(stores.apps, mine.id)).toBeNull();
    expect(await getApplication(stores.apps, other.id)).not.toBeNull();
    const [done] = await listDeletionRequests(stores.ops);
    expect(done).toMatchObject({ status: "completed", outcome: "Deleted 1 application(s)." });
    // Completed requests can't be turned into exceptions afterwards.
    expect(await catchRedirect(deletionExceptionAction(fd({ id: req.id, reason: "late" })))).toContain("error=reason");
  });

  it("a deletion request never deletes an application under legal hold", async () => {
    await catchRedirect(loginAction({ error: null }, fd({ passphrase: PASS })));
    const stores = await partnerStores({ storage: "memory", storeSuffix: "-dev" });
    const held = await seed(); // email b@b.co
    await catchRedirect(legalHoldAction(fd({ id: held.id, reason: "Supplier dispute — counsel advised keeping records" })));
    const today = new Date().toISOString().slice(0, 10);
    await catchRedirect(createDeletionRequestAction(fd({ email: "b@b.co", receivedOn: today })));
    const [req] = await listDeletionRequests(stores.ops);

    expect(await catchRedirect(completeDeletionRequestAction(fd({ id: req.id, confirm: req.id })))).toContain("error=held");
    expect(await getApplication(stores.apps, held.id)).not.toBeNull();
    const [still] = await listDeletionRequests(stores.ops);
    expect(still.status).toBe("open");
    expect(still.log.at(-1)?.text).toContain("legal hold");

    // After the hold is released, the same request completes normally.
    await catchRedirect(releaseHoldAction(fd({ id: held.id })));
    await catchRedirect(completeDeletionRequestAction(fd({ id: req.id, confirm: req.id })));
    expect(await getApplication(stores.apps, held.id)).toBeNull();
    expect((await listDeletionRequests(stores.ops))[0].status).toBe("completed");
  });

  it("legal holds and 'still working together' don't fake activity on other applications", async () => {
    await catchRedirect(loginAction({ error: null }, fd({ passphrase: PASS })));
    const stores = await partnerStores({ storage: "memory", storeSuffix: "-dev" });
    const app = await seed();
    const before = lastActivity((await getApplication(stores.apps, app.id))!).toISOString();
    expect(await catchRedirect(legalHoldAction(fd({ id: app.id, reason: "" })))).toContain("hold=reason");
    await catchRedirect(legalHoldAction(fd({ id: app.id, reason: "Ongoing dispute" })));
    let stored = (await getApplication(stores.apps, app.id))!;
    expect(stored.legalHold?.reason).toBe("Ongoing dispute");
    expect(lastActivity(stored).toISOString()).toBe(before);
    // Only approved partners can be confirmed as active.
    await catchRedirect(confirmActiveAction(fd({ id: app.id })));
    expect((await getApplication(stores.apps, app.id))!.relationshipConfirmedAt).toBeUndefined();
    await catchRedirect(releaseHoldAction(fd({ id: app.id })));
    stored = (await getApplication(stores.apps, app.id))!;
    expect(stored.legalHold).toBeUndefined();

    expect(await catchRedirect(runCleanupAction(fd({ dryRun: "true" })))).toBe("/partners/review?cleanup=dry-run");
    expect((await lastRuns(stores.ops)).last?.dryRun).toBe(true);
  });

  it("locks out repeated wrong passphrases", async () => {
    for (let i = 0; i < 5; i++) await loginAction({ error: null }, fd({ passphrase: `wrong ${i}` }));
    const r = await loginAction({ error: null }, fd({ passphrase: PASS }));
    expect(r.error).toMatch(/Too many attempts/);
    expect(jar.has(SESSION_COOKIE)).toBe(false);
  });
});
