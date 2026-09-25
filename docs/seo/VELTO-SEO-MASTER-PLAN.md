# Velto SEO master plan

Branch `claude/velto-seo-a-to-z`, researched 25 Sep 2026. Companion docs: [KEYWORD-MAP](KEYWORD-MAP.md), [CONTENT-OPPORTUNITY-MAP](CONTENT-OPPORTUNITY-MAP.md), [LOCAL-SEO-GBP-PLAN](LOCAL-SEO-GBP-PLAN.md), [SEO-MEASUREMENT-PLAN](SEO-MEASUREMENT-PLAN.md).

## 1. Executive summary

Velto can win the Uttara laundry and dry-cleaning searches because the competition is weak on basics that Google rewards:

- Most competing sites have **no H1**, **no local structured data**, **no published prices**, and **nothing specific to Uttara**.
- Several are **JavaScript-only** apps that crawlers see as near-empty. Dhopaghat serves 3 words of HTML.
- The Dhaka-wide operators (Dhopaghat, Hello Laundry, Washout, Laundry Express) cover many areas with one generic page. Uttara-only players (bdbox, WashBD, LaundryBari) are thin blog-style pages.

Velto's advantages, all real and on-site:

- a genuine Uttara focus (Sectors 1–18);
- two real outlets with verified Google ratings;
- a live, searchable price list;
- a documented garment-handling process;
- server-rendered, fast pages.

This pass makes those advantages machine-readable and query-aligned without turning the site into an SEO template:

- **Query-aligned titles and descriptions** for every indexable page, each with one primary intent and no cannibalization.
- **One clean entity graph**:
  - `Organization` for the brand;
  - one `DryCleaningOrLaundry` per real outlet;
  - `Service` for each service;
  - `BreadcrumbList` on every page.

  It replaces an invalid `LaundryService` type and a duplicate business entity.
- **Location pages rebuilt around their real intent**, "laundry and dry cleaning in Uttara Sector N", with links to every service and to pricing. The Locations page gets **one** honest Sectors 1–18 coverage block instead of 18 doorway pages.
- **Technical fixes**:
  - a default 1200×630 share image built from the real logo, and Twitter large cards;
  - `/track` set to noindex;
  - canonical and schema URLs can no longer fall back to a preview domain;
  - no fake `lastModified` in the sitemap.
- **An automated SEO audit** (`npm run test:seo`, now in CI). It crawls the build and fails on canonical, title, description, H1, JSON-LD, share-image, private-route, internal-link and redirect regressions.
- **Off-site plans** that matter as much as the website: Google Business Profile, reviews, citations, Search Console.

What moves rankings most from here is **off-site** work (section 7 and the GBP plan): two well-kept Business Profiles, a steady flow of genuine reviews, and consistent citations. The DNS cutover also has to happen first. Until then Google keeps indexing the old Webflow site.

## 2. Research methodology (and its limits)

No paid volume tool (Ahrefs, Semrush, Keyword Planner) was available, so **no search volumes are stated anywhere**. The priority model uses:

1. **Google Autocomplete for Bangladesh.** `suggestqueries.google.com` with `gl=bd&hl=en`, for 30 seed queries in English, Banglish and Bangla. Autocomplete only surfaces queries with real demand, which makes it the strongest free evidence of what people type.
2. **Web search of the organic results** for the core queries, from a US-based search tool. These results are **not localized to Dhaka** and don't show the local pack, so ranking order was not used. Only "who appears" and "what their pages are like" were used.
3. **Direct fetch of competitor pages.** Title, H1, JSON-LD types and server-rendered word count.
4. **Intent and specificity judgement.** Transactional + local + service-specific queries rank above broad informational ones.

**Not done, and it should be:** a localized SERP and local-pack check from a Dhaka IP and phone, plus Keyword Planner volumes once the Google Ads account exists (see the measurement plan).

### What autocomplete (gl=bd) showed

