# Deploying FunkSquish to Vercel + connecting funksquish.com

This guide puts the site on Vercel and points **funksquish.com** at it **without touching your Google Workspace email records**.

> ⚠️ Nothing in this guide has been applied yet. DNS changes are made by you, in your Squarespace Domains account, when you're ready.

The strategy is simple and low-risk:

- **Keep DNS at Squarespace.** Don't switch nameservers to Vercel.
- **Only change the website records** (`@` A record and `www` CNAME).
- **Leave every email record alone** (MX, SPF, DKIM, DMARC, Google verification).

## Launch checklist (quick version)

1. Import the GitHub repo into Vercel and deploy (section 2). No environment variables needed.
2. Click through the `*.vercel.app` preview on a phone.
3. Add `funksquish.com` + `www` in Vercel (section 3).
4. Snapshot current Squarespace DNS, then change **only** the `@` A record and `www` CNAME (sections 4–5).
5. Confirm Vercel shows "Valid Configuration" and test email still works (section 6).

**Before taking real orders (not needed for the coming-soon launch):** finalize the draft Privacy Policy and Terms, publish shipping/returns/pricing, and connect a payment provider (see `ECOMMERCE-ROADMAP.md`).

---

## 1. Put the code on GitHub

The project is already set up as a git repo with `origin` pointing at
`https://github.com/test23780460/FunkSquish.git`. Push the `main` branch:

```bash
git push -u origin main
```

## 2. Create the Vercel project

1. Sign in at [vercel.com](https://vercel.com) (signing in with GitHub is easiest).
2. **Add New → Project →** import the `FunkSquish` repository.
3. Vercel detects **Next.js** automatically. Leave the defaults:
   - Build command: `next build`
   - Output: automatic
   - Node.js version: **20.x or newer** (Project → Settings → General)
4. No environment variables are needed for the pre-launch site.
5. Click **Deploy**. You'll get a preview URL like `funksquish-xxxx.vercel.app`. Check it on your phone before connecting the domain.

## 3. Add the domain in Vercel

1. Vercel project → **Settings → Domains**.
2. Add `funksquish.com`.
3. Add `www.funksquish.com` and choose **Redirect to funksquish.com** (so there's one main address).
4. Vercel will now show the exact DNS records it wants. They usually look like this — **always copy the values Vercel shows you**, because Vercel sometimes gives project-specific values:

| Type  | Name / Host | Value (example — use Vercel's)                  |
| ----- | ----------- | ----------------------------------------------- |
| A     | `@`         | `216.198.79.1` (older projects: `76.76.21.21`)  |
| CNAME | `www`       | e.g. `xxxxxxxx.vercel-dns-017.com` or `cname.vercel-dns.com` |

Keep this Vercel tab open.

## 4. Take a "before" snapshot of your DNS

1. Go to [account.squarespace.com/domains](https://account.squarespace.com/domains) → click **funksquish.com** → **DNS** → **DNS Settings**.
2. **Screenshot every record on the page** (or copy them into a note). This is your rollback plan.

You'll typically see:

- **Squarespace Defaults** preset (only if the domain was ever connected to a Squarespace site): four `A` records on `@` pointing to `198.185.159.144`, `198.185.159.145`, `198.49.23.144`, `198.49.23.145`, and a `CNAME` `www → ext-sq.squarespace.com`.
- **Google Workspace** preset and/or custom records for email (see the "do not touch" list below).

## 5. Change only the website records

In Squarespace **DNS Settings**:

1. **If the "Squarespace Defaults" preset is present, delete that preset only.** Its `A` and `www` records would conflict with Vercel's. Deleting it does **not** affect the Google Workspace preset.
2. If there are any other existing `A` records on `@` or a `CNAME` on `www`, remove just those (they're website records, not email).
3. Under **Custom records → Add record**:
   - **Type:** `A`, **Host:** `@`, **Data:** the IP Vercel showed you.
   - **Type:** `CNAME`, **Host:** `www`, **Data:** the target Vercel showed you.
4. Save.

### ✅ Do not touch these (Google Workspace email)

| Record | Host | Looks like | Purpose |
| --- | --- | --- | --- |
| MX | `@` | `smtp.google.com` (priority 1) — or the older set `ASPMX.L.GOOGLE.COM`, `ALT1…`, `ALT2…`, `ALT3…`, `ALT4…` | Delivers your email |
| TXT (SPF) | `@` | `v=spf1 include:_spf.google.com ~all` | Says Google may send mail for you |
| TXT (DKIM) | `google._domainkey` | `v=DKIM1; k=rsa; p=…` | Signs your outgoing email |
| TXT (DMARC) | `_dmarc` | `v=DMARC1; p=…` | Email policy / reports |
| TXT | `@` | `google-site-verification=…` | Proves domain ownership to Google |

A `TXT` record on `@` and an `A` record on `@` live happily side by side — adding the Vercel `A` record doesn't affect SPF or verification.

### If you have CAA records

If you see any `CAA` records, add one more so Vercel can issue your HTTPS certificate:

| Type | Host | Data |
| --- | --- | --- |
| CAA | `@` | `0 issue "letsencrypt.org"` |

(If there are no CAA records at all, skip this.)

## 6. Wait and verify

1. Back in Vercel → **Settings → Domains**, both domains should switch to **Valid Configuration** (usually minutes, occasionally a few hours). Vercel issues HTTPS automatically.
2. Visit `https://funksquish.com` and `https://www.funksquish.com` (should redirect).
3. **Check email still works:** send an email to `travis@funksquish.com` from a personal account and reply to it.
4. Optional technical check from a terminal:

```bash
nslookup -type=mx funksquish.com
```

```bash
nslookup -type=txt funksquish.com
```

You should still see Google's MX and the SPF record. Google's free [Admin Toolbox Check MX](https://toolbox.googleapps.com/apps/checkmx/) also confirms MX, SPF, DKIM and DMARC.

## Rollback

If anything looks wrong, delete the two records you added in step 5 and re-add what was in your "before" screenshot (or re-apply the Squarespace Defaults preset). Email records were never changed, so email is unaffected either way.

## Email health tips (optional, recommended)

- **DKIM:** if there's no `google._domainkey` record yet, generate one in Google Admin → Apps → Google Workspace → Gmail → **Authenticate email**, add it as a TXT record in Squarespace, then click **Start authentication** in Google Admin.
- **DMARC:** if there's no `_dmarc` record, a gentle starting point is a TXT record on host `_dmarc` with `v=DMARC1; p=none; rua=mailto:travis@funksquish.com`. Tighten later once reports look clean.

## Redeploys

Every push to `main` deploys to production automatically. Pushes to other branches get their own preview URLs.
