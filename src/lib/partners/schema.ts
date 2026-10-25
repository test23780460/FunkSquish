/**
 * Partner / distributor application — the single definition of the form,
 * shared by the public page (rendering + client checks) and the server
 * (strict validation). Client-safe: no secrets or storage here.
 */
export const PARTNER_TYPES = [
  {
    id: "manufacturer",
    name: "Manufacturers",
    short: "Manufacturer",
    blurb: "Factories and makers who produce squishies, slushie toys, jelly or crunchy textures, or collectibles.",
    lookFor: ["Consistent quality and safe materials", "Sample availability", "Clear MOQs and lead times", "Children's product safety documentation"],
  },
  {
    id: "wholesale-supplier",
    name: "Wholesale suppliers",
    short: "Wholesale supplier",
    blurb: "Wholesalers and trading companies offering ready-made squishies and collectibles.",
    lookFor: ["Authorized, original products", "Price tiers and mixed cases", "U.S. shipping times", "Resale permission (incl. TikTok Shop)"],
  },
  {
    id: "dropship",
    name: "Dropshipping & fulfillment",
    short: "Dropship / fulfillment partner",
    blurb: "Partners who can ship orders to U.S. customers on our behalf, or warehouse and pack for us.",
    lookFor: ["U.S. delivery times", "How orders are sent and tracked", "Packaging and returns", "Inventory accuracy"],
  },
  {
    id: "brand",
    name: "Brands & licensing",
    short: "Brand",
    blurb: "Toy and character brands interested in collaborations, licensing or co-branded drops.",
    lookFor: ["Brand fit with FunkSquish", "Collaboration ideas", "Rights you hold", "Timing"],
  },
  {
    id: "designer",
    name: "Independent designers",
    short: "Independent designer",
    blurb: "Artists and designers with original squishy or character designs.",
    lookFor: ["Original work you own", "A portfolio link", "The kind of collab you want"],
  },
  {
    id: "reseller",
    name: "Resellers & distributors",
    short: "Reseller / distributor",
    blurb: "Shops and distributors who'd like to sell FunkSquish products in the future.",
    lookFor: ["Where you sell", "Your region", "Expected volume"],
  },
] as const;

export type PartnerType = (typeof PARTNER_TYPES)[number]["id"];

export function isPartnerType(v: unknown): v is PartnerType {
  return PARTNER_TYPES.some((t) => t.id === v);
}

export const PRODUCT_CATEGORIES = [
  "Slushie & drink squishies",
  "Jelly / TPR squishies",
  "Crunchy squishies",
  "Slow-rise foam",
  "Mochi / buttery squishies",
  "Capsule & blind-box collectibles",
  "Plush & soft toys",
  "Packaging & accessories",
  "Other",
] as const;

export type FieldKind = "text" | "email" | "url" | "textarea" | "select" | "checkboxes";

export interface FieldDef {
  name: string;
  label: string;
  kind: FieldKind;
  /** Applies to these types; omitted = all types. */
  types?: PartnerType[];
  required?: boolean;
  max: number;
  options?: readonly string[];
  hint?: string;
  autoComplete?: string;
  placeholder?: string;
}

const PRODUCT_TYPES: PartnerType[] = ["manufacturer", "wholesale-supplier", "dropship"];

