# Real Velto photo shot list

Status: **needed**. The site currently uses licensed stock and a few owner-supplied photos. These are the photos only Velto can provide, in priority order.

Each one replaces stock in a section that makes a factual claim about Velto, or fills a slot that is image-free today because stock would misrepresent a real place.

Upload through the admin dashboard, under Images, using the slot id shown. Alternatively, drop the file in `public/images/` and update `src/content/mock.ts`.

## General direction

- Natural daylight or the outlet's normal lighting. No heavy filters.
- Real staff at work, but faces are optional. Hands, garments and tags usually tell the story better.
- No customer names, phone numbers or order details legible in frame.
- Shoot landscape (3:2) unless noted, at least 2000 px on the long edge.
- Keep the background tidy. Don't stage it to look like a hotel.

## Priority 1: real places (no stock is allowed here)

| # | Shot | Slot id | Where it shows | Notes |
|---|---|---|---|---|
| 1 | ~~Sector 11 outlet: street-level frontage with the Velto sign readable~~ **Done (2026-09-25)** | `locations.sector-11` | Homepage locations, /locations, /locations/sector-11 hero | 3:2. Daytime, sign legible, entrance visible. |
| 2 | Sector 18 outlet at Poncoboti Bazar: frontage or counter with signage | `locations.sector-18` | Homepage locations, /locations, /locations/sector-18 hero | 3:2. Include the RUAP gate context if it helps people find it. |

## Priority 2: process claims (currently illustrated with stock)

| # | Shot | Slot id | Where it shows |
|---|---|---|---|
| 3 | A Velto rider handing a packed order to a customer at a door in Uttara | `process.0` / `process.7` | Homepage process, How It Works |
| 4 | Intake: garments being counted at the counter against an order slip | `process.1` | Homepage process |
| 5 | A Velto tag being attached to a garment (tag clearly visible, no customer data) | `process.2` | Homepage process, How It Works stage 1 |
| 6 | Stain or condition check: a hand turning back a collar or cuff under good light | `process.3` | Homepage process, How It Works stage 2, Dry Cleaning |
| 7 | Pressing or finishing a shirt or sari | `process.4` | Homepage process, How It Works stage 3, Ironing |
| 8 | Final check of finished garments on a rail | `process.5` | Homepage process |
| 9 | A packed Velto order: folded or covered garments with a Velto tag or bag | `process.6` | Homepage process, How It Works stage 4, Wash & Iron |

## Priority 3: service context

| # | Shot | Slot id | Where it shows |
|---|---|---|---|
| 10 | A curtain being measured or taken down in a Dhaka home | `household` or `curtainsMeasured` | Curtain Cleaning |
| 11 | A carpet being measured or rolled for pickup | `carpet` / `carpetMeasured` | Carpet Cleaning, homepage household row |
| 12 | Comforters or blankets folded and bagged after cleaning | `blankets` | Blankets & Comforters, homepage household row |
| 13 | A sari or sherwani on a hanger in a Velto cover | `dryCleaning` or `delicate` | Dry Cleaning, homepage |
| 14 | Staff at work inside the outlet (hands or over-the-shoulder is fine) | `about` | About hero |

## Priority 3b: Blanket ৳999 landing page (`/blanket-cleaning-uttara`)

The page sells one package, so its photos carry the decision. Slots start with the licensed bedding photo (hero)
and line drawings (the two category cards) until these arrive.

| # | Shot | Slot id | Where it shows | Notes |
|---|---|---|---|---|
| 15 | Three regular blankets washed, folded and stacked, a Velto tag visible, on the outlet counter or at a door | `b999.hero` | Page hero | 4:5 crop on desktop, 4:3 on phones: keep the stack centred. |
| 16 | One regular single or double-bed blanket, folded, normal thickness | `b999.regular` | "Regular / Medium" card | 16:10. Plain background. |
| 17 | A heavy or oversized blanket (thick mink or Korean style) folded next to a regular one, so the size difference is obvious | `b999.heavy` | "Heavy / Large" card | 16:10. The comparison is the point. |

The real Sector 11 outlet photo (`locations.sector-11`) already shows in this page's "Why Velto" section.

## Owner-supplied photos to confirm

`hero`, `dryCleaning`, `washAndIron`, `ironing` and `regular` were supplied by the owner. Please confirm where each came from and that Velto may use it commercially. Several look AI-generated; if so, record the tool and its terms in `docs/brand/IMAGE-SOURCES.md`.
