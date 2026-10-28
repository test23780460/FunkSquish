import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: ({ name }: { name: string }) => void jar.delete(name),
  }),
  headers: async () => new Headers({ "x-nf-client-connection-ip": "198.51.100.30" }),
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

const { loginAction, updateStatusAction, runCleanupAction } = await import("@/app/partners/review/actions");
const sec = await import("@/app/partners/review/security/actions");
const { adjustAction } = await import("@/app/partners/review/inventory/actions");
const { reconcileAction } = await import("@/app/partners/review/orders/actions");
const { requireReviewer } = await import("@/lib/partners/review-auth");
const { ownerAuth, ownerSecurityStore, loadAuthState, pendingSecret, mfaRequired, activeEnrollment } = await import("@/lib/owner/auth");
const { totpAt, base32Encode } = await import("@/lib/owner/totp");
const { decryptSecret } = await import("@/lib/owner/mfa-crypto");
const { hashPassphrase, SESSION_COOKIE } = await import("@/lib/partners/security");
const { getTestOrderStore } = await import("@/commerce/orders/store");
const { getLedger } = await import("@/commerce/orders/inventory");
const { resetMemoryStores, SECRET } = await import("../partners/helpers");

const PASS = "four random squishy words";
const fd = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};
const go = async (p: Promise<unknown>) => {
  try {
    return { value: await p, url: null as string | null };
  } catch (e) {
    if (e instanceof Redirect) return { value: null, url: e.url };
    throw e;
  }
};
const store = () => ownerSecurityStore({ storage: "memory", storeSuffix: "-dev" });
const login = async () => (await go(loginAction({ error: null }, fd({ passphrase: PASS })))).url;
const logs: string[] = [];

let clock = Date.parse("2026-10-27T15:00:00Z");
const tick = (ms: number) => vi.setSystemTime((clock += ms));

/** The secret the app would hold (read straight from the store, as a test only can). */
async function appSecret(): Promise<Buffer> {
  const s = await loadAuthState(await store());
  if (s.enrollment) return decryptSecret(SECRET, s.enrollment.secret, s.enrollment.id)!;
  return pendingSecret(s, SECRET)!;
}
const code = async () => totpAt(await appSecret(), Date.now());

async function enroll(): Promise<string[]> {
  expect((await go(sec.startEnrollmentAction())).url).toBe("/partners/review/security?step=scan");
  const r = (await sec.confirmEnrollmentAction({ error: null, codes: null }, fd({ code: await code() }))) as { codes: string[] };
  expect(r.codes).toHaveLength(10);
  tick(31_000); // next time step
  return r.codes;
}

/** Every owner action a partial (passphrase-only) session might try. */
const sensitive = () => [
  adjustAction(fd({ variant: "test-var-jelly-blue", kind: "tiktok-sale", quantity: "1", requestId: randomUUID() })),
  updateStatusAction(fd({ id: "FS-P-20261027-ABCDEFGH", status: "approved" })),
  runCleanupAction(fd({})),
  reconcileAction(),
  sec.startEnrollmentAction(),
  sec.signOutEverywhereAction(),
];

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  clock = Date.parse("2026-10-27T15:00:00Z");
  vi.setSystemTime(clock);
  resetMemoryStores();
  delete (globalThis as { __fsOwnerSecurityStore?: unknown }).__fsOwnerSecurityStore;
  delete (globalThis as { __funksquishTestOrderStore?: unknown }).__funksquishTestOrderStore;
  jar.clear();
  logs.length = 0;
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("PARTNER_DEV_MEMORY_STORE", "true");
  vi.stubEnv("PARTNER_SECRET", SECRET);
  vi.stubEnv("PARTNER_REVIEW_PASSPHRASE_HASH", await hashPassphrase(PASS, 16384));
  for (const level of ["info", "warn", "error", "log"] as const) vi.spyOn(console, level).mockImplementation((...a: unknown[]) => void logs.push(a.map(String).join(" ")));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("draft: no lock-out before two-step sign-in is set up", () => {
  it("the passphrase alone still works while it's off and not required", async () => {
    expect(await login()).toBe("/partners/review/today");
    expect(await requireReviewer()).not.toBeNull();
    expect((await ownerAuth())?.status).toBe("full");
  });
});

