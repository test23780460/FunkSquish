# PREVIEW ONLY — DO NOT MERGE

This branch (`claude/upbeat-hawking-aonyc6-preview`) exists only so Netlify builds a **deploy preview** of every
draft branch combined, and so GitHub Actions runs CI on the combined code. It merges, without review:

- the CI branch (`claude/upbeat-hawking-aonyc6-ci`);
- the policy stack: PR #11 → PR #13 → Phase 2 policies (`claude/upbeat-hawking-aonyc6-policies`);
- the checkout stack: PR #5 → PR #12 → PR #14 → shipping → inventory → MFA (`claude/upbeat-hawking-aonyc6-mfa`).

Merging it would put all of those into `main` at once, skipping their individual reviews. Close the PR (and delete the
branch) once preview testing is done. Each real change is reviewed and merged through its own PR, in stack order.

A deploy preview is not production: it uses the **Deploy Previews** environment variables only, its own "-preview"
data stores and the Stripe **test** store. Live payments are impossible there (the live lock requires the production
build), purchasing stays off in code (`features.commerce = false`), and nothing here changes production settings.
