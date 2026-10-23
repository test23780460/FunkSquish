# Deployment — Netlify (current setup)

## Current production setup (as of October 23, 2026)

| Piece | Value |
| --- | --- |
| Hosting | **Netlify Free**, project `ephemeral-syrniki-2b3f3c` (team `travis-phillips`) |
| Source | GitHub `test23780460/FunkSquish`, branch **`main`** → production |
| Framework | Next.js 16 (auto-detected by Netlify; no `netlify.toml` needed) |
| Domain | `funksquish.com` (primary), `www.funksquish.com` → redirects to primary |
| DNS | **Squarespace Domains**, DNSSEC **on** — keep it on |
| HTTPS | Let's Encrypt via Netlify (auto-renews) |
| Email | Google Workspace (MX `smtp.google.com`, SPF, DKIM) |

### DNS records for the website (Squarespace)

| Type | Host | Value | Note |
| --- | --- | --- | --- |
| A | `@` | `75.2.60.5` | Netlify load balancer (ALIAS isn't allowed with DNSSEC on Squarespace) |
| CNAME | `www` | `ephemeral-syrniki-2b3f3c.netlify.app` | |

**Never change** the MX, SPF (`v=spf1 include:_spf.google.com ~all`), DKIM (`google._domainkey`), the Squarespace Domain Connect record, the nameservers, or DNSSEC when working on the website.

## Netlify Free plan — budget

Netlify Free gives **300 credits per month**. When they run out, Netlify pauses the site until the next cycle. Reported rates ([summary](https://netli.fyi/blog/netlify-free-plan-limits-2026), verify in Netlify → Billing → Usage):

| Activity | Cost |
| --- | --- |
| **Production deploy (each merge to `main`)** | ~15 credits → about **20 per month max** |
| Deploy Previews / branch deploys | free |
| Bandwidth | ~20 credits per GB |
| Web requests | ~2 credits per 10,000 |
| Function compute | ~10 credits per GB-hour |

What this project does to stay cheap:

- Every page is **prerendered static** HTML served from Netlify's edge cache.
- Analytics (Umami) and email (Brevo) are external services — no Netlify bandwidth or functions.
- Server functions only run for email sign-ups and (later) starting a checkout.
- **Batch changes:** work on branches, review Deploy Previews (free), then merge once.

Check usage monthly: Netlify → team → **Usage**.

## Workflow for changes

1. Create a branch: `git switch -c feature/my-change`.
2. Push and open a pull request on GitHub → Netlify builds a **Deploy Preview** (free) and comments the link on the PR. Deploy Previews are private to your Netlify team.
3. Test the preview on phone and desktop.
4. Merge to `main` only when ready → one production deploy.

Local checks before pushing:

```bash
npm run lint
```

```bash
npm run typecheck
```

```bash
npm run build
```

## Environment variables (Netlify → Site configuration → Environment variables)

All are optional and off by default. See `.env.example`.

| Variable | Used for | Secret? |
| --- | --- | --- |
| `BREVO_API_KEY`, `BREVO_LIST_ID`, `BREVO_DOI_TEMPLATE_ID` | Launch email list (`docs/NEWSLETTER.md`) | API key: **yes** |
| `NEXT_PUBLIC_UMAMI_WEBSITE_ID` | Analytics (`docs/ANALYTICS-SEO.md`) | No (public ID) |
| `GOOGLE_SITE_VERIFICATION` | Search Console HTML tag | No |
| `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_STOREFRONT_TOKEN` | Future hosted checkout | Token: **yes** |

Never commit real values. After changing env vars, trigger a redeploy (costs a production deploy).

## Rollback

Netlify → Deploys → pick the previous published deploy → **Publish deploy**. This doesn't touch DNS.

## Older note

An earlier version of this guide described Vercel. The site moved to Netlify; the Vercel instructions no longer apply.