describe("setting it up", () => {
  it("needs a verified first code, then returns ten one-time recovery codes", async () => {
    await login();
    await go(sec.startEnrollmentAction());
    expect((await sec.confirmEnrollmentAction({ error: null, codes: null }, fd({ code: "000000" }))).error).toMatch(/didn't match/);
    expect(activeEnrollment(await loadAuthState(await store()))).toBeNull();
    const r = await sec.confirmEnrollmentAction({ error: null, codes: null }, fd({ code: await code() }));
    expect(r.codes).toHaveLength(10);
    expect((await ownerAuth())?.status).toBe("full"); // this device continues
    const state = await loadAuthState(await store());
    expect(JSON.stringify(state)).not.toContain(r.codes![0]); // stored hashed
    expect(JSON.stringify(state)).not.toContain(base32Encode(await appSecret())); // stored encrypted
  });

  it("the setup key expires after 15 minutes", async () => {
    await login();
    await go(sec.startEnrollmentAction());
    const c = await code();
    tick(16 * 60_000);
    expect((await sec.confirmEnrollmentAction({ error: null, codes: null }, fd({ code: c }))).error).toMatch(/expired/);
  });

  it("signs out every other device", async () => {
    await login();
    const otherDevice = jar.get(SESSION_COOKIE)!;
    await enroll();
    jar.set(SESSION_COOKIE, otherDevice);
    expect(await ownerAuth()).toBeNull();
    for (const p of sensitive()) expect((await go(p)).url).toBe("/partners/review");
  });
});

describe("signing in with two steps", () => {
  it("the passphrase alone reaches only the code page — every action refuses", async () => {
    await login();
    await enroll();
    jar.clear();
    expect(await login()).toBe("/partners/review/verify");
    expect((await ownerAuth())?.status).toBe("needs-mfa");
    expect(await requireReviewer()).toBeNull();
    for (const p of sensitive()) expect((await go(p)).url).toBe("/partners/review");
    expect(await getLedger(await getTestOrderStore(), "test-var-jelly-blue")).toBeNull();
  });

  it("a wrong code is refused; the right code completes sign-in; the same code can't be reused", async () => {
    await login();
    await enroll();
    jar.clear();
    await login();
    expect((await sec.verifyMfaAction({ error: null }, fd({ code: "123456" }))).error).toMatch(/didn't work/);
    const c = await code();
    expect((await go(sec.verifyMfaAction({ error: null }, fd({ code: c })))).url).toBe("/partners/review/today");
    expect(await requireReviewer()).not.toBeNull();
    jar.clear();
    await login();
    expect((await sec.verifyMfaAction({ error: null }, fd({ code: c }))).error).toMatch(/didn't work/); // replay
  });

  it("rate limits wrong codes and ends the session", async () => {
    await login();
    await enroll();
    jar.clear();
    await login();
    for (let i = 0; i < 5; i++) expect((await sec.verifyMfaAction({ error: null }, fd({ code: "000000" }))).error).toMatch(/didn't work/);
    expect((await sec.verifyMfaAction({ error: null }, fd({ code: await code() }))).error).toMatch(/Too many tries/);
    expect(jar.has(SESSION_COOKIE)).toBe(false);
  });

  it("the half-signed-in session expires after 10 minutes", async () => {
    await login();
    await enroll();
    jar.clear();
    await login();
    tick(11 * 60_000);
    expect(await ownerAuth()).toBeNull();
    expect((await go(sec.verifyMfaAction({ error: null }, fd({ code: await code() })))).url).toBe("/partners/review");
  });

  it("a recovery code works once", async () => {
    await login();
    const codes = await enroll();
    jar.clear();
    await login();
    expect((await go(sec.verifyMfaAction({ error: null }, fd({ code: codes[3].toLowerCase() })))).url).toBe("/partners/review/security?recovery=9");
    expect(await requireReviewer()).not.toBeNull();
    jar.clear();
    await login();
    expect((await sec.verifyMfaAction({ error: null }, fd({ code: codes[3] }))).error).toMatch(/didn't work/);
  });

  it("a forged 'second step done' cookie is refused", async () => {
    await login();
    await enroll();
    jar.clear();
    await login();
    const p = jar.get(SESSION_COOKIE)!.split(".");
    jar.set(SESSION_COOKIE, [p[0], p[1], "2", "anything", p[4], p[5], p[6]].join("."));
    expect(await ownerAuth()).toBeNull();
    expect(await requireReviewer()).toBeNull();
  });
});

describe("required mode (live checkout on, or OWNER_MFA_REQUIRED=true)", () => {
  it("is automatic when live checkout is enabled", () => {
    expect(mfaRequired({}, true)).toBe(true);
    expect(mfaRequired({ OWNER_MFA_REQUIRED: "true" }, false)).toBe(true);
    expect(mfaRequired({}, false)).toBe(false);
  });

  it("without setup, the owner can only set it up — no data", async () => {
    vi.stubEnv("OWNER_MFA_REQUIRED", "true");
    expect(await login()).toBe("/partners/review/security");
    expect((await ownerAuth())?.status).toBe("needs-enrollment");
    expect(await requireReviewer()).toBeNull();
    expect((await go(adjustAction(fd({ variant: "test-var-jelly-blue", kind: "tiktok-sale", quantity: "1", requestId: randomUUID() })))).url).toBe("/partners/review");
    await enroll();
    expect(await requireReviewer()).not.toBeNull();
  });
});

describe("changing credentials ends sessions", () => {
  it("sign out everywhere", async () => {
    await login();
    await enroll();
    const before = jar.get(SESSION_COOKIE)!;
    expect((await go(sec.signOutEverywhereAction())).url).toBe("/partners/review?signedout=everywhere");
    jar.set(SESSION_COOKIE, before);
    expect(await ownerAuth()).toBeNull();
  });

  it("changing the passphrase", async () => {
    await login();
    vi.stubEnv("PARTNER_REVIEW_PASSPHRASE_HASH", await hashPassphrase("a completely new passphrase", 16384));
    expect(await ownerAuth()).toBeNull();
  });

  it("turning two-step sign-in off needs a code and TURN OFF, and signs out everywhere", async () => {
    await login();
    await enroll();
    const before = jar.get(SESSION_COOKIE)!;
    expect((await sec.disableMfaAction({ error: null }, fd({ code: await code(), confirm: "nope" }))).error).toMatch(/TURN OFF/);
    expect((await sec.disableMfaAction({ error: null }, fd({ code: "000000", confirm: "TURN OFF" }))).error).toMatch(/didn't work/);
    expect((await go(sec.disableMfaAction({ error: null }, fd({ code: await code(), confirm: "TURN OFF" })))).url).toBe("/partners/review?signedout=mfa-off");
    jar.set(SESSION_COOKIE, before);
    expect(await ownerAuth()).toBeNull();
    expect((await loadAuthState(await store())).enrollment).toBeNull();
  });

  it("new recovery codes need an app code; the old ones stop working", async () => {
    await login();
    const old = await enroll();
    expect((await sec.regenerateCodesAction({ error: null, codes: null }, fd({ code: old[0] }))).error).toMatch(/6-digit/);
    const r = await sec.regenerateCodesAction({ error: null, codes: null }, fd({ code: await code() }));
    expect(r.codes).toHaveLength(10);
    tick(31_000);
    jar.clear();
    await login();
    expect((await sec.verifyMfaAction({ error: null }, fd({ code: old[1] }))).error).toMatch(/didn't work/);
    expect((await go(sec.verifyMfaAction({ error: null }, fd({ code: r.codes![0] })))).url).toContain("recovery=9");
  });
});

describe("locked out", () => {
  it("if the site secret changes, the stored secret can't be read — and the documented reset works", async () => {
    await login();
    await enroll();
    const id = (await loadAuthState(await store())).enrollment!.id;
    const secret = await appSecret();
    vi.stubEnv("PARTNER_SECRET", "a-rotated-server-secret-0123456789abcdefgh");
    jar.clear();
    await login();
    expect((await sec.verifyMfaAction({ error: null }, fd({ code: totpAt(secret, Date.now()) }))).error).toMatch(/can't be read/);
    vi.stubEnv("OWNER_MFA_RESET_ID", id);
    expect((await ownerAuth())?.status).toBe("full"); // break-glass: set up again after this
    expect((await go(sec.startEnrollmentAction())).url).toBe("/partners/review/security?step=scan");
  });
});

describe("nothing secret is logged", () => {
  it("logs say what happened, never codes or keys", async () => {
    await login();
    const codes = await enroll();
    const secret = base32Encode(await appSecret());
    jar.clear();
    await login();
    await sec.verifyMfaAction({ error: null }, fd({ code: "654321" }));
    const used = await code();
    await go(sec.verifyMfaAction({ error: null }, fd({ code: used })));
    const all = logs.join("\n");
    expect(all).toMatch(/mfa failed/);
    expect(all).toMatch(/mfa ok via app/);
    for (const s of [secret, used, "654321", PASS, ...codes, ...codes.map((c) => c.replace("-", ""))]) expect(all).not.toContain(s);
  });
});
