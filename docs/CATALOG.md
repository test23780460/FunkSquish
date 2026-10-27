# Catalog: adding real products

Real products are managed in a spreadsheet and imported into the site. The repo is **public**, so private business data never goes in git.

```
templates/catalog-template.csv   ← blank template (committed)
private/catalog.csv              ← your real sheet (git-ignored)
private/catalog-internal.json    ← costs, suppliers, compliance (git-ignored, generated)
src/commerce/data/products.json  ← PUBLIC product data (committed, ships with the site)
```

## Workflow

```bash
copy templates\catalog-template.csv private\catalog.csv
```

1. Open `private/catalog.csv` in Excel or Google Sheets (export back to CSV). One row **per variant** (color/style); rows sharing a `product_slug` form one product. Delete the example row.
2. Import:

```bash
npm run catalog:import
```

3. Check launch readiness (add your real fee/shipping assumptions for margins):

```bash
npm run catalog:check -- --fee-pct=6 --ship=4.50
```

4. Export everything back to a sheet any time:

```bash
npm run catalog:export
```

While no product is `published`, the site keeps showing the illustrated preview samples. As soon as one product is `published`, the site switches to your real catalog.

## Columns

| Column | Public? | Notes |
| --- | --- | --- |
| `product_slug` | ✅ | URL name, e.g. `strawberry-slushie` (lowercase, dashes) |
| `product_name`, `short_description`, `description` | ✅ | Write from the real product — no invented claims |
| `category` | ✅ | `fruity-slushies`, `jelly-squishies`, `crunchy-squishies`, `cute-collectibles` |
| `publication` | ✅ | `draft` (hidden), `published`, `archived`. Start with `draft`. |
| `tags`, `featured_rank`, `art` | ✅ | Tags separated by `\|`. `art` = fallback illustration (`slushie`, `jelly`, `crunchy`, `capsule`) |
| `age_grade` | ✅ | Exactly as on the label/CPC, e.g. `Ages 3+` |
| `warnings` | ✅ | Exactly as printed; separate multiple with `\|` |
| `care_instructions` | ✅ | Product-specific care, `\|`-separated |
| `manufacturer_or_importer`, `country_of_origin` | ✅ | From the label |
| `material`, `fill`, `texture`, `size_description` | ✅ | Leave empty if not confirmed |
| `texture_types` | ✅ | Texture styles confirmed with a real sample, separated by `\|`: `soft`, `slow-rise`, `jelly`, `crunchy`, `buttery`. Shown on the product page and in the Squish Lab. Leave empty if not confirmed. |
| `media` | ✅ | `src::alt::width::height`, videos add `::video::poster.jpg`; items separated by `\|`. Put files in `public/products/<slug>/` — only our own photos/videos are accepted (no links to other sites). For a squeeze video, add captions as a `.vtt` file with the same name (e.g. `squeeze.mp4` + `squeeze.vtt`); the import picks it up. |
| `variant_sku` | ✅ | **Unique** per variant (e.g. `FS-SLUSH-STRAW`) |
| `variant_name`, `swatch_hex` | ✅ | Color name and `#rrggbb` |
| `price_usd`, `compare_at_usd` | ✅ | Leave empty until decided. Compare-at must be higher than price. |
| `inventory_tracked`, `inventory_available` | ✅ | `true` + real count. Unknown = empty. 0 = sold out. |
| `weight_grams`, `length_cm`, `width_cm`, `height_cm` | ✅ | Packed unit, for shipping |
| `external_purchase_url` | ✅ | TikTok Shop listing link (used in "external-links" mode) |
| `private_cost_per_unit_usd` | 🔒 | Landed cost per unit |
| `private_supplier_name`, `private_supplier_sku`, `private_supplier_reference` | 🔒 | |
| `private_invoice_ref` | 🔒 | Purchase invoice number/file |
| `private_compliance_status` | 🔒 | `missing` → `requested` → `received` → `verified` |
| `private_cpc_file`, `private_test_report_file`, `private_test_lab`, `private_test_date`, `private_tracking_label_photo` | 🔒 | Paths/names of the documents in your private files. Date as `YYYY-MM-DD`. |
| `private_notes` | 🔒 | Anything internal |

🔒 columns are written only to `private/catalog-internal.json`. The public JSON is validated on every build: the build **fails** if it contains private-looking fields (cost, supplier, invoice, compliance, notes…), duplicate SKUs/slugs, or malformed data.

## Launch gate

`npm run catalog:check` exits with an error if any **published** product is missing: photos, age grading, manufacturer/importer, price, weight, tracked inventory, unit cost, invoice, or a `verified` CPC + lab report + test date + tracking-label photo. Draft products show the same list as a to-do.
