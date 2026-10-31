import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

/**
 * Mutation tests for scripts/safeguards-check.mjs (PR #24 review): a launch
 * safeguard must not disappear just because someone deletes its file along
 * with the code that calls it. Each case copies the files the check reads
 * into a temporary folder, breaks one thing, and runs the real script there.
 * The launch switches stay off in every copy.
 */
const SCRIPT = path.resolve("scripts/safeguards-check.mjs");
const FILES = [
  "src/lib/features.ts",
  "src/commerce/checkout/environment.ts",
  "src/commerce/checkout/live.ts",
  "src/commerce/checkout/service.ts",
  "src/commerce/checkout/stripe.ts",
  "src/commerce/checkout/key-permissions.ts",
  "src/commerce/shipping-approval.ts",
  "src/lib/owner/mfa-gate.ts",
  "src/app/actions/partners.ts",
  "src/content/policies.ts",
  "src/app/privacy/page.tsx",
  "src/app/terms/page.tsx",
  "next.config.ts",
];

const dirs: string[] = [];
function copy(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fs-safeguards-"));
  dirs.push(dir);
  for (const f of FILES) {
    fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
    fs.copyFileSync(f, path.join(dir, f));
  }
  return dir;
}
afterEach(() => {
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

function run(dir: string): { ok: boolean; out: string } {
  try {
    return { ok: true, out: execFileSync(process.execPath, [SCRIPT, dir], { encoding: "utf8", stdio: "pipe" }) };
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string };
    return { ok: false, out: `${err.stdout ?? ""}${err.stderr ?? ""}` };
  }
}

const edit = (dir: string, f: string, fn: (s: string) => string) => fs.writeFileSync(path.join(dir, f), fn(fs.readFileSync(path.join(dir, f), "utf8")));

describe("safeguards check can't be bypassed by deleting a safeguard", () => {
  it("passes on an unchanged copy (switches off)", () => {
    const r = run(copy());
    expect(r.out).toContain("Launch safeguards check passed");
    expect(r.ok).toBe(true);
  });

  it("FAILS when key-permissions.ts is deleted together with its checkout gate (the reported bypass)", () => {
    const dir = copy();
    fs.rmSync(path.join(dir, "src/commerce/checkout/key-permissions.ts"));
    edit(dir, "src/commerce/checkout/service.ts", (s) =>
      s
        .replace(/import \{[^}]*\} from "\.\/key-permissions";\n/, "")
        .replace(/const keys = await keyPermissionsReady\(config\.secretKey, createStripeLiveClient\(config\)\);/, "const keys = { ready: true };"),
    );
    // Switches are still off: only the deletion should be caught.
    expect(fs.readFileSync(path.join(dir, "src/lib/features.ts"), "utf8")).toMatch(/commerce: false/);
    const r = run(dir);
    expect(r.ok).toBe(false);
    expect(r.out).toContain("src/commerce/checkout/key-permissions.ts is missing");
    expect(r.out).toContain("live checkout no longer waits for the Stripe key permission check");
  });

  it("FAILS when only the gate in service.ts is removed (file kept)", () => {
    const dir = copy();
    edit(dir, "src/commerce/checkout/service.ts", (s) => s.replace("return keys.ready;", "return true;"));
    const r = run(dir);
    expect(r.ok).toBe(false);
    expect(r.out).toContain("live checkout no longer waits for the Stripe key permission check");
  });

  it("FAILS when the Disputes: Read requirement is dropped from the list", () => {
    const dir = copy();
    edit(dir, "src/commerce/checkout/key-permissions.ts", (s) => s.replace(/\{ label: "Disputes: Read", probe: \(stripe\) => stripe\.disputes\.list\(\{ limit: 1 \}\) \}/, ""));
    expect(run(dir).out).toContain("no longer requires the Disputes: Read permission");
  });

  it.each(FILES)("FAILS when %s is deleted", (f) => {
    const dir = copy();
    fs.rmSync(path.join(dir, f));
    const r = run(dir);
    expect(r.ok, r.out).toBe(false);
    expect(r.out).toContain(`${f} is missing`);
  });
});

describe("the mutation list covers every file the check requires", () => {
  it("each required(...) file in the script is deleted by a test above", () => {
    const src = fs.readFileSync(SCRIPT, "utf8");
    const names = [...src.matchAll(/required\("([^"]+)"/g)].map((m) => m[1]);
    const templated = [...src.matchAll(/required\(`src\/app\/\$\{id\}\/page\.tsx`/g)].length ? ["src/app/privacy/page.tsx", "src/app/terms/page.tsx"] : [];
    expect([...names, ...templated].sort()).toEqual([...FILES].sort());
  });
});
