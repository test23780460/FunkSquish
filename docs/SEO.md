# Search indexing

`src/lib/indexing.ts` is the one list of which pages search engines may index. The sitemap is built from it and
`tests/seo/indexing.test.ts` fails if a page is added without deciding, if a sitemap page is marked noindex, or if
robots.txt starts blocking anything.

| Rule | Why |
| --- | --- |
| robots.txt allows everything | A page blocked by robots.txt can't show Google its noindex tag, so Google may index the bare URL ("Indexed, though blocked by robots.txt"). Use noindex instead. |
| Indexable pages: in the sitemap, self-canonical via `pageMetadata()` | One canonical URL per page, always `https://funksquish.com/...` |
| Noindex pages: never in the sitemap | No mixed signals |
| `ephemeral-syrniki-2b3f3c.netlify.app` → 308 to `https://funksquish.com` | No duplicate copy of the site (previews keep their own hostnames) |
| `/partners/review*` sends `X-Robots-Tag: noindex, nofollow` and 404s unless configured | Private owner area |

Deliberately noindex: `/privacy`, `/terms` (drafts awaiting legal review), illustrated preview products under
`/shop/...`, `/wishlist`, the two email-confirmation pages, the review area. Make a draft page indexable by removing
`noindex` on the page **and** moving it to `INDEXABLE_PATHS` — the test checks both.

Check a running site: `npm run seo:check` (production) or `npm run seo:check -- http://localhost:3000`.

## Audit 2026-10-26 (Search Console email)

Search Console showed 5 indexed and 5 not-indexed URLs:

| Report | URL | Last crawl | Cause | Action |
| --- | --- | --- | --- | --- |
| Indexed, though blocked by robots.txt | `http://funksquish.com/` | Oct 22 | Crawled before the domain moved to Netlify on Oct 23; the old host's robots.txt blocked it. Today it 301s to `https://funksquish.com/` and robots.txt allows all. Google's live test: "URL is available to Google". | Validate fix in Search Console |
| Excluded by 'noindex' | `/returns`, `/shipping` | Oct 24 | Crawled while they were still draft (noindex). The approved policies went live later on Oct 24 and are now indexable and in the sitemap. They were never in the sitemap while noindex. | Request indexing, validate fix |
| Excluded by 'noindex' | `/privacy`, `/terms` | Oct 23–24 | Intentional: drafts awaiting legal review | None — leave as is |
| Crawled – currently not indexed | `/tiktok-live` | Oct 24 | Google's choice (no technical block; the page is indexable and in the sitemap). Likely thin content while no LIVEs are scheduled. | None needed; will improve once real schedule/clips exist |

Production check (`npm run seo:check`, 2026-10-26): 63 of 64 checks passed. The one failure is the Netlify subdomain
serving a duplicate copy with status 200 (canonical tags already pointed at funksquish.com); the redirect above fixes it
once deployed. A local production build of this branch passed all 90 checks.
