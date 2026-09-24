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

## Refinement pass 1 (after first review)

- Branch synced with `main` (brand asset manifest + directories).
- **Logo:** the supplied official PNG is stored untouched at `docs/brand/source/velto-logo-original.png` and the white-background reference at `docs/brand/velto-logo-reference.jpg`. `public/brand/velto-logo.png` is the original with only the transparent canvas cropped away (pixel-identical artwork, 1982×673). The header renders it at 36 px (mobile) and 44 px (≥1024). The Logo component reads the real ratio from the PNG.
- **Footer logo:** now uses the supplied official reversed (white) logo. The untouched source is at `docs/brand/source/velto-logo-white-original.png` (380×380). `public/brand/velto-logo-white.png` is that source with only the transparent canvas cropped (368×126). It renders at 44 px tall, which stays sharp at 2× density. The earlier white-plate workaround is removed.
- **Mobile hero:** below 768 px the H1 uses the H1 mobile minimum (40 px) and the supporting copy uses Body (16 px), with tighter spacing. Book a Pickup and Find a Price share one row, and Book a Pickup is wider and filled. The hero image now starts at **545 px** on 390×844 (previously about 720 px). The copy is unchanged.
- **Mobile bar:** 64 px instead of 72 px, with 44 px buttons and a lighter border. The Book Pickup/WhatsApp split stays at about 70/30. Below 375 px, WhatsApp shows the glyph only and keeps its accessible label. The header and bar backgrounds are now solid white, so content no longer shows through.
- **Mobile menu:** 52 px rows at 17 px. Actions sit directly under the list in one row (Book a Pickup wider) instead of being pinned to the bottom.
- **Process:** interaction unchanged. Stages are tighter (30 vh). On desktop, inactive stage titles step back to secondary grey (still AA-compliant) and the active stage gets navy, a blue number and a full-width blue rule. The image caption row gains an 8-step progress indicator.
- **Primary blue:** filled buttons use new `--color-brand-action: #0078BC` (4.76:1 with white, AA pass). The hover is `#00659E` and the active state `#005688`. `--velto-blue` is unchanged for accents, rules and stars.
- **Desktop hero:** structure unchanged. With placeholder photography the balance can't be judged properly, so it will be rebalanced once the real hero photo exists.
- **Find a Price:** unchanged apart from the button colour.

## Photography pass

- 17 homepage image slots now use licensed Pexels stock photography stored in `public/images/home/` (no hotlinking). Sources, licence and credits are in `docs/brand/IMAGE-SOURCES.md`.
- The alt text describes each photo without presenting stock people or places as Velto. The two location images stay as placeholders until real outlet photos exist.
- Crops are set per slot through `position` in `src/content/mock.ts`. Copy, hierarchy and layouts are unchanged.
- Captures are in `docs/qa/homepage/photography/`. No broken images, no console errors, and no horizontal overflow at 390 px.

## Phase 3 final refinement

Architecture and visual language are unchanged. The copy edits below were approved in review and mirrored into `docs/PROJECT-BUILD-SPEC.md`.
- **Hero:** shorter supporting copy. The headline is 36 px on mobile (was 40). On desktop the display clamp is `clamp(2.75rem, 4.4vw, 4rem)` with a ~600 px headline measure. Measured headline lines: 4 at 1440 px, 3 at 1280 and 1024, 4 on mobile.
- **Services:** copy edits to Dry Cleaning, Curtain Cleaning and Carpet Cleaning.
- **Process:** a more human intro. Stage 02 is renamed "Checked in", the stage lines are rewritten, the "QC" wording is gone, and the delicate-garment insert is shortened.
- **Mobile process:** grouped into four movements (Pickup, Intake, Cleaning & finishing, QC & return). All eight stages stay in the markup as compact title-plus-line rows. The mobile narrative went from 2,720 px to 1,621 px (**−40%**). The desktop sticky story is unchanged.
- **Regular laundry and final CTA:** copy edits.
- **Sticky header:** 64 px when scrolled (was 68), with a scaled-down logo and CTA and a hairline border plus soft shadow.
- **Mobile bar:** reads "Book a Pickup" / "WhatsApp" in normal casing.
- **Unchanged:** the stock photography is still temporary, the location placeholders are untouched, and no internal pages were started.
- **Captures:** `docs/qa/homepage/phase3-final/`.

## Blockers / items needing a decision

1. **Company profile PDF** (`docs/brand/velto-company-profile.pdf`) is still not in the repo, so it could not be used as a reference in this pass.
2. **Photography is illustrative stock.** Replace it with real Velto photography before launch (see `docs/brand/IMAGE-SOURCES.md`). The two outlet images are still placeholders.
3. **Logo tagline legibility:** the official lockup includes "Premium Laundry At Your Doorstep", which renders at about 4 px in the header. An official lockup without the tagline would suit the header better. The artwork was not altered.
4. **TODO_VERIFY data** (§36): live prices (shown as `[Live price]`), WhatsApp number (`WHATSAPP_URL` currently opens WhatsApp without a recipient), Google Maps directions and review links (currently search URLs built from the verified addresses), review counts, the four reviews (placeholder text "Verified review will appear here"), and the repeat-customer review for Regular laundry (section omits it until one is supplied).

## Implementation notes for reviewers

- Filled-button contrast issue from the first pass (`#027CC3`, 4.49:1) is resolved by the action token above.
- `Request a Quote` and `View Full Pricing` use the secondary style so Book a Pickup stays the strongest action (§3).
- The mobile bar labels render as BOOK PICKUP / WHATSAPP as written in §18.
- `next.config.ts` sets `agentRules: false`, because otherwise Next.js 16's dev server rewrites this repo's `AGENTS.md`.
