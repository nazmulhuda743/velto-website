# Launch Foundation

This layer is intentionally independent from page design. It provides the SEO,
measurement and launch plumbing needed before the Velto V1 goes live.

## Search / indexability

- `src/app/sitemap.ts` exposes only search-facing launch routes.
- `/book`, `/quote`, `/privacy`, `/terms` and API routes are intentionally not in the sitemap.
- `src/app/robots.ts` disallows all crawling on Vercel preview deployments.
- Production robots allow public pages and disallow `/api/`.
- `NEXT_PUBLIC_SITE_URL` is the canonical production origin used by sitemap and metadata.

## Metadata and structured data

The root layout now provides:

- metadata base
- default title + title template
- default description
- Open Graph defaults
- Twitter summary defaults
- WebSite schema
- Organization schema

Page-level canonical URLs, titles/descriptions and service/location schema still belong
on the relevant approved pages. Do not set one global canonical URL because that would
make every page canonicalize to the homepage.

`buildLaundryLocationSchema()` is available for approved location pages and uses only
facts already present in `src/content/site.ts`.

## Browser analytics

The website has one browser-side tag entry point: Google Tag Manager.

Set:

```text
NEXT_PUBLIC_GTM_ID=GTM-XXXXXXX
```

If the value is missing or malformed, no GTM script is rendered.

Existing `data-analytics` events are pushed into `window.dataLayer`. The event payload
also carries sanitized source / medium / campaign / content context when available.
This keeps campaign attribution useful without sending raw customer form values into
the analytics layer.

Configure inside GTM rather than hard-coding additional browser scripts:

1. GA4 configuration / Google tag
2. GA4 custom-event mapping for Velto's approved event taxonomy
3. Meta Pixel base tag
4. Meta event mapping

For Next.js client navigation, configure the GA4 page-view behavior in GTM using an
appropriate history-change/page-view setup and verify it in Preview/DebugView.

## Meta Conversions API

CAPI is deliberately not faked in this foundation commit. Before server-side Meta
conversion events are enabled, the implementation needs:

- the production Meta dataset/pixel identifier
- a server-side access token stored only in Vercel server environment variables
- an agreed browser/server `event_id` strategy for deduplication
- event mapping (for example booking success vs quote success)
- verified consent/privacy handling

Without shared event IDs, firing both browser and server conversions risks double
counting. Add CAPI only after those inputs are available.

## Launch verification

Before production activation:

- set `NEXT_PUBLIC_SITE_URL=https://www.velto.com.bd`
- set the verified GTM container ID
- verify `/robots.txt` on preview blocks crawling
- verify production `/robots.txt` allows public pages and points to the sitemap
- verify `/sitemap.xml` contains the intended launch routes
- validate Organization/WebSite JSON-LD
- use GTM Preview to confirm each approved event fires once
- verify campaign parameters survive landing → `/book` or `/quote` → submission
- verify GA4 DebugView
- verify Meta Test Events after Pixel/CAPI configuration
- run typecheck, lint, foundation tests and production build after merging page work

No production analytics IDs, Supabase credentials or Meta tokens are stored in git.
