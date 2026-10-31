> **Historical document (kept for the record).** Current guidance: `docs/OWNER-GUIDE.md` and `docs/LAUNCH-CHECKLIST.md` — see `docs/README.md`.

# Signature experience — plan (Issue #6)

Owner-approved scope: all eight features in
[Issue #6](https://github.com/test23780460/FunkSquish/issues/6). Built as four stacked draft PRs so each can be
reviewed on its own. **Nothing here turns on purchasing, live payments or production deploys.**

| Phase | Branch | Features |
| --- | --- | --- |
| 1 | `feature/experience-1-lab-wishlist` | Squish Lab (1), wishlist (4), product pages (7), shared texture data, test setup |
| 2 | `feature/experience-2-quiz-box` | Squish Personality Quiz (5), Build Your Squish Box (2) |
| 3 | `feature/experience-3-drops-live` | New Drops + restock alerts (6), TikTok LIVE room (3) |
| 4 | `feature/experience-4-partners` | Become a Partner / Distributor + private review (8) |

Each phase branches from the previous one; PR 1 targets `main`. Stripe PR #5 is untouched (see "Overlap with PR #5").

## Design direction

- Same identity: blue-and-white palette tokens in `globals.css`, the logo, the mascot, Fredoka/Nunito, the squishy
  buttons and `squishy` hover. New screens reuse `PageHero`, `SectionHeading`, `Notice`, `Badge`, `ProductCard`.
- One new visual family: **texture blobs** (`TextureBlob`) — five cartoon squishies, one per texture, in the
  same outline/face style as the mascot. Always labelled as illustrations.
- Motion is purposeful (press, wobble, rise) and fully respects `prefers-reduced-motion`: the squish demo switches
  to an instant pressed/resting state, no wobble, no particles.
- Mobile-first: horizontal-scroll pickers on phones, grids on larger screens, 44px+ touch targets.

## Honesty rules built into the code

- Preview products stay `publication: "preview"`, no prices, "Preview sample" badges, "Not for sale yet" buttons.
- Product textures (`Product.textures`) are optional. Preview concepts only list the texture their own
  description already names (jelly, crunchy). Textures with no design show an empty state, not filler.
- The Squish Lab demo is labelled "Animated demo, not a real product". Sounds are synthesized, off by default.
- Product media must be our own files under `/products/<slug>/` (validation rejects hotlinked URLs).
- "What we've confirmed" on product pages only ticks details that exist in the catalog.
- Wishlists never leave the browser. Shared links carry product slugs only.

## Technical notes

- `src/content/textures.ts` — texture styles, meters (relative, 1–5) and demo physics.
- `src/lib/squish-physics.ts` — pure spring/rise/crackle simulation (unit-tested).
- `src/lib/local-store.ts` — localStorage store for React (`useSyncExternalStore`, cross-tab sync, safe when
  storage is blocked). Used by wishlist now, Squish Box drafts and quiz results later.
- `src/commerce/summary.ts` — small public product snapshot for client components.
- Catalog: new optional `texture_types` CSV column (pipe-separated) and automatic `.vtt` caption pick-up for videos.
- Tests: Vitest (`npm test`), same version and config as PR #5.

## Overlap with PR #5

Both add Vitest (`vitest.config.mts` is identical) and edit `package.json`/`package-lock.json`. Whichever merges
second needs a trivial lockfile/package.json merge. No other files overlap; nothing in PR #5 is changed here.

## Owner setup and approvals (collected across phases)

See each PR's "Needs your approval" section; summarized in `docs/LAUNCH-RUNBOOK.md` when the series is complete.
