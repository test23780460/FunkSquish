import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Static guard: every owner page and every owner server action must check the
 * session itself (server actions are public endpoints). A new page or action
 * that forgets fails this test.
 */
const ROOT = path.resolve(__dirname, "../../src/app/partners/review");

function files(dir: string, name: (f: string) => boolean): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? files(p, name) : name(e.name) ? [p] : [];
  });
}

/** Exported async functions and the text of each one's body (up to the next export). */
function exportedFunctions(src: string): { name: string; body: string }[] {
  const re = /export async function (\w+)\s*\(/g;
  const hits = [...src.matchAll(re)];
  return hits.map((m, i) => ({ name: m[1], body: src.slice(m.index!, hits[i + 1]?.index ?? src.length) }));
}

// Entry points that run BEFORE a full session exists, each with its own check.
const PRE_AUTH: Record<string, RegExp> = {
  loginAction: /verifyPassphrase\(/, // checks the passphrase (rate limited)
  logoutAction: /cookies\(\)\)\.delete/, // only deletes the cookie
  verifyMfaAction: /ownerAuth\(\)/,
  startEnrollmentAction: /ownerAuth\(\)/,
  confirmEnrollmentAction: /ownerAuth\(\)/,
};

describe("owner area coverage", () => {
  const actionFiles = files(ROOT, (f) => f === "actions.ts");

  it("finds the owner action files", () => {
    expect(actionFiles.map((f) => path.relative(ROOT, f)).sort()).toEqual(["actions.ts", "inventory/actions.ts", "orders/actions.ts", "security/actions.ts"]);
  });

  it("every exported server action checks the owner session first", () => {
    for (const file of actionFiles) {
      const src = fs.readFileSync(file, "utf8");
      expect(src.startsWith('"use server"'), file).toBe(true);
      // A file-local helper counts only if it calls requireReviewer itself.
      const helperChecks = /async function context\(\)[\s\S]*?requireReviewer\(\)/.test(src);
      for (const fn of exportedFunctions(src)) {
        if (PRE_AUTH[fn.name]) {
          expect(PRE_AUTH[fn.name].test(fn.body), `${fn.name} lost its own check`).toBe(true);
          continue;
        }
        const first = fn.body.split("\n").slice(1, 4).join("\n"); // the check must come first
        const ok = /requireReviewer\(\)/.test(first) || (helperChecks && /await context\(\)/.test(first)) || /ownerAuth\(\)[\s\S]*status !== "full"/.test(fn.body.split("\n").slice(1, 4).join("\n"));
        expect(ok, `${path.relative(ROOT, file)}: ${fn.name} must check the owner session before anything else`).toBe(true);
      }
    }
  });

  it("every owner page checks the session before showing data", () => {
    const pages = files(ROOT, (f) => f === "page.tsx");
    expect(pages.length).toBeGreaterThanOrEqual(11);
    for (const p of pages) {
      const src = fs.readFileSync(p, "utf8");
      expect(/requireReviewer\(\)|ownerAuth\(\)/.test(src), path.relative(ROOT, p)).toBe(true);
      expect(src, path.relative(ROOT, p)).toMatch(/robots: \{ index: false, follow: false \}/);
      expect(src, path.relative(ROOT, p)).toMatch(/await connection\(\)/); // per-request, never a cached copy of private data
    }
  });
});
