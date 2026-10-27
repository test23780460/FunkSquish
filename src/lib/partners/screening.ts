import { WATER_BEAD_OPTIONS, type PartnerType } from "./schema";
import type { PartnerFields } from "./validate";

/**
 * Safety and authorization flags for the private review page. Advisory only:
 * they point the owner at answers to look at closely and never approve,
 * decline or hide an application on their own.
 */
export interface ScreeningFlag {
  level: "serious" | "check";
  text: string;
}

const SUPPLY: PartnerType[] = ["manufacturer", "wholesale-supplier", "dropship"];

const list = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);

export function screeningFlags(type: PartnerType, fields: PartnerFields): ScreeningFlag[] {
  if (!SUPPLY.includes(type)) return [];
  const flags: ScreeningFlag[] = [];
  const beads = fields.waterBeads;
  const materials = list(fields.materials);
  const testing = list(fields.testing);

  if (beads === WATER_BEAD_OPTIONS[2]) flags.push({ level: "serious", text: "Says products contain loose water beads, or beads that could come loose." });
  else if (beads === WATER_BEAD_OPTIONS[1]) flags.push({ level: "serious", text: "Says products contain water beads sealed inside. Check what happens if one tears." });
  else if (beads === WATER_BEAD_OPTIONS[3]) flags.push({ level: "check", text: "Not sure whether products contain water beads." });
  if (materials.includes("Water beads") && beads === WATER_BEAD_OPTIONS[0]) flags.push({ level: "check", text: "Ticked water beads as a material but answered no to water beads. Ask which is right." });

  if (fields.recalls === "Yes") flags.push({ level: "serious", text: "Reports a recall or serious safety complaint in the last 5 years." });
  else if (fields.recalls === "Not sure") flags.push({ level: "check", text: "Not sure about recalls or safety complaints." });

  if (fields.cpc === "Not yet" || fields.cpc === "Not sure what this is") flags.push({ level: "check", text: "No Children's Product Certificate yet." });
  else if (fields.cpc === "For some products") flags.push({ level: "check", text: "CPC for some products only. Ask which ones." });

  if (testing.length === 0 || testing.includes("None yet")) flags.push({ level: "check", text: "No independent lab reports listed." });
  if (materials.length === 0 && !fields.fillingDetail) flags.push({ level: "check", text: "Didn't say what the products are filled with." });

  if (fields.authorizationProof === "No" || fields.authorizationProof === "Not sure") flags.push({ level: "check", text: "Can't yet show they're authorized to sell these products." });

  return flags;
}
