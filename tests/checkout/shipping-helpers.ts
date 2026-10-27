import type { CheckedLine } from "@/commerce/checkout/validate-cart";
import type { ShippingQuote } from "@/commerce/checkout/shipping-quote";

/** A checked cart line with sensible defaults (our own stock, test studio origin). */
export function checkedLine(over: Partial<CheckedLine> & Pick<CheckedLine, "variantId">): CheckedLine {
  return {
    productId: "p",
    sku: "SKU",
    name: "Squish",
    quantity: 1,
    unitAmount: 500,
    currency: "usd",
    fulfillmentSource: "in_house",
    fulfillmentOrigin: "test-studio",
    weightGrams: 120,
    statedProcessingDays: null,
    ...over,
  };
}

/** A shipping quote with one package per origin of the given lines, at a fixed made-up charge each. */
export function quoteFor(lines: CheckedLine[], centsPerPackage = 450): ShippingQuote {
  const origins = [...new Set(lines.map((l) => l.fulfillmentOrigin ?? "test-studio"))];
  const packages = origins.map((o) => {
    const inPkg = lines.filter((l) => (l.fulfillmentOrigin ?? "test-studio") === o);
    return {
      groupId: o,
      originId: o,
      source: inPkg[0].fulfillmentSource,
      label: o,
      variantIds: inPkg.map((l) => l.variantId),
      units: inPkg.reduce((n, l) => n + l.quantity, 0),
      packedGrams: null,
      cents: centsPerPackage,
      processingBusinessDays: inPkg[0].fulfillmentSource === "supplier" ? 3 : 2,
      militaryAddresses: true,
    };
  });
  return { packages, totalCents: packages.reduce((s, p) => s + p.cents, 0) };
}
