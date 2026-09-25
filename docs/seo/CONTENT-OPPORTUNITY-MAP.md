# Content opportunity map

Rule: build a page only when it has a distinct intent, genuine unique content, a service Velto actually provides, and a conversion path. No blog-for-volume.

## A. Transactional / service

| # | Query cluster | Intent | Why Velto can answer | Conversion path | Build |
|---|---|---|---|---|---|
| A1 | dry cleaning price in bangladesh · laundry price in bd · dry cleaning price for saree · price list | Price comparison before choosing | Velto has a live, per-item price list, which few competitors publish | Price → service page → Book | **Next, once live pricing is switched on.** Server-render a crawlable price list on `/pricing` (grouped: saris, suits, everyday, household) from the public pricing view. Today prices appear only after a client-side search. No new URL needed. |
| A2 | saree dry cleaning · jamdani / katan / banarasi saree cleaning · wedding saree dry cleaning | High-value garment, high anxiety | Dry Cleaning already lists saris by weave with their own prices; intake checks stains first | → Dry Cleaning prices → Book | **Later, only if Search Console shows impressions** for saree queries on `/services/dry-cleaning`. Then a dedicated `/services/dry-cleaning/sarees` with real photos of the process. Not now: it would thin the dry-cleaning page. |
| A3 | sherwani / wedding outfit dry cleaning | Occasion | Same | Same | Later, same trigger as A2 |
| A4 | laundry service near me (Uttara) | Local | Covered by the homepage + Business Profiles | GBP → location page → Book | Nothing to build. This is a GBP/local-pack play |

## B. Commercial investigation

| # | Query cluster | Intent | Authority | Path | Build |
|---|---|---|---|---|---|
| B1 | wash and iron vs dry cleaning · which service for my clothes | Choosing a service | The compare block already exists on Pricing, Services, Wash & Iron and Ironing | → service → Book | **Done** (on-page compare). No separate article. |
| B2 | curtain / carpet cleaning price per sq ft | Price | Published per-sq-ft rates + worked example + measuring guide | → Quote | **Done** on the curtain and carpet pages |
| B3 | best laundry in uttara | Shortlisting | Proof: 5.0 on Google (Sector 11), written procedures, prices | → Home | Not a page. Earn it with reviews + listicle inclusion (citation plan). Never claim "best". |

## C. Informational

| # | Query cluster | Intent | Authority | Path | Build |
|---|---|---|---|---|---|
| C1 | how does dry cleaning work · ড্রাই ক্লিন কিভাবে করে (Bangla autocomplete) | Learn | Velto's intake → assessment → routing → finishing → QC process | → Dry Cleaning → Book | **Later**, as a short guide under `/how-it-works` in English and Bangla if Bangla demand shows in Search Console. Must describe Velto's real process, not generic chemistry. |
| C2 | can stains be removed / stain removal limits | Anxiety before sending | FAQ answer exists ("no laundry should promise…") | → Dry Cleaning | Done as an FAQ; a longer guide only on evidence of demand |
| C3 | how often to dry clean a suit / blazer | Care advice | Moderate | → Dry Cleaning | Low priority. Informational, weak conversion |
| C4 | how to wash a comforter at home | DIY | Would send traffic away from the service | n/a | **Don't build.** It attracts people who don't want the service. |

## D. Local questions

| # | Query | Answer lives | Build |
|---|---|---|---|
| D1 | does Velto pick up in my sector (Uttara Sector N) | `/locations` Sectors 1–18 block (**new**) + FAQ | **Done**, as one block, not 18 pages |
| D2 | laundry near Sector 11 / RUAP | Sector pages (**new H1 + service links**) | Done |
| D3 | laundry outside Uttara (Tongi, Airport, Diabari, Uttarkhan…) | Not a confirmed service area | **Don't build.** State "ask first" (already on `/locations` and in the FAQ). Revisit only if Velto confirms coverage. |
| D4 | Uttara Model Town (the whole sectored area) | Homepage / locations | Mention only where natural. "Uttara" already covers it. |

## Trigger to build more

Build A2, A3 or C1 when Search Console shows ≥ 3 months of impressions for those queries on the existing pages without top-10 rankings. That's evidence the demand is real and the current page isn't enough.
