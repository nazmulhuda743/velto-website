# SEO measurement plan

Search Console, Bing Webmaster Tools and the ranking baseline **were not set up in this branch**, because there was no access. Below are the exact steps, to run right after the DNS cutover (docs/technical/DNS-CUTOVER.md §D5).

## 1. Google Search Console
1. Add a **Domain property** `velto.com.bd`, verified by DNS TXT record in Cloudflare. This doesn't touch the A or CNAME records. It covers `www`, the apex and http/https.
2. Submit `https://www.velto.com.bd/sitemap.xml` (16 URLs).
3. URL Inspection → Request indexing for: `/`, `/services/dry-cleaning`, `/services/wash-and-iron`, `/pricing`, `/locations/sector-11`, `/locations/sector-18`.
4. Link Search Console to GA4 (once GA4 is set up in GTM).
5. Keep the old Webflow property (if one exists) for a few months to watch 404s and redirects.

## 2. Bing Webmaster Tools
Import from Search Console, which is one click, and submit the same sitemap. Bing also feeds some AI and assistant answers.

## 3. Index coverage checks (weekly for the first 8 weeks, then monthly)
- **Indexed pages** should match the 16 sitemap URLs.
- `/book`, `/quote`, `/track`, the legal pages, auth and account should appear only as "Excluded by noindex".
- Watch for "Duplicate, Google chose different canonical", "Soft 404" and "Crawled – currently not indexed" on the service and sector pages.
- 404s from old Webflow URLs: add redirects in `next.config.ts` for any that get traffic.

## 4. Core Web Vitals
Search Console → Core Web Vitals (field data, mobile first), plus PageSpeed Insights on `/`, `/services/dry-cleaning` and `/pricing`. Targets: LCP < 2.5 s, INP < 200 ms, CLS < 0.1. The hero image is `priority`, images reserve space, and the review carousel is CSS-only.

## 5. Reporting (monthly)
| Metric | How |
|---|---|
| Branded vs non-branded clicks | Search Console → Performance, query filter: regex `velto` (branded) vs `^(?!.*velto)` |
| Local queries | Query contains `uttara` / `sector` / `ruap` |
| Service queries | Per page: impressions, clicks, CTR, average position for the primary query in the keyword map |
| CTR | Pages with position ≤ 10 and CTR well below the page average are title and description rewrite candidates |
| Organic conversions | GA4 (consent-granted sessions): `book_pickup_click`, `booking_success`, `quote_success`, `whatsapp_click` with session source/medium = google/organic. The Command Center dashboard shows first-party funnel data independently of GA4. |
| Business Profile | Insights per outlet: calls, direction requests, website clicks (UTM `gbp-sector-11/18`) |

## 6. Ranking baseline (week 0, then monthly)
Record positions from a **Dhaka mobile connection**, logged out, for each primary query in the keyword map, plus the local pack (top 3) for:
- laundry service uttara · laundry near me · dry cleaning uttara · dry cleaner uttara · laundry uttara sector 11 · laundry uttara sector 18 · curtain cleaning uttara · carpet cleaning uttara · velto laundry

Record: date, query, organic position, whether Velto is in the local pack, and the competitors in the top 3. A spreadsheet is enough. Paid rank trackers are optional.

## 7. Keyword volumes
When the Google Ads account exists, pull Keyword Planner volumes (location: Dhaka) for the keyword map's primary and secondary queries, and add them to KEYWORD-MAP.md with the date and source. Until then, no volumes are stated.

## 8. Automated checks (already in CI)
`npm run test:seo` crawls the production build and fails on:
- sitemap host or status problems;
- missing, duplicate or wrong-host canonicals;
- missing or duplicate titles and descriptions, titles over 65 characters;
- H1 count ≠ 1;
- malformed JSON-LD;
- missing og:image;
- metadata pointing at localhost or `vercel.app`;
- indexable private routes;
- internal 404s;
- old-URL redirects that aren't permanent or land on a non-200 page.
