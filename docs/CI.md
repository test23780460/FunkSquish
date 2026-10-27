# Automated checks (GitHub Actions)

`.github/workflows/ci.yml` runs on **every pull request** (whatever branch it targets) and on pushes to `main`. It only
reads the code and runs checks: **no secrets, no deploys, no writes.** Production is still deployed only by Netlify,
exactly as before.

## What it checks (one job, about 3–5 minutes)

| Step | Fails when |
| --- | --- |
| Secret scan (`scripts/secret-scan.mjs`) | A tracked file contains something shaped like a real Stripe/Brevo/GitHub/Netlify/Google/AWS key, webhook secret, private key, owner passphrase hash or authenticator secret, or an `.env` file is committed. Prints file and line only, never the value. Obvious test fakes (`FAKE`, RFC test key) are allowed. |
| Install | `npm ci --ignore-scripts`: exactly the lockfile, and no package install scripts run (supply-chain hardening). |
| Launch safeguards (`scripts/safeguards-check.mjs`) | Purchasing, partner applications or email sign-ups are switched on; a Stripe test/live lock is changed or removed (including, once PR #21 is in, the verified/owner-approved shipping-rate lock); live checkout or partner applications stop waiting for owner two-step sign-in (once PR #18 is in); checkout stops being cards-only or gains promotion codes / saved customers / a payment-method configuration; Privacy or Terms stop being drafts (noindex); the owner area loses its `noindex` / `no-store` headers. |
| Dependency security | `npm audit --omit=dev --audit-level=high` finds a high or critical advisory in production dependencies. |
| Lint, typecheck | Any ESLint error; any TypeScript error (route types generated first). |
| Policy, privacy and SEO consistency | `tests/legal` and `tests/seo` (where the branch has them): policy text vs. code, draft banners, noindex rules, approved time commitments. |
| All tests | `npm test` (Vitest) — includes checkout, shipping, inventory, owner sign-in and route-coverage tests on the branches that have them. |
| Catalog | `npm run catalog:check` blocks publishable products with missing safety, price, stock or evidence fields. |
| Production build | `next build`. |

Security of the workflow itself: `permissions: contents: read` only; actions pinned to full commit SHAs
(`actions/checkout` v7.0.1, `actions/setup-node` v7.1.0 — both released more than two weeks before they were pinned);
`persist-credentials: false`; no `pull_request_target`, so code from a pull request never runs with write access or
secrets. Superseded runs on the same PR are cancelled.

Cost: this repository is public, and GitHub-hosted runners are free for public repositories. If it ever becomes private,
the free plan includes a monthly minutes allowance; one run uses roughly 3–5 minutes.

## Launch PRs

`scripts/safeguards-check.mjs` is **meant to fail** on the PR that switches something on. That PR must also change the
`EXPECTED` values at the top of the script, so turning on purchasing (or partner applications, email lists, publishing a
policy) is always a visible, reviewed line in the diff.

## Stacked PRs and Netlify previews

| | GitHub checks (this workflow) | Netlify deploy previews |
| --- | --- | --- |
| Which PRs | Any PR whose branch **contains** `.github/workflows/ci.yml` | Only PRs into `main` (current Netlify setting) |
| Stacked PRs (#12 → #5, #14 → #12, the Phase 2 branches…) | Not until this file reaches them: merge this PR into `main`, then merge `main` into the bottom of each stack (or the file arrives as each stack is merged) | None (no preview for a PR into another feature branch) |
| The DO NOT MERGE preview PR into `main` | Yes — it contains every branch, so it shows CI for the whole combined code | Yes — a full preview of everything combined |

Until this PR is merged, checks on stacked PRs are manual (`npm test`, `npm run lint`, `npm run typecheck`,
`npm run build`, `node scripts/secret-scan.mjs`, `node scripts/safeguards-check.mjs`).

## Owner settings to turn on (GitHub → this repository → Settings)

1. **Actions → General:** allow GitHub Actions (and, recommended, "Require approval for all outside collaborators" for
   fork PRs; leave "Read repository contents" as the default workflow permission).
2. **Code security:** turn on **Secret scanning** and **Push protection** (free for public repositories; push protection
   blocks a push that contains a known key format), **Dependabot alerts** and **Dependabot security updates**.
3. **Branches → Branch protection (or a ruleset) for `main`:** require a pull request, require the "Tests, lint, types,
   build and safeguards" check to pass, and block force pushes. Do this after this workflow has run once (the check name
   appears then).
4. Turn on two-step sign-in for your GitHub account (Settings → Password and authentication).

None of these were changed by this work — they're owner-only settings.
