# Homepage QA — review handoff

Status: **BUILT · TESTED** (not yet APPROVED). Stopped at the homepage approval gate (spec §35).

## What was built

- All 10 sections, using the approved copy and in the locked order (§19–20).
- Header (76 px, then 68 px once scrolled, sticky), mobile menu, mobile conversion bar (Book Pickup at 70% width, hidden while typing and when the final section fills 60% or more of the viewport).
- Process story: sticky visual with crossfade on desktop and laptop (≥1024 px). Uses native scroll and an IntersectionObserver band at 45% of the viewport. Below 1024 px it falls back to four editorial groups. Without JS, the first frame stays visible and all copy is shown. With reduced motion, frames swap instantly.
- Find a Price: accessible combobox, a server route at `/api/prices` that serves the MOCK source (`src/lib/pricing.ts`, `server-only`), and all states (default, typing, multiple matches, result, no result, loading, error).
- FAQ: native `<details>` accordion (no JS).
- Analytics UI hooks through `data-analytics` (§23). Campaign attribution (UTM / fbclid / gclid) is stored per session and added to `/book` and `/quote` links (§9, §22).
- Placeholder routes for navigation testing only: `/book`, `/quote`, `/services`, the six `/services/*` pages, `/pricing`, `/how-it-works`, `/locations`, `/regular-laundry`, `/privacy` (all `noindex`).

## Verification run

| Check | Result |
|---|---|
| 1440×900, 1280×800, 1024×768, 390×844, 360×800 | No horizontal overflow at any size |
| Console errors | None (the only 503 is the intentional `?mockPricing=error` preview) |
| One `h1`, sections use `h2` | Yes |
| No-JS | First process frame visible, all stage copy present |
| Reduced motion | Transitions disabled |
| FAQ via keyboard | Opens with Enter |
| Internal links (22) | All return 200 |
| `tsc`, `eslint`, `next build` | Pass |
| Lighthouse | Not run — scores are not meaningful until final photography exists |

Preview states (§29) are in `docs/qa/homepage/` (numbered 01–14, plus laptop, tablet, small-mobile and per-section captures).
To reproduce the pricing states in dev: `/?mockPricing=slow` (loading) and `/?mockPricing=error` (error). Search `zzzz` to see the no-result state.

## Blockers / items needing a decision

1. **Brand assets missing.** `public/brand/velto-logo.png`, `velto-logo-white.png` and `docs/brand/velto-company-profile.pdf` are not in the repo. The logo is **not** recreated. A dashed "Logo asset" slot renders instead, and the real file is picked up automatically once it is added (`src/components/ui/Logo.tsx`). Update `ASSUMED_RATIO` to match the artwork.
2. **No photography.** Every image is a clearly marked MOCK frame that carries its shot brief and alt text (`src/content/mock.ts`). To swap in real photos, set `src` for each slot.
3. **Contrast contradiction (§12 vs §24).** White text on Velto blue `#027CC3` is **4.49:1**, just under AA 4.5:1 for 16 px button text. The token was left unchanged, as it is locked. Recommended fix: confirm the official brand-manual blue (the current value was sampled from a PNG). Mitigations already applied: text links use navy with a blue underline (blue text on white would also fail), focus rings use blue on light surfaces and cyan on navy (cyan on white is only 2.77:1), and muted `#7B8288` is not used for small text.
4. **TODO_VERIFY data** (§36): live prices (shown as `[Live price]`), WhatsApp number (`WHATSAPP_URL` currently opens WhatsApp without a recipient), Google Maps directions and review links (currently search URLs built from the verified addresses), review counts, the four reviews (placeholder text "Verified review will appear here"), and the repeat-customer review for Regular laundry (section omits it until one is supplied).

## Implementation notes for reviewers

- `Request a Quote` and `View Full Pricing` use the secondary style so Book a Pickup stays the strongest action (§3).
- The mobile bar labels render as BOOK PICKUP / WHATSAPP as written in §18.
- `next.config.ts` sets `agentRules: false`, because otherwise Next.js 16's dev server rewrites this repo's `AGENTS.md`.
