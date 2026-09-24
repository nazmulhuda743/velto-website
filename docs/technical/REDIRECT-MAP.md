# Redirect Map

Verified against the legacy `velto.com.bd` site immediately before cutover planning. Redirect only URLs with a clear replacement; unknown URLs should keep a real 404 rather than being dumped onto the homepage.

| Legacy path | New path | Type | Reason |
| --- | --- | --- | --- |
| `/about-us` | `/about` | 308 | Same company/about intent |
| `/contact` | `/locations` | 308 | New locations page contains outlet/contact/directions intent |
| `/checkout` | `/book` | 308 | Legacy ecommerce checkout is replaced by pickup booking, not a cart |
| `/team` | `/about` | 308 | No standalone team page in V1; About is the closest factual company destination |
| `/services/mens-item` | `/services` | 308 | Legacy category spans multiple new service types |
| `/services/ladies-item` | `/services` | 308 | Legacy category spans multiple new service types |
| `/services/house-hold-item` | `/services` | 308 | Household category spans curtain/carpet/bedding services; overview is safest |
| `/services/special-item` | `/services` | 308 | Legacy mixed category spans dry cleaning and other itemized services |

## Rules

- Keep query strings where the platform preserves them naturally.
- Do not redirect arbitrary `/product/*`, cart fragments, malformed URLs, or unknown paths to `/`.
- The canonical host is `https://www.velto.com.bd`.
- Configure the root `velto.com.bd` domain to redirect to `www` at the Vercel domain layer.
- Re-check Search Console / analytics after cutover for meaningful 404s before adding more mappings.
