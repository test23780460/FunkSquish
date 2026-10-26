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
    lookFor: ["Consistent quality and documented fillings", "Third-party testing and a CPC", "Sample costs, MOQs and lead times", "Straight answers on water beads and recalls"],
  },
  {
    id: "wholesale-supplier",
    name: "Wholesale suppliers",
    short: "Wholesale supplier",
    blurb: "Wholesalers and trading companies offering ready-made squishies and collectibles.",
    lookFor: ["Authorized, original products", "SKU pricing, MOQs and mixed cases", "Sample costs and U.S. shipping times", "Permission to sell on our site and TikTok"],
  },
  {
    id: "dropship",
    name: "Dropshipping & fulfillment",
    short: "Dropship / fulfillment partner",
    blurb: "Partners who can ship orders to U.S. customers on our behalf, or warehouse and pack for us.",
    lookFor: ["Works with a custom (non-Shopify) store", "Inventory syncing and tracking", "Blind shipping", "Clear fees, returns and refunds"],
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
    name: "Future resellers & distributors",
    short: "Future reseller / distributor",
    blurb: "Shops and distributors who'd like to carry FunkSquish later. We don't have a wholesale program yet, so this registers your interest.",
    lookFor: ["Where you sell today", "The region you'd cover", "No commitment on either side"],
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
  /** A checkbox option that can't be ticked together with others (e.g. "None yet"). */
  exclusive?: string;
  hint?: string;
  autoComplete?: string;
  placeholder?: string;
}

/** Types that would supply physical products to us. */
const SUPPLY: PartnerType[] = ["manufacturer", "wholesale-supplier", "dropship"];
/** Types whose products or designs we might sell. */
const SELLABLE: PartnerType[] = [...SUPPLY, "brand", "designer"];

export const WATER_BEAD_OPTIONS = ["No — none of our products do", "Yes — sealed inside the product", "Yes — loose, or they could come loose", "Not sure"] as const;
export const RESELLER_ACK =
  "I understand FunkSquish doesn't have a wholesale program yet. This is a note of future interest — not an account, an order or a price quote.";

