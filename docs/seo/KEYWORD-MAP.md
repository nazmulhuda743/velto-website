# Keyword map

One primary intent per indexable page. Evidence and method: [VELTO-SEO-MASTER-PLAN §2](VELTO-SEO-MASTER-PLAN.md). No search volumes are claimed. Priority comes from demand evidence (Bangladesh autocomplete, competitor targeting) × commercial intent × Velto's ability to fulfil the query.

**P0** = the main revenue queries. **P1** = strong supporting queries. **P2** = trust or supporting pages.

## Summary

| Page | Primary query | Secondary queries | Intent | Local target | Title (new) | H1 | Change made |
|---|---|---|---|---|---|---|---|
| `/` | laundry & dry cleaning in Uttara | laundry service uttara · uttara laundry service · laundry pickup uttara · velto laundry | Transactional + brand | Uttara (Sectors 1–18), Dhaka | Laundry & Dry Cleaning in Uttara with Pickup \| Velto | Laundry and dry cleaning in Uttara, with pickup from your door. (locked, unchanged) | Title + description; links from the locations block to outlet pages |
| `/services` | laundry services list (navigational) | velto services · dry cleaning / wash & iron / curtain services | Navigational | Uttara | Velto Services: Dry Cleaning, Wash & Iron, Curtains & More | Which service do you need? | Title moved off the head term to avoid cannibalizing `/` |
| `/services/dry-cleaning` | dry cleaning uttara | dry cleaner uttara · dry wash uttara · saree / suit / sherwani dry cleaning | Transactional | Uttara | Dry Cleaning in Uttara: Suits, Saris & Sherwanis \| Velto | Dry cleaning for garments that need a closer look. | Title; label "Dry Cleaning in Uttara" |
| `/services/wash-and-iron` | wash and iron uttara | laundry service uttara (supporting) · wash and iron near me | Transactional | Uttara, Dhaka | Wash & Iron Laundry Service in Uttara, Dhaka \| Velto | Everyday laundry, washed, ironed and brought back. | Title; label |
| `/services/ironing` | ironing service uttara | ironing service near me · clothes ironing pickup | Transactional | Uttara | Ironing Service in Uttara with Pickup & Delivery \| Velto | Already washed? Send it for ironing. | Title; label |
| `/services/curtain-cleaning` | curtain cleaning uttara | porda cleaning · curtain cleaning price per sq ft | Transactional + price | Uttara | Curtain Cleaning in Uttara, Priced per Sq Ft \| Velto | Curtain cleaning, priced by the square foot. | Title; description adds "porda"; label |
| `/services/carpet-cleaning` | carpet cleaning uttara | rug cleaning · carpet wash · carpet cleaning price per sq ft | Transactional + price | Uttara | Carpet & Rug Cleaning in Uttara, per Sq Ft \| Velto | Carpet cleaning, priced by size. | Title; description adds rug/mat; label |
| `/services/blanket-comforter-cleaning` | blanket / comforter cleaning uttara | comforter cleaning pick up and delivery · blanket washing price · quilt/katha | Transactional + price | Uttara | Blanket & Comforter Cleaning in Uttara \| Velto | Blankets, comforters and quilts, priced by type and size. | Label |
| `/services/express` | express laundry uttara | urgent laundry · same-day dry cleaning (only as "ask first") | Transactional | Uttara | Express Laundry & Dry Cleaning in Uttara \| Velto | Need it back sooner? Ask about Express. | Title casing; description adds Uttara |
| `/regular-laundry` | weekly laundry pickup uttara | laundry subscription · regular laundry service | Transactional | Uttara | Weekly Laundry Pickup in Uttara \| Velto Regular Laundry | A regular laundry pickup, so the week takes care of itself. | Title + description (৳300+ rule) |
| `/pricing` | laundry price uttara / dry cleaning price | dry cleaning price in bangladesh · laundry price in bd · dry cleaning price for saree · price list | Commercial investigation | Uttara | Laundry & Dry Cleaning Prices in Uttara \| Velto | Find the price of an item. | Title + description; results link to service pages; breadcrumb schema |
| `/how-it-works` | how laundry pickup works | laundry pickup and delivery process | Informational → transactional | Uttara | How Laundry Pickup & Delivery Works in Uttara \| Velto | From your door and back again. | Title; breadcrumb schema |
| `/locations` | laundry locations uttara | laundry near me uttara · which sectors covered | Local navigational | Uttara Sectors 1–18 | Velto Laundry Locations in Uttara: Sector 11 & Sector 18 | Two outlets in Uttara. Pickup across Sectors 1–18. | Title + description; **Sectors 1–18 coverage block** |
| `/locations/sector-11` | laundry uttara sector 11 | dry cleaning sector 11 · laundry near me (Sector 11) | Local transactional | Uttara Sector 11 | Laundry & Dry Cleaning in Uttara Sector 11 \| Velto | **Laundry and dry cleaning in Uttara Sector 11** (was "Velto Sector 11") | H1, title, description; services + pricing links; business schema |
| `/locations/sector-18` | laundry uttara sector 18 | laundry RUAP · dry cleaning sector 18 · uttara sector 18 ruap | Local transactional | Uttara Sector 18 (RUAP) | Laundry & Dry Cleaning in Uttara Sector 18, RUAP \| Velto | **Laundry and dry cleaning in Uttara Sector 18** (was "Velto Sector 18") | Same as Sector 11 |
| `/about` | velto laundry (brand) | about velto · velto uttara | Brand trust | Uttara, Dhaka | About Velto: Laundry & Dry Cleaning in Uttara, Dhaka | A laundry in Uttara that works to a written process. | Title; breadcrumb schema |