| Seed | Relevant suggestions Google returned | Read |
|---|---|---|
| laundry uttara | uttara laundry service · **bandbox laundry uttara** · **top clean laundry uttara** · best clean laundry uttara | Real local demand; brand-led searches for competitors |
| laundry service uttara | best laundry service in uttara · laundry service rates | "best" modifier is common, so Velto must earn it with proof, not by claiming it |
| dry cleaning uttara / dry clean uttara | dry cleaning uttara · **dry wash uttara** · **calcutta dry cleaners uttara** | "dry wash" is a local synonym for dry cleaning; Calcutta Dry Cleaners is the brand to beat |
| laundry service dhaka | laundry service bd · **online laundry service dhaka** · best laundry service in dhaka | Dhaka-wide demand exists; Velto only serves Uttara, so no Dhaka-wide landing page |
| dry cleaning dhaka | dry cleaners dhaka · **calcutta dry cleaners dhaka price list** · mohammadi dry cleaners dhaka | Strong **price list** intent |
| dry cleaning price | **dry cleaning price in bangladesh** · **dry cleaning price for saree** | Pricing page and saree prices are a real opportunity |
| laundry price | **laundry price in bd** · laundry price list | Pricing page |
| wash and iron | wash and iron near me · **wash and iron per kg** | Some expect per-kg pricing; Velto prices per item, which the page must say clearly (it does) |
| comforter cleaning | comforter cleaning pick up and delivery · comforter dry cleaning cost | Pickup + price intent for bedding |
| blanket wash | **blanket washing price** · blanket washing service | Bedding price intent |
| carpet cleaning dhaka | carpet cleaning service dhaka | Mostly on-site cleaning companies (different service) |
| uttara sector 18 | **uttara sector 18 ruap** · uttara sector 18 map | "RUAP" is how people refer to the Sector 18 area; used in the Sector 18 title |
| লন্ড্রি সার্ভিস | লন্ড্রি সার্ভিস ঢাকা · ব্যান্ড বক্স লন্ড্রি সার্ভিস | Some Bangla-script demand; English remains dominant |
| velto | **velto laundry** | Brand demand already exists |

Other local vocabulary found in competitor pages: **"porda"** (curtain), **"katha"** (quilt), **"dry wash"**. These are used where they read naturally (curtain meta description, bedding copy), never stuffed.

## 3. Competitors found

| Competitor | What ranks / appears | Title / angle | H1 | Schema | Content | Local signals | Weakness Velto can beat |
|---|---|---|---|---|---|---|---|
| **Calcutta Dry Cleaners** | Autocomplete brand, directory listings (moumachi.com.bd, LinkedIn); outlet at RAK Shopping Complex, Sector 3 | Physical dry cleaner | n/a (no strong site found) | n/a | Directory listings | Real outlet in Uttara | Weak own website; Velto can win the organic "dry cleaning uttara" result |
| **WashBD** (washbd.com) | Organic for dry cleaning / laundry Uttara | "Best Dry Cleaning & Laundry Service Uttara, Dhaka" | not fetched (site timed out) | n/a | Online-first | Mentions Uttara Model Town 1230 | Unreachable during research; "best" claim without proof |
| **bdbox** (bdbox.xyz) | Organic for laundry service Uttara | "Best Laundry Service in Uttara" | **none** | Article (blog) | ~960 words, blog-like | Uttara in title | Blog page, no H1, no LocalBusiness, no prices |
| **Dhopaghat** | Organic for Dhaka laundry | "Dhopaghat Digital Laundry" | **none** | none | **3 words** server-rendered (JS app) | All-Dhaka | Crawlers see almost nothing |
| **Pressto** (pressto.com.bd) | Dhaka dry cleaning, pricing | "Dhaka's Finest Dry Cleaners" | none | none | ~160 words | Dhaka-wide | Thin, no schema |
| **eLaundry** | Dhaka on-demand | "On Demand Laundry & Dry Clean Service" | none | none | ~690 words | Dhaka-wide | No H1, no schema |
| **Hello Laundry, Laundry Express, Washout** | Dhaka home-pickup lists | Dhaka-wide pickup | n/a (timed out) | n/a | n/a | Many areas incl. Uttara | Generic, not Uttara-specific |
| **Sheba.xyz** | Marketplace dry cleaning | "Best Laundry Dry Wash in Dhaka" | empty | LocalBusiness + AggregateRating + OfferCatalog | ~180 words | Dhaka-wide | Marketplace, not a laundry |
| **Dhaka Cleaner / GSSL / CleanNCare** | Carpet and curtain cleaning Dhaka | On-site cleaning companies | "Carpet Cleaning" | Organization, Breadcrumb | ~760 words | Dhaka-wide | Different service (on-site); Velto is a pickup laundry |
| **Listicles** (deshiz, bdbusinessfinder, mybangla24, minciter) | "Top 5 / 10 laundry services in Dhaka" | Listicles | n/a | n/a | n/a | n/a | Earn inclusion (see citation plan) |

