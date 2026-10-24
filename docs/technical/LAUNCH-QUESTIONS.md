# Launch questions: business facts still open

Audit of every `TODO_VERIFY` marker and of the spec §36 "live verification" list, 24 October 2026.
A marker was resolved only where the specification or another authoritative record in the
repository already answers it. Nothing below was guessed; each open item needs the owner (and, for
legal items, a lawyer).

## Resolved in this audit (repository evidence)

| Item | Evidence | Change |
|---|---|---|
| Google Maps directions and review links (spec §36) | `src/content/site.ts` uses each outlet's own Business Profile by place id (`mapListingUrl`) and its verified pin (`directionsTo`); recorded as done 2026-09-27 in `docs/seo/VELTO-SEO-MASTER-PLAN.md` §8 | `docs/seo/LOCAL-SEO-GBP-PLAN.md` note marked done |
| Review names and text (`Review` type in `src/content/mock.ts`) | The reviews in that file are documented as "Verified Google reviews supplied by the owner … transcribed exactly" | Field comments describe the rule instead of a TODO |
| Official reversed/white logo (spec §36) | `public/brand/velto-logo-white.png`, added in commit 6cd6f62 "Use official reversed Velto logo in footer" | `public/brand/README.md` lists it |

Already settled before this audit (no marker left): exact live prices (read from the Velto Ops
pricing view, never stored in the site), the WhatsApp destination (owner-confirmed number in
`src/content/legal.ts`), outlet addresses and hours (spec §36).

## Needs your confirmation

### Legal (owner + lawyer)

1. **Legal entity, trade licence, privacy email** (`src/content/legal.ts`, all `null` and hidden today).
   Which registered business operates Velto, should the licence number be shown, and which monitored
   email handles privacy requests?
2. **Terms policies** listed in `docs/legal/LEGAL-REVIEW.md` §2: payment timing and methods, reporting
   window, any liability cap, uncollected-items period, governing-law wording.
3. **Privacy page is behind the product** (`src/app/[lang]/(site)/privacy/page.tsx`, "Last updated
   1 October 2026"). It says photos are never uploaded through the website, but Book Pickup now
   uploads one optional photo to Velto's storage (`/api/bookings/photos`). The provider list doesn't
   name the SMS provider used for sign-in codes or Google sign-in. Legal copy was not changed here.

### Reviews and ratings

4. **Google review counts** (spec §36, `src/content/site.ts`, `locations/[id]`): the site shows
   Sector 11 5.0 / 102 and Sector 18 4.9 / 8 ("at last verification"), also the values in Command
   Center → Site settings. Please re-check them on Google and update Site settings if they changed (or
   set `GOOGLE_PLACES_API_KEY` to read them live).
5. **Regular-laundry review** (`REGULAR_REVIEW` in `src/content/mock.ts`, currently `null`, so the
   section is hidden). Supply one verified repeat-customer review if you want it shown.

### Turnaround and operating rules

6. **Blanket / comforter timing**: the pages say "plan for roughly 3–4 days" (spec §7, "where this
   matches current operating conditions"). Is that still true?
7. **Curtain and carpet turnaround** (spec §36): the pages promise no number ("Velto confirms timing
   with your quote"). Give a range only if you want one shown.
8. **Express charge** (spec §36): the pages say Express costs extra and is confirmed first; no amount is
   shown. Give the amount or rule only if it should be displayed.
9. **Regular / weekly pickup rules** beyond what is confirmed (`regular-laundry` page): weekly or
   fortnightly pickup and free delivery from ৳300 on regular orders are owner-confirmed; anything else
   (minimum commitment, skip/pause rules) is open.
10. **Below-৳499 pickup charge** (spec §36): Site settings currently hold **৳60**. Please confirm.
11. **Payment methods** (spec §36): Ops records Cash, bKash, Nagad, Card, Bank Transfer and Cash on
    delivery. The public pages don't list methods today; confirm the list if you want it published
    (it also answers Terms §6).

### Photography

12. **Production photography** (spec §36): several image slots still use licensed stock or briefs
    (`src/content/mock.ts`, `docs/brand/IMAGE-SOURCES.md`, Command Center → Images shows which). Replace
    them with real Velto photos when available.

## Markers that stay on purpose

- `src/lib/pricing.ts`: the mock price list used only when the live pricing view isn't configured
  (amounts are `null`, never invented).
- `docs/qa/HOMEPAGE-QA.md`, `docs/qa/INTERNAL-PAGES-QA.md`: dated QA records; this file supersedes their
  open-item lists.
- The service-copy comments in `src/content/services.ts` and `src/content/i18n/services.bn.ts` stay until
  items 6–8 are answered.
