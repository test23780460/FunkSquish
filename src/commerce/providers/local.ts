import type { Product } from "../types";
import data from "../data/products.json";
import { validateProducts } from "../validate";

/**
 * Real products, generated from the catalog template by
 * `npm run catalog:import` (see docs/CATALOG.md).
 *
 * This JSON is PUBLIC (it ships with the site). The import script writes
 * supplier costs and internal notes to the git-ignored `private/` folder instead.
 */
export const localProducts: Product[] = validateProducts(data as unknown);