export const PARTNER_FIELDS: FieldDef[] = [
  // --- About you (all types)
  { name: "name", label: "Your name", kind: "text", required: true, max: 100, autoComplete: "name" },
  { name: "email", label: "Work email", kind: "email", required: true, max: 254, autoComplete: "email", hint: "We'll reply here. Please use a business address if you have one." },
  { name: "business", label: "Business or brand name", kind: "text", required: true, max: 120, autoComplete: "organization" },
  { name: "website", label: "Website or catalog link", kind: "url", required: true, max: 300, placeholder: "https://", hint: "Your site, online catalog, Alibaba store or portfolio." },
  { name: "country", label: "Country (and state/province)", kind: "text", required: true, max: 100, autoComplete: "country-name" },
  { name: "categories", label: "Product categories", kind: "checkboxes", max: 9, options: PRODUCT_CATEGORIES, types: ["manufacturer", "wholesale-supplier", "dropship", "brand", "designer"] },

  // --- Products & pricing (manufacturers, wholesale, dropship)
  { name: "examples", label: "Product examples or SKU / catalog links", kind: "textarea", max: 1000, types: PRODUCT_TYPES, hint: "Links or SKUs are perfect. Please don't paste price lists here — we'll ask if it's a fit." },
  { name: "moq", label: "Price tier / minimum order (MOQ)", kind: "text", max: 200, types: ["manufacturer", "wholesale-supplier"], placeholder: "e.g. MOQ 200 per design" },
  { name: "samples", label: "Samples or mixed cases", kind: "select", max: 40, types: ["manufacturer", "wholesale-supplier"], options: ["Samples available", "Mixed cases available", "Both", "Neither", "Not sure"] },
  { name: "leadTime", label: "Production lead time", kind: "text", max: 120, types: ["manufacturer"], placeholder: "e.g. 25–30 days after sample approval" },
  { name: "custom", label: "Custom / OEM designs", kind: "select", max: 40, types: ["manufacturer"], options: ["Yes", "No", "Limited"] },
  { name: "fulfillment", label: "Fulfillment method", kind: "select", max: 60, types: ["wholesale-supplier", "dropship"], options: ["Ship from U.S. warehouse", "Ship from overseas warehouse", "Bulk freight to us", "Mixed", "Other"] },
  { name: "usShipping", label: "Typical U.S. shipping / delivery time", kind: "text", max: 120, types: ["manufacturer", "wholesale-supplier", "dropship"], placeholder: "e.g. 5–8 business days to the U.S." },
  { name: "orderHandling", label: "How orders reach you", kind: "select", max: 40, types: ["dropship"], options: ["Manual (email / sheet)", "CSV upload", "API / app integration", "Other"] },
  { name: "packaging", label: "Packaging & returns", kind: "text", max: 200, types: ["dropship"], placeholder: "Plain packaging? Branded inserts? Returns address?" },
  { name: "resale", label: "U.S. resale & TikTok Shop permission", kind: "select", max: 60, types: ["wholesale-supplier", "dropship"], options: ["Allowed, incl. TikTok Shop", "Allowed, but not TikTok Shop", "Restricted — need to discuss", "Not sure"] },
  { name: "safetyDocs", label: "Safety / age-grade documentation", kind: "select", max: 60, types: ["manufacturer", "wholesale-supplier", "dropship"], options: ["Available (e.g. CPC, test reports)", "In progress", "Not yet", "Not sure"], hint: "Toys for kids sold in the U.S. need proper testing and a Children's Product Certificate. You don't need to attach anything now." },

  // --- Brands & designers
  { name: "collab", label: "Kind of collaboration", kind: "select", max: 60, types: ["brand", "designer"], options: ["Licensing", "Co-branded drop", "Design commission", "Other"] },
  { name: "portfolio", label: "Portfolio or brand deck link", kind: "url", max: 300, types: ["brand", "designer"], placeholder: "https://" },
  { name: "rights", label: "Do you own the rights to the designs?", kind: "select", max: 40, types: ["brand", "designer"], options: ["Yes, fully", "Partly / licensed", "Not sure"] },

  // --- Resellers & distributors
  { name: "channels", label: "Where you sell", kind: "text", max: 200, types: ["reseller"], placeholder: "e.g. gift shop in Louisville, Etsy, TikTok Shop, markets" },
  { name: "region", label: "Region you'd cover", kind: "text", max: 120, types: ["reseller"] },
  { name: "volume", label: "Expected order size", kind: "select", max: 40, types: ["reseller"], options: ["Small (under 50 units)", "Medium (50–250 units)", "Large (250+ units)", "Not sure yet"] },

  // --- Everyone
  { name: "message", label: "Anything else we should know?", kind: "textarea", max: 2000, hint: "Optional." },
];

export function fieldsFor(type: PartnerType): FieldDef[] {
  return PARTNER_FIELDS.filter((f) => !f.types || f.types.includes(type));
}

/** Shown next to the consent box and stored with each application (bump when the wording changes). */
export const CONSENT_VERSION = "2026-10-25";
export const CONSENT_TEXT =
  "I agree that FunkSquish may store this application and contact me about it, as described in the privacy notice below. This doesn't sign me up for marketing emails.";

export const STAGES = ["new", "under-review", "need-info", "approved", "declined"] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABELS: Record<Stage, string> = {
  new: "New",
  "under-review": "Under review",
  "need-info": "Need more info",
  approved: "Approved for follow-up",
  declined: "Declined",
};

export function isStage(v: unknown): v is Stage {
  return STAGES.includes(v as Stage);
}
