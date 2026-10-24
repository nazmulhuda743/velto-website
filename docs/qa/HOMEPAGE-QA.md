# Homepage QA

Status: **BUILT · TESTED**, 24 Oct 2026 (the homepage premium pass). The owner approves through the pull request.
This file replaces the September handoff, which described an older page: an 8-step sticky process,
placeholder location images and four placeholder reviews. None of that is on the site any more.

## The page today (`src/app/[lang]/(site)/page.tsx`)

| # | Section (id) | Background | Notes |
|---|---|---|---|
| 1 | Hero (`hero`) | white | H1, Book a Pickup, Find a Price link, four figures, photo |
| 2 | Service chooser (`services`) | warm | Three garment services with photos, household rows |
| 3 | Find a Price (`find-a-price`) | white | Search, popular prices, free delivery note. **Moved up from 6th by the owner, 24 Oct.** |
| 4 | Process (`process`) | warm | **Four steps** (owner copy, 24 Oct), one photo, "See the full garment journey" link to `/how-it-works`, delicate-garment note |
| 5 | Customer proof (`reviews`) | white | Two verified reviews. With one review it takes the row at a 62ch measure. With none, the section hides. |
| 6 | Built around Uttara (`locations`) | soft | Both outlets as text: rating, address, hours, links. No photos, no map. |
| 7 | Curtains, carpets & bedding (`household`) | white | Short strip with Request a Quote |
| 8 | Regular laundry (`regular-laundry`) | soft | Photo, copy, Set Up and WhatsApp. The review slot renders nothing until a verified one exists. |
| 9 | FAQ (`faq`) | white | Native `<details>`, one question open at a time, eases open (180ms), instant with reduced motion |
| 10 | Final booking (`book`) | navy | Photo, Book, WhatsApp, Google proof |

- No two neighbouring sections share a background.
- Every homepage image slot has a real photo or a licensed stock photo. Nothing shows a "to be supplied" placeholder.
- **Mobile booking bar:** hidden while the hero's Book button is on screen, while typing, while the cookie banner is open, and when the final section covers 60% or more of the screen. It is not on `/book`.

## Readability (website only)
| | Phones | From 768px |
|---|---|---|
| Body | 16px | 17px |
| Small | 14px | 15px |
| Caption | 14px | 14px |

- **Muted grey:** #6A7177, which gives 4.95:1 on white, 4.74:1 on warm and 4.61:1 on soft.
- **Footer** headings and the legal row are at 75% white. **Breadcrumbs** use the small size. **Input placeholders**
  use the muted grey.
- **Admin and the installed app keep their own sizes and grey**, through the `--type-*` variables and
  `html[data-surface="admin"]`.

## Verification, 24 Oct 2026 (Node 22, `next dev` with Bangla on)

| Check | Result |
|---|---|
| 11 pages × 360, 390, 768, 1280 × English and Bangla | No horizontal scroll anywhere |
| Wrapped button, nav and footer labels | None that main did not already have (before/after diff) |
| Section order and backgrounds | As in the table above, no neighbour repeats |
| Process | The 4 owner steps; the link goes to `/how-it-works` |
| Mobile bar | Hidden on the hero, shown mid-page, same as main |
| FAQ | Eases open; opens instantly with reduced motion |
| `/locations/sector-18` | Text-only hero: no photo area and no big "18" plate until a real photo is uploaded |
| Admin (`/admin`, `/admin/requests`) | 16 / 14 / 13px and #7B8288, unchanged |
| App sign-in | The app's own sizes and grey, unchanged |
| Page errors | None |

Screenshots for the review are attached to the pull request.