Not indexed (documented decisions): `/book`, `/quote`, `/track`, `/privacy`, `/terms`, `/cookies`, the auth pages, `/account/*` and `/admin`. Rationale is in the master plan §4.

## Page detail

### `/` Homepage (P0)
- **Purpose:** the Uttara head term plus brand searches. It routes each visitor to a service, prices or booking.
- **Target customer:** an Uttara household choosing a laundry, on mobile.
- **Before:** title "Velto Premium Laundry — Laundry & dry cleaning in Uttara" (brand first).
- **Meta:** "Laundry, dry cleaning and ironing in Uttara, Dhaka. Pickup from your door across Sectors 1–18, every item tagged and checked. Free pickup on ৳499+."
- **Links to:** all service pages, pricing, the locations block → each outlet page (**new**), regular laundry, book.
- **Schema:** WebSite, Organization, 2 × DryCleaningOrLaundry.
- **Gaps:** none structural. The H1 already contains the head term.
- **Cannibalization:** `/services` retitled to avoid it; sector pages carry a sector modifier; pricing carries "prices".

### `/services/dry-cleaning` (P0)
- **Purpose:** "dry cleaning uttara", and local synonyms "dry wash" and "dry cleaner".
- **Target customer:** people with suits, saris, sherwanis or winter wear.
- **Before:** "Dry Cleaning in Uttara, Dhaka — suits, saris, sherwanis | Velto".
- **Links to:** pricing (price table), compare → Wash & Iron / Ironing, how it works, locations, book.
- **Schema:** Service + BreadcrumbList.
- **Gaps:** saree price intent ("dry cleaning price for saree") is served by the live price table and pricing search; the FAQ on stains is present.
- **Cannibalization:** low.

### `/services/wash-and-iron` (P0)
- **Purpose:** everyday laundry; supports "laundry service uttara" for people who mean washing.
- **Note:** "wash and iron per kg" appears in autocomplete. Velto prices per item, which the page states; don't imitate per-kg pricing.
- **Cannibalization:** shares "laundry" with `/`. Mitigated because the title is Wash & Iron-specific.

### `/services/ironing` (P1)
- Distinct from Wash & Iron (the compare block explains the difference).

### `/services/curtain-cleaning` (P1), `/services/carpet-cleaning` (P1), `/services/blanket-comforter-cleaning` (P1)
- **Purpose:** household items, priced per sq ft or per piece, with a quote-first path.
- **Competitors:** carpet and curtain SERPs are dominated by *on-site* cleaning companies (Dhaka Cleaner, GSSL). Velto's angle is pickup and facility cleaning with published rates, and the titles say "priced per sq ft".
- **Links to:** quote, price table, measuring guide, how it works.

### `/services/express` (P2)
- Must never promise same-day delivery. The page and meta say "ask first".

### `/regular-laundry` (P1)
- Recurring intent, with the ৳300+ regular-order rule in the meta.

### `/pricing` (P0)
- **Demand evidence:** "dry cleaning price in bangladesh", "laundry price in bd", "calcutta dry cleaners dhaka price list", "blanket washing price".
- **Gap to close later:** the price data renders client-side after a search, so crawlers see the explainer but not the prices. See the content-opportunity map, item A1: a crawlable price list.

### `/locations`, `/locations/sector-11`, `/locations/sector-18` (P0 for the sector pages)
- **Sector pages** answer "laundry / dry cleaning in Uttara Sector N" with:
  - address, hours, that outlet's own rating, directions;
  - that pickup covers all of Sectors 1–18;
  - links to every service and to pricing (**new**).
- **Sector 18** uses "RUAP" (autocomplete: "uttara sector 18 ruap").
- **No other sector pages.** Coverage is the 1–18 block on `/locations`.

### `/how-it-works` (P2), `/about` (P2)
- Trust and entity pages. They support E-E-A-T and brand searches, and link to services and booking.
