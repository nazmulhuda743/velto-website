# Internal pages QA — review handoff

Branch: `claude/velto-internal-pages` (from `main` at `1994604`, the approved homepage).
Status: **BUILT · TESTED**. Awaiting creative review. Not yet APPROVED.

## Pages built (priority order)

| # | Route | Primary conversion |
|---|---|---|
| 1 | `/services` | Book a Pickup |
| 2 | `/services/dry-cleaning` | Book a Pickup |
| 3 | `/services/wash-and-iron` | Book a Pickup |
| 4 | `/services/ironing` | Book a Pickup |
| 5 | `/services/curtain-cleaning` | Request a Quote |
| 6 | `/services/carpet-cleaning` | Request a Quote |
| 7 | `/services/blanket-comforter-cleaning` | Book a Pickup (quote as secondary) |
| 8 | `/pricing` | Find a Price, then Book a Pickup |
| 9 | `/how-it-works` | Book a Pickup |
| 10 | `/regular-laundry` | Set Up Regular Pickup |
| 11 | `/locations` | Book a Pickup |
| 12 | `/locations/sector-11` | Get Directions |
| 13 | `/locations/sector-18` | Get Directions |
| 14 | `/about` | Book a Pickup |
| 15 | `/book` | Booking form (UI only) |
| 16 | `/quote` | Quote form (UI only) |

Business/Bulk and Express were **not** built as standalone pages. Express appears only as the approved "may be available, confirm first" note.

## System reuse (no new visual language)

- **Unchanged:** Header, MobileMenu, Footer (adds an "About" link), Button, TextLink, ResponsiveImage, SectionIntro, ProofList, Logo and tokens.
- **Generalised through props, with defaults that leave the homepage output identical:**
  - FAQ: `items`, `title`, and the `faqItems()` helper built from the approved answers
  - FinalBookingCTA: `title`, `body`, `source`, `service`, `primary`
  - ProcessStory: `title`, `intro`, `showInsert`
  - LocationBlock: exported for reuse
  - MobileConversionBar: `source`, `service`, `primary`
  - The homepage was pixel-diffed against the approved captures after the refactor: **0.000%** difference on desktop hero, services and process, and on mobile hero and process.
- **New, built from the same primitives:**
  - PageHero (H1 style `t-h1`, as in the spec's type scale)
  - Breadcrumbs, ProcessSteps, FactRows, BulletList
  - the ServicePageView template, driven by `src/content/services.ts`
  - form fields following spec §17: visible labels, 52/54 px inputs, 120 px textarea, text errors, an error summary

## Facts and content rules

- Copy uses only facts from spec §4 (turnaround, express, delivery rule), §5 (verified SOPs and workflows), §7 (household quote journeys) and §36 (locations).
- Unverified items are marked `TODO_VERIFY` in code:
  - curtain and carpet turnaround (the pages say timing is confirmed with the quote)
  - the blanket "roughly 3–4 days" planning range (spec §7)
  - recurring-pickup rules
  - review counts
- **No prices are hardcoded.** Pricing reuses PriceFinder through `/api/prices`.
- **Images:**
  - The existing temporary stock set is reused; no new stock was added.
  - Where no honest image exists, a marked placeholder is used instead: blankets and comforters, the curtain and carpet measurement shots, and both outlets.
  - Location pages never use stock storefronts.
- The mobile conversion bar appears on the service pages only (spec §18). On quote-first pages it reads "Request a Quote". It is absent from `/book` and `/quote`.

## Book Pickup and Request Quote: UI only (Codex owns integration)

- **Field names follow Codex's contracts** (`BookingSubmission` / `QuoteSubmission` in `codex/velto-technical-foundation`, read only, not modified):
  - booking: name, phone, area, address, preferredPickup, service, notes
  - quote: name, phone, area, service, approximateDetails, notes, photos
- **Integration point:** `src/components/forms/submit.ts`. `submitBooking` and `submitQuote` send nothing and return `not_connected`, so the UI shows an honest "isn't connected yet — your details have not been sent" state with WhatsApp. There is no fake success.
- **Other states:**
  - success and error states exist for when the gateway is wired, previewable in development only with `?preview=success|error`
  - validation errors are reported in text and in a focused summary
  - an out-of-area note appears for anything outside Sectors 1–18 (spec §4)
- **Photos:** chosen photos stay in the browser, up to 5 to match the contract's `photoReferences` cap. The controlled upload flow is Codex's.
- **Service preselection:** `?service=` preselects the service. `?service=regular-laundry` prefills the note "I'd like to set up a regular pickup.", because the contract has no regular-pickup field.
- **Analytics:** `booking_start` and `quote_start` fire on first interaction; `booking_success` and `quote_success` fire only on a real success.

### Notes for Codex integration

- Replace the bodies in `src/components/forms/submit.ts` with calls to the website routes. The attribution object is expected to come from `src/lib/attribution.ts`.
- `regular-laundry` is not in the contract's `ServiceSlug`. Today it travels as the `service` query parameter and becomes a note.
- The area options are free text, "Uttara Sector N" or "Outside Uttara Sectors 1–18".
- Analytics hooks use `data-analytics` attributes and `track()` as on the homepage. The event names are unchanged.

## Verification

| Check | Result |
|---|---|
| `tsc`, `eslint`, `next build` | Pass |
| 16 pages × desktop 1440 and mobile 390 | HTTP 200, exactly one `h1`, no horizontal overflow, no console errors, no broken images |
| Form behaviour (Playwright) | Validation, error summary focus, not-connected state, outside-area note, service preselect, regular prefill, photo add/remove, start events |
| Homepage regression | 0.000% pixel difference against the approved Phase 3 captures |

Screenshots are in `docs/qa/internal-pages/`.

## Decisions to confirm in review

1. **Quote-first service pages** (curtains and carpets): Request a Quote is the page's single primary action, including the mobile bar. Spec §18 names Book Pickup for the bar on service pages. Keep this deviation, or revert?
2. **Booking confirmation copy:** "The Velto team gets in touch to confirm the details". Confirm this matches how Ops confirms bookings.
3. **Blankets:** primary Book a Pickup, secondary Request a Quote, because bedding is priced by item, type and size. Confirm.
4. **Launch requirement:** real Velto photography for all internal pages. Stock is still temporary.