export const PARTNER_FIELDS: FieldDef[] = [
  // --- About you (all types)
  { name: "name", label: "Your name", kind: "text", required: true, max: 100, autoComplete: "name" },
  { name: "email", label: "Work email", kind: "email", required: true, max: 254, autoComplete: "email", hint: "We'll reply here. Please use a business address if you have one." },
  { name: "business", label: "Business or brand name", kind: "text", required: true, max: 120, autoComplete: "organization" },
  { name: "website", label: "Website or catalog link", kind: "url", required: true, max: 300, placeholder: "https://", hint: "Your site, online catalog, Alibaba store or portfolio." },
  { name: "country", label: "Country (and state/province)", kind: "text", required: true, max: 100, autoComplete: "country-name" },

  // --- Future resellers: say up front that this is interest only
  { name: "interestAck", label: "Please confirm", kind: "checkboxes", required: true, max: 1, options: [RESELLER_ACK], types: ["reseller"] },

  // --- Products
  { name: "categories", label: "Product categories", kind: "checkboxes", max: 9, options: PRODUCT_CATEGORIES, types: SELLABLE },
  { name: "examples", label: "Product examples or SKU / catalog links", kind: "textarea", max: 1000, types: SUPPLY, hint: "Links or SKU numbers are perfect. Prices go in the next section." },

  // --- Pricing & ordering
  {
    name: "skuPricing", label: "Pricing by SKU", kind: "textarea", max: 1500, types: SUPPLY,
    placeholder: "e.g. JB-01 jelly bear: $0.85 at 100 pcs, $0.70 at 500 pcs (USD, FOB Ningbo)",
    hint: "A few SKUs with the unit price at each quantity tier, the currency, and whether prices are EXW, FOB or delivered.",
  },
  { name: "moq", label: "Minimum order (MOQ)", kind: "text", max: 200, types: ["manufacturer", "wholesale-supplier"], placeholder: "e.g. 100 pcs per SKU" },
  { name: "mixedCase", label: "Mixed cases", kind: "select", max: 60, types: ["wholesale-supplier"], options: ["Yes — any SKUs can be mixed", "Yes — within a series or assortment", "No — full cases per SKU only", "Not sure"] },
  { name: "samples", label: "Samples", kind: "select", max: 60, types: SUPPLY, options: ["Free samples", "Paid samples, credited on the first order", "Paid samples", "No samples", "Not sure"] },
  { name: "sampleCost", label: "Sample cost and sample shipping", kind: "text", max: 200, types: SUPPLY, placeholder: "e.g. $20 + $35 express shipping" },
  { name: "leadTime", label: "Production lead time", kind: "text", max: 120, types: ["manufacturer"], placeholder: "e.g. 25–30 days" },
  { name: "turnaround", label: "Order turnaround (in-stock items)", kind: "text", max: 120, types: ["wholesale-supplier", "dropship"], placeholder: "e.g. ships in 1–2 business days" },
  { name: "custom", label: "Custom / OEM designs", kind: "select", max: 40, types: ["manufacturer"], options: ["Yes", "No", "Limited"] },

  // --- Shipping
  { name: "fulfillment", label: "Where orders ship from", kind: "select", max: 60, types: ["wholesale-supplier", "dropship"], options: ["Ship from U.S. warehouse", "Ship from overseas warehouse", "Bulk freight to us", "Mixed", "Other"] },
  { name: "shippingEstimate", label: "Shipping cost estimate to the U.S.", kind: "text", max: 200, types: SUPPLY, placeholder: "e.g. about $4/kg by air" },
  { name: "usShipping", label: "U.S. delivery time", kind: "text", max: 120, types: SUPPLY, placeholder: "e.g. 7–12 business days" },

  // --- Dropshipping & order handling
  { name: "subscriptionFee", label: "Subscription or monthly fee", kind: "text", max: 120, types: ["dropship"], placeholder: "e.g. none, or $29 a month" },
  { name: "perOrderFee", label: "Per-order fees", kind: "text", max: 160, types: ["dropship"], placeholder: "e.g. $1.50 pick & pack", hint: "Any fees on top of the product and shipping cost." },
  { name: "orderMethods", label: "How we could send you orders", kind: "checkboxes", max: 5, types: ["dropship"], options: ["Manual orders (email, sheet or dashboard)", "CSV upload", "API", "Shopify or another store app", "Other"] },
  {
    name: "customStore", label: "Can you work with a custom-built store?", kind: "select", max: 60, types: ["dropship"],
    options: ["Yes — through your API or webhooks", "Yes — by CSV or manual orders", "Only through Shopify or another platform", "Not sure"],
    hint: "Our shop is a custom Next.js website, not Shopify.",
  },
  { name: "inventorySync", label: "Inventory syncing", kind: "select", max: 60, types: ["dropship"], options: ["Real-time API", "Scheduled feed (CSV, XML or sheet)", "Manual updates by email", "No inventory syncing", "Not sure"] },
  { name: "blindShipping", label: "Blind (unbranded) shipping", kind: "select", max: 70, types: ["dropship"], options: ["Yes — no supplier branding, invoices or prices in the parcel", "Yes — and custom inserts or packaging are possible", "No", "Not sure"] },
  { name: "tracking", label: "Tracking numbers", kind: "select", max: 60, types: ["dropship"], options: ["Every order, synced automatically", "Every order, sent manually", "Some shipping methods only", "No tracking", "Not sure"] },
  {
    name: "returnsRefunds", label: "Returns, refunds and damaged parcels", kind: "textarea", max: 800, types: ["dropship"],
    hint: "Is there a U.S. return address? Who pays return shipping? How are lost or damaged parcels refunded or reshipped?",
  },

  // --- Product safety
  { name: "ageGrade", label: "Age grade on the packaging", kind: "select", max: 40, types: SUPPLY, options: ["Ages 3+", "Ages 6+ or 8+", "Ages 13+ or 14+", "Varies by product", "No age grade", "Not sure"] },
  { name: "materials", label: "Materials and fillings", kind: "checkboxes", max: 9, types: SUPPLY, options: ["PU foam (slow-rise)", "TPR / jelly", "Silicone", "Gel or liquid filling", "Beads or pellets", "Sand, grains or powder", "Water beads", "Other", "Not sure"] },
  {
    name: "fillingDetail", label: "What's inside, exactly?", kind: "textarea", max: 600, types: SUPPLY,
    placeholder: "e.g. TPR shell with a mineral-oil gel filling, no beads",
    hint: "The filling composition of your main products. Safety data sheets can come later.",
  },
  {
    name: "waterBeads", label: "Do any of your products contain water beads (expanding polymer beads)?", kind: "select", required: true, max: 60, types: SUPPLY, options: WATER_BEAD_OPTIONS,
    hint: "We ask because the U.S. Consumer Product Safety Commission has warned that water beads can cause serious harm if swallowed.",
  },
  { name: "recalls", label: "Any recalls or serious safety complaints in the last 5 years?", kind: "select", required: true, max: 20, types: SUPPLY, options: ["No", "Yes", "Not sure"], hint: "For any product you make or sell." },
  { name: "recallDetail", label: "If yes: which product, and what happened?", kind: "textarea", max: 600, types: SUPPLY, hint: "A link to the recall notice is perfect." },
  {
    name: "cpc", label: "Children's Product Certificate (CPC)", kind: "select", required: true, max: 40, types: SUPPLY, options: ["Yes — for every product", "For some products", "Not yet", "Not sure what this is"],
    hint: "Children's products sold in the U.S. need testing by a CPSC-accepted lab and a CPC. You don't need to attach anything now.",
  },
  { name: "testing", label: "Independent lab reports you can share", kind: "checkboxes", max: 6, types: SUPPLY, options: ["ASTM F963 (U.S. toy safety)", "Lead content", "Phthalates", "EN 71 (EU)", "Other", "None yet"], exclusive: "None yet" },
  { name: "testLab", label: "Testing lab and report date", kind: "text", max: 160, types: SUPPLY, placeholder: "e.g. lab name, March 2026" },

  // --- Where we may sell
  {
    name: "authorizedChannels", label: "Where would you allow FunkSquish to sell your products?", kind: "checkboxes", required: true, max: 6, types: SELLABLE,
    options: ["FunkSquish website (funksquish.com)", "TikTok Shop", "TikTok LIVE selling", "Social posts and videos", "Other marketplaces (e.g. Amazon, Etsy)", "Need to discuss first"],
    hint: "Tick every channel you'd authorize. Nothing is agreed until we both sign.",
  },
  { name: "authorizationProof", label: "Can you show you're authorized to sell these products?", kind: "select", max: 60, types: ["wholesale-supplier", "dropship"], options: ["We make them or own the rights", "Yes — we have a distributor or authorization letter", "No", "Not sure"] },
  { name: "channelLimits", label: "Any limits we should know about?", kind: "text", max: 300, types: SELLABLE, placeholder: "e.g. U.S. only, no Amazon" },

  // --- Brands & designers
  { name: "collab", label: "Kind of collaboration", kind: "select", max: 60, types: ["brand", "designer"], options: ["Licensing", "Co-branded drop", "Design commission", "Other"] },
  { name: "portfolio", label: "Portfolio or brand deck link", kind: "url", max: 300, types: ["brand", "designer"], placeholder: "https://" },
  { name: "rights", label: "Do you own the rights to the designs?", kind: "select", max: 40, types: ["brand", "designer"], options: ["Yes, fully", "Partly / licensed", "Not sure"] },

  // --- Future resellers & distributors
  { name: "channels", label: "Where you sell today", kind: "text", max: 200, types: ["reseller"], placeholder: "e.g. gift shop, Etsy, markets" },
  { name: "region", label: "Region you'd like to cover", kind: "text", max: 120, types: ["reseller"] },
  { name: "volume", label: "Rough size of a first order, if wholesale opens", kind: "select", max: 40, types: ["reseller"], options: ["Small (under 50 units)", "Medium (50–250 units)", "Large (250+ units)", "Not sure yet"], hint: "No commitment — it just helps us plan." },

  // --- Everyone
  { name: "message", label: "Anything else we should know?", kind: "textarea", max: 2000 },
];

