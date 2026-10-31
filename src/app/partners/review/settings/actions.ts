"use server";

import { redirect } from "next/navigation";
import { requireReviewer } from "@/lib/partners/review-auth";
import { ownerTools, pruneAudit } from "@/lib/owner/data";
import { applyRestore, environmentName, planRestore, type OwnerBackup } from "@/lib/owner/backup";

/*
 * Owner-only settings actions. Server actions are public endpoints, so each
 * one re-checks the fully signed-in owner (passphrase + two-step code once
 * set up) before anything else. Next.js also rejects actions posted from
 * another site (Origin check), and the session cookie is SameSite=strict.
 */

const BASE = "/partners/review/settings";
const MAX_BACKUP_BYTES = 4 * 1024 * 1024;
const back = (q: Record<string, string>) => `${BASE}?${new URLSearchParams(q).toString()}#backup`;

async function context() {
  const ctx = await requireReviewer();
  if (!ctx) redirect("/partners/review");
  return { ctx, tools: await ownerTools(ctx) };
}

export async function restoreBackupAction(fd: FormData) {
  const { ctx, tools } = await context();
  if (!(await tools.allow("restore", 10, 60 * 60))) redirect(back({ error: "Too many restores in an hour. Try again later." }));
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) redirect(back({ error: "Choose a backup file." }));
  if (file.size > MAX_BACKUP_BYTES) redirect(back({ error: "That file is too big for a dashboard backup (4 MB max)." }));
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    redirect(back({ error: "That file isn't valid JSON." }));
  }
  const env = environmentName(ctx.cfg);
  const plan = await planRestore(tools.data, parsed, env);
  if (!plan.ok) redirect(back({ error: plan.error }));
  const summary = `${plan.add.length} missing, ${plan.differ.length} different, ${plan.same.length} unchanged`;
  if (fd.get("intent") !== "restore") redirect(back({ ok: `Check only — nothing written. The backup has ${summary}.` }));
  if (String(fd.get("confirm") ?? "").trim() !== "RESTORE") redirect(back({ error: "Type RESTORE to write changes. Nothing was written." }));
  const overwrite = fd.get("overwrite") === "yes";
  const r = await applyRestore(tools.data, parsed as OwnerBackup, plan, overwrite);
  await tools.audit("settings", "restore", null, `Restored a backup: ${r.added} added, ${r.replaced} replaced (${summary}).`);
  redirect(back({ ok: `Restored: ${r.added} record(s) added, ${r.replaced} replaced. Nothing was deleted.` }));
}

export async function pruneAuditAction() {
  const { tools } = await context();
  if (!(await tools.allow("prune", 10, 60 * 60))) redirect(`${BASE}?error=${encodeURIComponent("Try again later.")}`);
  const n = await pruneAudit(tools.data);
  await tools.audit("settings", "prune-audit", null, `Removed ${n} activity entries older than 2 years.`);
  redirect(`${BASE}?ok=${encodeURIComponent(`Removed ${n} old activity entr${n === 1 ? "y" : "ies"}.`)}`);
}
