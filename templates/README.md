# Catalog template

`catalog-template.csv` is the import/export format for real products. See **docs/CATALOG.md** for every column.

1. Copy it to `private/catalog.csv` (the `private/` folder is git-ignored and never deployed).
2. Fill one row per **variant** (color/style). Rows with the same `product_slug` form one product.
3. Run `npm run catalog:import` then `npm run catalog:check`.

Columns starting with `private_` (cost, supplier, invoices, compliance files, notes) are written **only** to `private/catalog-internal.json`. They are never added to the public site.

Leave a cell empty when a fact is not confirmed. Never guess prices, stock, age grading, warnings or certifications.
