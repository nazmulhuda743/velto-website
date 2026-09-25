# Local SEO: Google Business Profile, reviews and citations

**No external profile was modified**, because there was no access and no authorization. Existing Business Profile data was not visible from here, so nothing below claims what the profiles currently contain. It's a checklist for the owner to apply.

Known facts (spec §36): Sector 11 is 5.0★ with 102 reviews and open 9:00 AM–10:00 PM. Sector 18 is 4.9★ with 8 reviews and open 10:00 AM–9:00 PM.

## 1. Two profiles, two landing pages

| | Sector 11 | Sector 18 |
|---|---|---|
| Name (exactly, both) | **Velto Premium Laundry** (no keywords added to the name: that breaks Google's guidelines and risks suspension) | **Velto Premium Laundry** |
| Address | House 2, Road 14, Sector 11, Uttara, Dhaka | RUAP, North Side of Gate 1, Poncoboti Bazar, Sector 18, Uttara, Dhaka |
| Website field | `https://www.velto.com.bd/locations/sector-11?utm_source=google&utm_medium=organic&utm_campaign=gbp-sector-11` | `…/locations/sector-18?utm_source=google&utm_medium=organic&utm_campaign=gbp-sector-18` |
| Appointment / booking link | `https://www.velto.com.bd/book?source=gbp-sector-11` | `…/book?source=gbp-sector-18` |
| Service area | Uttara (add the sector localities Google offers; don't add areas outside Sectors 1–18) | Same |

Canonicals strip the UTM parameters, so these links don't create duplicate URLs.

After the DNS cutover, replace the Maps *search* links in `src/content/site.ts` (`directionsUrl`, `reviewsUrl`, marked TODO_VERIFY) with each profile's real place / review URL.

## 2. Categories
- **Primary:** Laundry service. Check whether "Dry cleaner" performs better for Sector 11 once Insights data exists. Don't switch primaries often.
- **Secondary (only those actually provided):** Dry cleaner · Laundromat only if self-service machines exist (probably not, so leave it out) · Carpet cleaning service only if Velto cleans carpets at its facility (it does, via pickup) · Curtain cleaning is usually not a category, so list it as a service instead.

## 3. Services and products
- **Services:** Dry Cleaning · Wash & Iron · Ironing · Curtain Cleaning · Carpet Cleaning · Blanket & Comforter Cleaning · Express (ask first) · Regular Laundry pickup · Pickup & delivery.
- One sentence each, matching the website wording. Prices only if they're kept current from Ops.
- **Products:** optional, only for fixed-price items that rarely change.

## 4. Description (750 characters max; plain, no keyword stuffing)
> Velto collects laundry, dry cleaning, ironing, curtains, carpets and bedding from homes across Uttara Sectors 1–18 and returns them cleaned, finished and packed. Every order is checked in, counted and tagged, garments and visible stains are looked over before cleaning, and finished items are checked again before packing. Orders of ৳499+ get free pickup and delivery. You can also drop off at our [Sector 11 / Sector 18] outlet. Check prices and book a pickup at velto.com.bd.

## 5. Photos (real only; replace the stock placeholders on the website with the same shots)
Outlet exterior with signage (day), outlet interior/counter, intake and tagging, stain assessment, pressing/finishing, packed orders, rider at a door (with consent), curtains/carpets being handled. Geotagging is not needed; consistency and freshness are what matter.

## 6. Reviews (the biggest local-pack lever)
- **Ask every delivered order.** Rider or WhatsApp message after delivery, with the direct review link for that outlet. The order is linked to an outlet, so Sector 18 customers review Sector 18, which closes the 8-vs-102 gap.
- **Never** incentivise, gate (asking only happy customers), bulk-request, or post staff/family reviews. All of these violate Google policy.
- **Respond to every review** within a few days, in the reviewer's language, signed "Velto Sector 11/18". For complaints: acknowledge, move the conversation to WhatsApp, and don't debate publicly.
- Reviews added in **Admin → Reviews** appear on the website and are matched to service pages automatically (with the reviewer's words unchanged).

## 7. Q&A and posts
- Seed Q&A from the FAQ, answered by the owner: service area, free pickup threshold, turnaround, stains, express.
- Posts: occasional offers or seasonal notes (winter blankets, Eid/wedding sarees), linking to the matching service page.

## 8. Duplicate-listing risk
- Search Maps for "Velto" and both addresses. Merge or remove any duplicate or old pin (e.g. a Webflow-era listing or a rider-created pin).
- Keep the business name identical on both profiles. Don't create profiles for areas without a staffed outlet (that counts as a virtual office and gets suspended).

## 9. Citations and entity signals (Bangladesh)
Keep name, address and phone **identical** to the profiles everywhere. Use a phone number only once one is confirmed callable (currently only WhatsApp +880 1605-162788 is confirmed).

| Priority | Where | Why |
|---|---|---|
| 1 | Facebook Page (one per brand, with both addresses in About), linked from the site footer once confirmed | The main discovery channel in Bangladesh; also a `sameAs` for schema |
| 1 | Google Business Profiles (above), Apple Business Connect, Bing Places (import from Google) | Maps coverage beyond Google |
| 2 | Directories that already rank for these queries: **moumachi.com.bd**, **bdbusinessfinder.com**, **bdtradeinfo.com**, **tradebangla.com.bd** | They appear in laundry/dry-cleaning results for Uttara and Dhaka |
| 2 | Listicles that rank ("Top online laundry services in Dhaka": deshiz.com, mybangla24.com, minciter.com) | Ask for inclusion with real facts; don't pay for placement |
| 3 | Local partnerships: RUAP residential association (Sector 18), apartment societies, hotels, serviced apartments and corporate offices in Uttara | Real relationships create real links and mentions |
| 3 | Local press or community pages (Uttara Facebook groups): useful content only, such as winter bedding care or the stain guide | Mentions, not link schemes |

Avoid mass directory submissions, paid link packages, PBNs and "SEO backlink" gigs.