**The local pack could not be observed from here.** Check it from a Dhaka phone for "laundry near me", "dry cleaning uttara" and "laundry sector 11 uttara", and record the top 3 in the ranking baseline.

## 4. Page architecture

One primary intent per page. The full table is in [KEYWORD-MAP](KEYWORD-MAP.md).

```
/                              laundry & dry cleaning in Uttara (head term, brand)
├── /services                  service chooser (navigational; not competing for the head term)
│   ├── /services/dry-cleaning         dry cleaning uttara · dry wash · saree/suit
│   ├── /services/wash-and-iron        wash and iron / laundry service uttara
│   ├── /services/ironing              ironing service uttara
│   ├── /services/curtain-cleaning     curtain (porda) cleaning uttara
│   ├── /services/carpet-cleaning      carpet / rug cleaning uttara
│   ├── /services/blanket-comforter-cleaning   blanket / comforter cleaning uttara
│   └── /services/express              express / urgent laundry uttara
├── /regular-laundry           weekly laundry pickup uttara
├── /pricing                   laundry / dry cleaning price uttara (price list intent)
├── /how-it-works              pickup & delivery process
├── /locations                 laundry locations uttara + Sectors 1–18 coverage
│   ├── /locations/sector-11   laundry / dry cleaning uttara sector 11
│   └── /locations/sector-18   laundry / dry cleaning uttara sector 18 (RUAP)
└── /about                     entity / brand trust
```

**Not indexed, deliberately:**

- `/book` and `/quote`: forms. They are reached from every page, and no query is better answered by a bare form than by the service page.
- `/track`: a customer utility. Order data is only returned to a matching POST, never rendered for crawlers.
- `/privacy`, `/terms`, `/cookies`: the existing project decision, unchanged.
- `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/account/*`: noindex, nofollow (portal rules, unchanged).
- `/admin`, `/api/`, `/go/`, `/auth/`: disallowed in robots.txt.

**No sector doorway pages.** The only sector pages are for the two real outlets. The 18-sector coverage lives in one block on `/locations`, which is useful to a customer checking whether their sector is covered.

**No Dhaka-wide landing page.** Velto doesn't pick up across Dhaka, and a page targeting "laundry service Dhaka" would promise something the business doesn't do. Dhaka is used only as a locality qualifier ("Uttara, Dhaka").

## 5. Changes made in this branch

### On-page
- New titles for all 16 indexable pages, all unique and under 65 characters. New descriptions for the homepage, pricing, regular laundry, locations and sector pages, plus curtain ("porda"), carpet ("rug, mat") and express.
- Service pages: the label above the H1 now reads "Dry Cleaning in Uttara" (and so on). This puts the local modifier on the page naturally without rewriting headlines that convert.
- Sector pages:
  - H1 is now **"Laundry and dry cleaning in Uttara Sector 11"** (and Sector 18), matching the query; the outlet name moves to the label;
  - a new **"What you can send from Sector N"** section links to all 7 services and to pricing.
- `/locations`: a **Sectors 1–18 coverage** block that states pickup is available in each sector, plus both drop-off addresses.
- Pricing results: each priced service name now links to its service page (price → service → book).

### Technical
- A default share image `src/app/opengraph-image.tsx` (and twitter-image) built from the supplied white logo, 1200×630. Before this, **no page had an og:image**.
- `pageMetadata`: explicit og:image, `summary_large_image` Twitter cards, and an optional `noindex`.
- The root layout and service schema now use the production-canonical `lib/seo/site.ts`. Before, they used `lib/site-url.ts`, which falls back to `VERCEL_PROJECT_PRODUCTION_URL`, so canonicals could point to a `vercel.app` host if `NEXT_PUBLIC_SITE_URL` was ever unset. Auth code still uses `lib/site-url.ts` on purpose, because email links need the real host.
- `/track` is noindex, follow.
- Sitemap: removed the per-build `lastModified` (it told Google every page changed on every deploy) and the ignored `priority`/`changefreq`.
- CI runs `npm run test:seo` after the launch and portal smoke tests.

