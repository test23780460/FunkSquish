# Security and data-protection review — owner dashboard

Reviewed 2026-10-31, across the dashboard PR stack. Covers every new and existing owner function.

## Findings fixed during this work

| # | Finding | Fix |
| --- | --- | --- |
| S-1 | **Launch safeguard could be removed by deleting its file.** The CI check skipped any lock whose file was missing, so deleting `key-permissions.ts` together with its call passed CI (PR #24 review). | Every file a safeguard depends on is now required. A mutation test deletes each one in a temporary copy and confirms the check fails (PR #24). |
| S-2 | **Public email forms could be used to send mail to anyone.** The launch-list and drop-alert sign-ups had only a honeypot, so a script could make Brevo send confirmation emails to arbitrary addresses. | Per-network (keyed IP hash), per-day and total limits (`src/lib/newsletter/limits.ts`). |
| S-3 | **Phone photos carry GPS location.** EXIF/XMP data in a product photo could reveal where it was taken (often home). | EXIF/XMP/text metadata is stripped from JPEG, PNG and WebP before storage. |
| S-4 | **Race: double put-back / double send.** A "claimed" flag set during a lost compare-and-set attempt survived the retry, so two simultaneous TikTok uploads could put a cancellation back twice, or two clicks could send a campaign twice. | Flags reset per attempt; concurrency tests added. |
| S-5 | **Same tracking number on two orders.** A supplier's tracking could be recorded on the wrong order. | Each tracking number is claimed for one package (create-only). |

## Checks

| Area | How it's enforced | Tested by |
| --- | --- | --- |
| **Authentication** | Passphrase (scrypt, rate limited) plus TOTP two-step sign-in once set up or required. | `tests/owner/mfa-*.test.ts` |
| **Authorization** | Every owner page, action and download calls `requireReviewer()` first. Server actions are public endpoints, so each checks for itself. | `tests/owner/route-coverage.test.ts` (static, every `"use server"` file); `tests/owner/unauthenticated.test.ts` (calls each action and download without a session: redirect or 404, nothing touched) |
| **CSRF** | Next.js server actions reject cross-origin posts (Origin vs Host), and no extra origins are allowed. The session cookie is HTTP-only, SameSite=strict and limited to `/partners/review`. Downloads are GET-only reads. | `tests/owner/unauthenticated.test.ts` |
| **Server-side validation** | Every form is parsed and validated on the server (money, SKUs, dates, ids, URLs). Nothing is trusted from the browser. | `tests/products/*`, `tests/suppliers/*`, `tests/shipping/*` |
| **Rate limits** | Owner writes: per-area buckets plus 600 writes an hour overall. Uploads, imports and sends have tighter caps. Public sign-ups are limited (S-2). | `tests/actions/signup-limits.test.ts` |
| **Uploads** | File type comes from the file's bytes. JPEG/PNG/WebP/MP4/WebM for products; PDF/images/CSV for supplier documents. No SVG, HTML, Office or archives. 4 MB cap and pixel limits. Content-hash names, never the uploader's. | `tests/products/media.test.ts`, `tests/suppliers/suppliers.test.ts` |
| **Serving uploads** | `/media/<hash>` serves a file only while a published product uses it (nosniff). Drafts' files go only through the owner route. Supplier documents only download as attachments, with a sandbox CSP. | `tests/products/csv-and-media-route.test.ts` |
| **Sensitive data** | Public catalog releases contain whitelisted public fields only; the validator refuses private-looking keys. Supplier exports hold name and address only. The sales CSV has no customer details. | `tests/products/catalog-admin.test.ts`, `tests/suppliers/*`, `tests/marketing/*` |
| **Audit log** | ids and short text only; emails and long numbers are masked; append-only (create-only keys). | `tests/owner/dashboard-foundation.test.ts` |
| **No indexing or caching** | Owner pages: `noindex`, `private, no-store` header, `connection()` (never prerendered with data). | `tests/seo/indexing.test.ts`, `tests/owner/route-coverage.test.ts`, safeguards check |
| **Secrets** | Server env vars only; the secret scanner runs in CI; no keys in code. Settings shows whether integrations are configured, never their values. | `scripts/secret-scan.mjs` |
| **Production / preview isolation** | Store names come from the build's deploy context (`owner-data`, `owner-media`, `-preview`). Live orders are only stored on production. Backups can't be restored across environments. | `tests/owner/isolation.test.ts`, `tests/owner/dashboard-foundation.test.ts` |
| **Concurrency / idempotency** | Revision checks on every product, supplier and shipping save; compare-and-set releases; create-only claims for supplier references, tracking numbers, TikTok order lines and campaign sends. | concurrency tests in `tests/products`, `tests/suppliers`, `tests/inventory`, `tests/marketing` |
| **Safe errors** | Owner messages say what to fix. Logs carry codes, never email addresses or keys (Brevo errors are scrubbed). | code review |
| **Backups and recovery** | JSON backup of dashboard data; restore is check-first, add-only unless RESTORE is typed, never deletes. Catalog rollback via releases. | `tests/owner/dashboard-foundation.test.ts`, `tests/products/catalog-admin.test.ts` |
| **Data retention** | Audit log: 2 years (prune button). Partner applications: existing daily retention job. Order and stock retention waits for the accountant's answer (Q-RET-1/2); nothing is auto-deleted. | — |

## Dependencies

- `npm audit --omit=dev`: **0 vulnerabilities**. This is what CI checks, at high level.
- One **moderate** advisory in the lint toolchain only (minimatch via eslint 9 / eslint-config-next). It isn't shipped
  to the site. The suggested fix downgrades eslint to 4.x, so it's left until eslint-config-next updates.

## Residual risks (accepted, documented)

- **The catalog refresh on Netlify** (tag revalidation and hourly fallback) is untested on a real deploy.
  - If Blobs is down during a refresh, the last good page keeps being served.
  - Checkout always reads fresh and fails closed.
- **Media caching:** removed photos can stay in browser and CDN caches for up to 24 hours.
- **Manual TikTok reconciliation** can't prevent every oversell. The site says so, and suggests pausing and
  keeping a buffer.
- **The owner passphrase is the first factor.** Turn on `OWNER_MFA_REQUIRED=true` once two-step sign-in is set up.
