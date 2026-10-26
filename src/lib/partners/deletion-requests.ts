import "server-only";
import { randomBytes } from "node:crypto";
import { updateWithRetry, type KvStore } from "@/lib/storage/kv";
import { hashIdentifier } from "./security";
import { deleteApplication, listApplications, type PartnerStores } from "./store";
import { DELETION_ID, deletionDueAt, deletionKey, type DeletionRequest } from "./deletion";

/**
 * Owner workflow for "please delete my application" requests:
 * record the request (the email is hashed, never stored) → see which
 * applications match → delete them and close the request, or record a
 * documented legal exception. Deadline: 30 days after the request arrived.
 */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function newId(now: Date) {
  const suffix = Array.from(randomBytes(6), (b) => ALPHABET[b % ALPHABET.length]).join("");
  return `FS-D-${now.toISOString().slice(0, 10).replace(/-/g, "")}-${suffix}`;
}

const requesterHash = (secret: string, email: string) => hashIdentifier(secret, "deletion", email);

/** Application references whose email matches the request. */
export async function matchingApplications(stores: PartnerStores, secret: string, hash: string) {
  const apps = await listApplications(stores.apps);
  return apps.filter((a) => typeof a.fields.email === "string" && requesterHash(secret, a.fields.email) === hash);
}

export async function createDeletionRequest(stores: PartnerStores, secret: string, email: string, receivedAt: Date, now = new Date()) {
  const hash = requesterHash(secret, email);
  const matched = await matchingApplications(stores, secret, hash);
  for (let i = 0; i < 5; i++) {
    const req: DeletionRequest = {
      id: newId(receivedAt),
      receivedAt: receivedAt.toISOString(),
      dueAt: deletionDueAt(receivedAt).toISOString(),
      status: "open",
      requesterHash: hash,
      matchedIds: matched.map((a) => a.id),
      log: [{ at: now.toISOString(), text: `Request recorded. ${matched.length} matching application(s).` }],
    };
    if (await stores.ops.create(deletionKey(req.id), req)) return req;
  }
  throw new Error("Could not allocate a request id");
}

export async function listDeletionRequests(ops: KvStore) {
  const keys = await ops.list("deletion/");
  const all = await Promise.all(keys.map(async (k) => (await ops.get<DeletionRequest>(k))?.value));
  return all.filter((r): r is DeletionRequest => !!r).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}

export async function getDeletionRequest(ops: KvStore, id: string) {
  if (!DELETION_ID.test(id)) return null;
  return (await ops.get<DeletionRequest>(deletionKey(id)))?.value ?? null;
}

async function update(ops: KvStore, id: string, fn: (r: DeletionRequest) => DeletionRequest | undefined) {
  if (!DELETION_ID.test(id)) return null;
  const { value, changed } = await updateWithRetry<DeletionRequest>(ops, deletionKey(id), (r) => (r ? fn(r) : undefined));
  return changed ? value : null;
}

/** Deletes every application that matches now (re-checked at this moment) and closes the request. */
export async function completeDeletionRequest(stores: PartnerStores, secret: string, id: string, now = new Date()) {
  const req = await getDeletionRequest(stores.ops, id);
  if (!req || req.status !== "open") return null;
  const matched = await matchingApplications(stores, secret, req.requesterHash);
  for (const app of matched) await deleteApplication(stores.apps, app.id);
  const at = now.toISOString();
  return update(stores.ops, id, (r) => ({
    ...r,
    status: "completed",
    completedAt: at,
    matchedIds: matched.map((a) => a.id),
    outcome: matched.length ? `Deleted ${matched.length} application(s).` : "No matching application was found.",
    log: [...r.log, { at, text: matched.length ? `Deleted ${matched.map((a) => a.id).join(", ")}.` : "Closed: nothing matched." }],
  }));
}

/** A documented legal reason to keep the data for now. The request stays visible until closed. */
export async function recordDeletionException(ops: KvStore, id: string, reason: string, now = new Date()) {
  const text = reason.trim().slice(0, 300);
  if (!text) return null;
  const at = now.toISOString();
  return update(ops, id, (r) => (r.status === "completed" ? undefined : { ...r, status: "exception", exceptionReason: text, log: [...r.log, { at, text: `Legal exception recorded: ${text}` }] }));
}

/** Re-opens an exception once the reason no longer applies. */
export async function reopenDeletionRequest(ops: KvStore, id: string, now = new Date()) {
  const at = now.toISOString();
  return update(ops, id, (r) => (r.status !== "exception" ? undefined : { ...r, status: "open", log: [...r.log, { at, text: "Exception ended; request re-opened." }] }));
}

/** Matching applications for display (references, business names and stages only). */
export async function requestMatches(stores: PartnerStores, secret: string, req: DeletionRequest) {
  return (await matchingApplications(stores, secret, req.requesterHash)).map((a) => ({ id: a.id, business: String(a.fields.business ?? ""), status: a.status }));
}