/** How the form (and the private review page) groups the questions. */
export const FIELD_GROUPS: { id: string; title: string; intro?: string; fields: string[] }[] = [
  { id: "about", title: "About you and your business", fields: ["name", "email", "business", "website", "country"] },
  {
    id: "interest",
    title: "Future wholesale interest",
    intro: "We don't offer wholesale accounts, pricing or stock yet. Tell us about your shop and we'll get in touch if and when a wholesale program opens.",
    fields: ["interestAck", "channels", "region", "volume"],
  },
  { id: "products", title: "Your products", fields: ["categories", "examples"] },
  { id: "pricing", title: "Pricing and ordering", intro: "Rough numbers are fine. Only FunkSquish's owner sees what you share here.", fields: ["skuPricing", "moq", "mixedCase", "samples", "sampleCost", "leadTime", "turnaround", "custom"] },
  { id: "shipping", title: "Shipping to the U.S.", fields: ["fulfillment", "shippingEstimate", "usShipping"] },
  {
    id: "dropship",
    title: "Orders, stock and returns",
    intro: "We'd connect you to our own website, so we'd like to know how orders, stock levels and tracking would flow.",
    fields: ["subscriptionFee", "perOrderFee", "orderMethods", "customStore", "inventorySync", "blindShipping", "tracking", "returnsRefunds"],
  },
  { id: "safety", title: "Product safety", intro: "Squishies are loved by kids, so we check safety before anything else.", fields: ["ageGrade", "materials", "fillingDetail", "waterBeads", "recalls", "recallDetail", "cpc", "testing", "testLab"] },
  { id: "channels", title: "Where we may sell", intro: "We'll only ever sell your products where you allow it.", fields: ["authorizedChannels", "authorizationProof", "channelLimits"] },
  { id: "collab", title: "Collaboration", fields: ["collab", "portfolio", "rights"] },
  { id: "else", title: "Anything else", fields: ["message"] },
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
