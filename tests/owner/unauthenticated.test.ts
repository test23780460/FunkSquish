import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

/**
 * Security check, run for real (not just reading the source): every owner
 * server action and every owner download, called by someone who isn't signed
 * in, must stop before touching any store — actions redirect to the sign-in
 * page, downloads answer 404 and are never cached.
 */
class Redirected extends Error {
  constructor(public to: string) {
    super(`redirect ${to}`);
  }
}
const touched: string[] = [];
const touch = (what: string) => () => {
  touched.push(what);
  throw new Error(`${what} was used without a session`);
};

vi.mock("next/navigation", () => ({ redirect: (to: string) => { throw new Redirected(to); }, notFound: () => { throw new Redirected("404"); } }));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("next/headers", () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }) }));
vi.mock("@/lib/partners/review-auth", () => ({ requireReviewer: async () => null }));
vi.mock("@/lib/owner/auth", async (orig) => ({ ...(await orig<typeof import("@/lib/owner/auth")>()), ownerAuth: async () => null }));
vi.mock("@/lib/owner/data", async (orig) => ({ ...(await orig<typeof import("@/lib/owner/data")>()), ownerDataStore: touch("owner data store"), ownerMediaStore: touch("owner media store"), ownerTools: touch("owner tools") }));
vi.mock("@/commerce/orders/inventory-context", () => ({ inventoryContext: touch("inventory/order store") }));
vi.mock("@/commerce/checkout/service", async (orig) => ({ ...(await orig<typeof import("@/commerce/checkout/service")>()), orderDeps: touch("order store") }));

const ROOT = path.resolve(__dirname, "../../src/app/partners/review");
function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)]));
}
const rel = (f: string) => path.relative(ROOT, f).split(path.sep).join("/");
const actionFiles = files(ROOT).filter((f) => /\.ts$/.test(f) && /^\s*["']use server["']/.test(fs.readFileSync(f, "utf8")));
const routeFiles = files(ROOT).filter((f) => f.endsWith("route.ts"));
/** These run before a session exists and have their own checks (passphrase rate limit, code check). */
const PRE_AUTH = new Set(["loginAction", "logoutAction", "verifyMfaAction", "startEnrollmentAction", "confirmEnrollmentAction"]);

describe("owner actions without a session", () => {
  it("finds the action files", () => expect(actionFiles.length).toBeGreaterThanOrEqual(9));

  it.each(actionFiles.map((f) => [rel(f), f]))("%s: every action redirects to sign-in and touches nothing", async (_name, file) => {
    const mod = (await import(/* @vite-ignore */ file)) as Record<string, unknown>;
    const fns = Object.entries(mod).filter(([n, v]) => typeof v === "function" && !PRE_AUTH.has(n) && /Action$/.test(n));
    expect(fns.length).toBeGreaterThan(0);
    for (const [name, fn] of fns) {
      touched.length = 0;
      const fd = new FormData();
      fd.set("id", "p_test12345");
      fd.set("rev", "1");
      fd.set("session", "cs_test_aaaaaaaaaaaa");
      let err: unknown;
      try {
        await (fn as (fd: FormData) => Promise<unknown>)(fd);
      } catch (e) {
        err = e;
      }
      expect(err, `${name} must redirect`).toBeInstanceOf(Redirected);
      expect(["/partners/review", "/partners/review/requests"], name).toContain((err as Redirected).to); // pages that show only the sign-in form
      expect(touched, `${name} touched storage`).toEqual([]);
    }
  });
});

describe("owner downloads without a session", () => {
  it.each(routeFiles.map((f) => [rel(f), f]))("%s answers 404, private, no-store", async (_name, file) => {
    touched.length = 0;
    const mod = (await import(/* @vite-ignore */ file)) as { GET: (req: Request, ctx: unknown) => Promise<Response> };
    const params = Promise.resolve({ id: "s_mock123456", doc: "aaaaaaaaaaaa", file: "0123456789abcdef0123456789abcdef.jpg" });
    const r = await mod.GET(new Request("https://funksquish.com/x?private=1"), { params });
    expect(r.status).toBe(404);
    expect(r.headers.get("cache-control")).toMatch(/no-store/);
    expect(touched).toEqual([]);
  });
});

describe("request forgery and caching", () => {
  it("server actions only accept same-site requests (no extra allowed origins)", () => {
    const cfg = fs.readFileSync("next.config.ts", "utf8");
    expect(cfg).not.toMatch(/allowedOrigins/);
  });
  it("the owner session cookie is HTTP-only, SameSite=strict and limited to the owner area", () => {
    const auth = fs.readFileSync("src/lib/owner/auth.ts", "utf8");
    expect(auth).toMatch(/httpOnly: true/);
    expect(auth).toMatch(/sameSite: "strict"/);
    expect(auth).toMatch(/path: "\/partners\/review"/);
  });
});
