# Technical SEO Launch Audit

Canonical origin: `https://www.velto.com.bd`.

## Indexing contract

Indexable launch routes are the homepage, service overview/detail pages, Regular Laundry, Pricing, How It Works, Locations/detail pages and About.

Intentional `noindex,follow` utility routes:
- `/book`
- `/quote`
- `/track`
- `/privacy`
- `/terms`

`/admin`, `/api/*` and `/go/*` are blocked from crawling. Vercel Preview deployments additionally emit `X-Robots-Tag: noindex, nofollow, noarchive` and robots disallows all.

## Metadata

- Every public route has a registry title and description, with controlled admin overrides.
- Canonicals are route-specific and use the reviewed production origin.
- Search-facing pages inherit Open Graph metadata; admin SEO overrides can set an approved share image.
- Sitemap contains search-facing routes only and excludes conversion/legal/tracking/admin utilities.

## Structured data

Global site layout:
- `WebSite`
- `Organization`

Service detail pages:
- `Service`
- `BreadcrumbList`

Location detail pages:
- `LaundryService`
- `BreadcrumbList`

No review/rating aggregate is emitted in schema markup. The structured data therefore does not convert editable Google proof into an unsupported search-engine rating claim.

Sector 11 and Sector 18 each get a separate URL and LaundryService `@id`, so their entities do not collide. Organization remains the common provider.

## Heading/internal-link integrity

Launch smoke requires one H1 on every known public route and validates all declared routes return successfully. Navigation/footer/service/location links use the current route system. Legacy high-value paths are covered by the reviewed redirect map rather than homepage catch-all redirects.

## Items requiring launch-day verification

- Admin-editable location rating/review-count text must be checked against the intended Google profiles immediately before launch. It is not included in schema ratings.
- The final customer/consent PR must not accidentally add indexable account/login utility pages without an explicit SEO decision.
- After domain cutover, run `verify:launch` to confirm real-domain title/description/canonical/noindex/Open Graph/robots/sitemap behavior.
