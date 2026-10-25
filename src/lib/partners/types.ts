import type { PartnerFields } from "./validate";
import type { PartnerType, Stage } from "./schema";

/** A stored application. PRIVATE — only ever shown in the owner's review area. */
export interface PartnerApplication {
  id: string;
  createdAt: string;
  updatedAt: string;
  type: PartnerType;
  status: Stage;
  fields: PartnerFields;
  consent: { version: string; at: string };
  /** Minimal audit data: a keyed hash of the IP (not the IP itself). */
  audit: { ipHash: string };
  notification: { status: "sent" | "failed" | "pending"; at?: string; code?: string };
  /** Owner's private notes. */
  notes: { at: string; text: string }[];
  history: { at: string; from: Stage | null; to: Stage }[];
}