### Schema
| Before | After |
|---|---|
| `Organization` site-wide **and** a second `DryCleaningOrLaundry` "#business" on service pages (two entities for one brand) | One `Organization` (#organization) with `location` pointing to both outlets |
| `LaundryService`: **not a schema.org type** (unused helper) | `DryCleaningOrLaundry` per outlet (#business on each location URL), with `parentOrganization`, a split `PostalAddress`, `hasMap`, `areaServed` |
| `Service` with `provider` → the duplicate entity | `Service` → `provider` #organization, `areaServed` Uttara Sectors 1–18, `availableChannel` pickup + drop-off at each outlet |
| Breadcrumbs on service pages only | `BreadcrumbList` on every indexable page |
| `WebSite` | Adds `publisher`, `inLanguage: en-BD`, `alternateName` |

**Deliberately not added:**

- **telephone**: the confirmed number is a WhatsApp line, and calls aren't verified.
- **openingHoursSpecification**: the hours are verified, but the days are not.
- **geo**: no verified coordinates.
- **priceRange / Offer**: prices live in Ops and change.
- **AggregateRating / Review**: self-serving review markup isn't eligible for rich results, and counts need re-verification.
- **FAQPage**: Google limits FAQ rich results to authoritative government and health sites.
- **SearchAction**: the sitelinks search box was retired.

## 6. Internal-link graph

```
Home ──► 6 service pages (chooser) · /pricing (#find-a-price, View Full Pricing) · /locations/* · /regular-laundry · /book
Header ──► Services · How It Works · Pricing · Locations · Track Order · Book
Footer ──► all 7 services · pricing · how it works · regular · quote · track · about · both outlets + directions
Service page ──► /pricing (price table "Search the price list") · compare block → sibling services
             ──► /how-it-works ("See how every order is handled") · /locations ("Or drop off at Sector 11 or 18")
             ──► /book?service=… (hero, final, sticky) · /quote?service=… (household)
Pricing ──► result service name → /services/<slug> (NEW) · Book <service> → /book · compare → services · household → /quote
Locations ──► each outlet page · Sectors 1–18 coverage (NEW) · /book
Sector page ──► all 7 services + /pricing (NEW) · other outlet · directions · reviews · /book
About / How It Works ──► /how-it-works · /services/dry-cleaning · /book
```

Anchors are descriptive ("Check laundry and dry cleaning prices", the service names). There's no exact-match anchor spam, and the footer lists each destination once.

## 7. Off-site priorities

1. **DNS cutover** (docs/technical/DNS-CUTOVER.md). Nothing on this branch ranks until `www.velto.com.bd` serves it.
2. **Two Google Business Profiles**, kept complete and linked to the matching location pages. See [LOCAL-SEO-GBP-PLAN](LOCAL-SEO-GBP-PLAN.md).
3. **Reviews**: a steady flow after each delivery. Sector 18 has 8 Google reviews to Sector 11's 102, and that gap is the biggest local-pack lever.
4. **Citations**: consistent name, address and phone on the directories that actually rank in Dhaka (section in the GBP plan).
5. **Search Console + baseline**. See [SEO-MEASUREMENT-PLAN](SEO-MEASUREMENT-PLAN.md).

## 8. Needs owner confirmation

- **Callable phone number.** If one exists, it would go into the schema, the Business Profiles and the citations.
- **Opening days** for both outlets. The hours are verified but the days aren't. Once confirmed, add `openingHoursSpecification`.
- **Outlet coordinates** from the Business Profile, for `geo`.
- **Official social profiles** (Facebook page etc.) for `sameAs`.
- **Business Profile URLs.** `reviewsUrl`/`directionsUrl` are Maps *search* links (TODO_VERIFY in `src/content/site.ts`); replace them with the real profile / place URLs.
- **Postal code.** Uttara uses several (Sector 11 and Sector 18 may differ). Add `postalCode` once verified.
- Whether Velto ever plans pickup beyond Uttara. The architecture keeps a Dhaka page out until it does.
