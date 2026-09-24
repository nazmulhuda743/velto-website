# Velto Website Command Center

Status: **BUILT · TESTED** on `claude/velto-dashboard-command-center`. Not approved, not deployed.
Nothing here is active in production: every write path is behind switches that default to off.

## Scope

The website dashboard owns **website content, marketing intelligence, visitor analytics, campaign
attribution, consent, conversion and website health**. Velto Ops remains the source of truth for
orders, customers, payments, staff and operations. The Command Center reads Ops tasks and does not
change them. There is no second request-status workflow.

## Admin routes

| Route | Purpose |
|---|---|
| `/admin` | Command center: conversion rate, visitors, sessions, booking starts, bookings, quotes, WhatsApp, deltas vs the previous period, compact funnel, secondary signals, needs-attention, latest requests, content status |
| `/admin/funnel` | Funnel (landing → service → pricing → started → sent, plus WhatsApp fallback), filterable by date, service, source, campaign and device; breakdowns by device and source |
| `/admin/marketing` | Traffic and conversions by channel, a UTM campaign table, and the tracked campaign link builder |
| `/admin/visitors` | New vs returning, devices, grouped journeys, top/landing/exit pages, service interest, price searches, time of day |
| `/admin/consent` | Consent decisions and rates, tracking health, signal timestamps, warnings |
| `/admin/health` | Live checks (Supabase, content store, pricing source, media storage, pricing/booking/quote/tracking APIs, canonical, robots, sitemap, admin auth, GTM, ingestion), recent errors, 404s, content configuration |
| `/admin/notifications` | Derived notifications with "mark all as read" |
| `/admin/requests` | Existing screen plus totals, open age, breakdowns and quick filters (New, Today, Bookings, Quotes, Open, Done, Sector 18, Household, Paid Social, Organic, Direct) |
| `/admin/seo`, `/admin/images`, `/admin/reviews` | Existing screens with issue badges, filters, image source/alt/focus/last-changed/fallback, and review order/outlet/service links/source |

Every route sits in `app/admin/(panel)`, whose layout calls `requireAdmin()`. Admins are re-checked
against the Ops `profiles` table on every request. Every server action also calls `requireAdmin()`.

## Consent

- **Categories:** Essential (always on), Analytics (GA4 and first-party measurement), Marketing (Meta Pixel,
  advertising measurement, future CAPI eligibility). There is no Preferences category because the site
  has no preference cookies.
- **Banner:** on first visit it is a bottom sheet on mobile and a floating panel at the bottom left on
  desktop. It never covers the page. "Reject non-essential" and "Accept all" are identical buttons side
  by side, and "Manage preferences" opens a modal `<dialog>` with switches. Footer → **Cookie settings**
  reopens it. `/cookies` describes each cookie; `/privacy` links to it.
- **Cookie** `velto_consent_v1`: `{"version":1,"analytics":bool,"marketing":bool,"timestamp":ISO}`, kept 6 months.
  A new `CONSENT_POLICY_VERSION` (`src/lib/consent.ts`) makes the site ask again.
- **Before consent:** GTM is **not loaded**. That means GA4 and Meta Pixel cannot load either, and there is
  no `<noscript>` GTM iframe. The first-party sender drops every behavioral event, and the Consent Mode v2
  default (all denied) is the first data-layer entry. The only request is an anonymous `banner_view` count.
- **After consent:** GTM loads if Analytics or Marketing was granted. The site sends `gtag('consent','update',…)`
  and a `velto_consent` data-layer event (`velto_consent_analytics` / `velto_consent_marketing`).
  **GTM configuration requirement:** the GA4 tag must require `analytics_storage`, and Meta tags must
  require `ad_storage` (or trigger on `velto_consent` with marketing = true).
- **Withdrawal:** removes `velto_vid`, the analytics session, `_ga*`, `_fbp`, `_fbc` and `_gcl_*`.
- **Server enforcement:** `/api/collect` reads the consent cookie itself and drops behavioral events
  unless analytics was granted. The client check is not trusted.
- **Booking/quote attribution:** `fbclid`/`fbc`/`fbp`/`gclid` are sent onward only with Marketing consent.
  Each request also carries `consent=essential|analytics|marketing|analytics+marketing|none` (for future CAPI),
  a coarse `device`, the external `referrer` host, and, only with Analytics consent, the anonymous
  `analytics_session`. These go through the existing sanitizer in `src/lib/attribution.ts` into the Ops
  "Campaign:" line.

## First-party analytics

Browser (`src/lib/analytics/client.ts`) → `POST /api/collect` (same-origin only, JSON ≤ 8 KB, per-instance
flood control on a salted in-memory IP hash, and the raw IP is never stored) → `website_analytics_events`.

Stored per event: random visitor id (first-party cookie, 13 months), random session id (30-minute idle),
event name (taxonomy only), pathname (query and fragment dropped, long digit runs and emails redacted),
service/placement/detail slugs (never free text), landing page, referrer **host**, UTM fields (values that
look like an email or phone number are dropped), click-id **presence** (`fbclid`/`gclid`, only with
marketing consent), device class from viewport width, new-visitor flag, and marketing-consent flag.

Never stored: name, phone, email, raw IP, precise location, form content, keystrokes, user agent.

Events: `page_view`, `service_view`, `pricing_search`, `book_pickup_click`, `booking_start`, `booking_success`,
`booking_error`, `quote_start`, `quote_success`, `whatsapp_click`, `google_reviews_click`, `directions_click`,
`track_order_open`, plus the existing taxonomy. Consent outcomes (`cookie_banner_view`, `consent_accept_all`,
`consent_reject_nonessential`, `consent_preferences_saved`) are stored **anonymously** in
`website_consent_events`, with no visitor or session id.

## Schema — `docs/technical/sql/website_analytics.sql`

| Object | Contents |
|---|---|
| `website_analytics_events` | raw behavioral events (above) |
| `website_consent_events` | action, analytics, marketing, policy version, device |
| `website_server_events` | kind (`booking_error`, `quote_error`, `pricing_error`, `tracking_error`, `not_found`, `media_upload_error`, `content_save_error`), route, safe code, path |
| `website_health_checks` | last status and last successful time per dashboard check |
| `website_analytics_daily` | daily aggregates by event, path, service, device, UTM source/medium/campaign and referrer host |
| `website_analytics_sessions(from,to,limit)` | one compact row per session; the dashboard aggregates in `src/lib/admin/insights.ts` |
| `website_analytics_health()`, `website_consent_summary(from,to)` | tracking signals and consent counts |
| `website_analytics_rollup(day)`, `website_analytics_purge()` | aggregation and retention |

RLS is enabled on every table. `anon`, `authenticated` and `public` have all privileges revoked, and only
`service_role` can read, write or execute. The browser never reaches these objects.

### Retention

| Data | Kept |
|---|---|
| Raw behavioral events | **90 days**. Custom dashboard ranges are capped at 90 days to match. |
| Daily aggregates | 25 months |
| Consent decisions | 13 months |
| Server/health events | 90 days |

`website_analytics_purge()` rolls up any day that is about to expire (and yesterday) before deleting.
Schedule it daily with pg_cron (see the end of the SQL file). The job is **not** scheduled anywhere yet.

### Staging

Applied to **Velto Staging - Prod Clone (`ekgdefcdqcsqvpbqponv`)** only, as migration
`website_analytics_command_center`. Verified inside a rolled-back transaction: inserts, per-session rows,
health, consent summary, rollup and purge. Also verified that `anon`/`authenticated` have no table or
function privileges and `service_role` does. **Production is untouched.**

## Notifications

These are derived on every dashboard render from data the dashboard already reads: new open requests
under 24 h old, requests open more than 24 h, booking/quote/pricing/tracking errors, media upload and
content save failures, ingestion silence over 6 h, a missing GTM ID, mock pricing, and noindexed pages.
The bell shows the unread count. The overview, requests and notifications pages refresh every 2 minutes
while visible. "Mark all as read" stores a timestamp cookie scoped to `/admin`.

## Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `WEBSITE_ANALYTICS_WRITES_ENABLED` | server | `"true"` enables storing events, consent decisions and server events. **Default off.** |
| `NEXT_PUBLIC_GTM_ID` | public | existing; GTM loads only after consent |
| `VELTO_SUPABASE_URL`, `VELTO_SUPABASE_SECRET_KEY` | server | existing; dashboard reads and analytics writes |
| `ADMIN_SESSION_SECRET` | server | existing; Health warns when it is unset |
| `VELTO_ADMIN_PREVIEW` | local only | `1` with `next dev` shows synthetic data and a preview admin. It has no effect in any production build (`NODE_ENV=production`). |

`.env.example` belongs to the production-readiness PR, so this variable list lives here. Add
`WEBSITE_ANALYTICS_WRITES_ENABLED=false` to it when both PRs land.

## Tests

- `node scripts/command-center-tests.mjs` (added to CI): consent cookie format and versioning, Consent Mode
  signals, collect validation and redaction, channel classification, funnel monotonicity, no invented
  rates, UTM grouping, Dhaka date ranges and the 90-day cap, and request intelligence.
- Existing gate: `test:security`, `typecheck`, `lint`, `test:foundation`, `build`, `test:launch`.
- Browser QA (production build): before consent, no GTM request and no behavioral events. After accept or
  save, GTM loads and events flow. After reject, only the consent cookie is set. The footer reopens
  preferences. The banner was checked at 1440, 1280, 1024, 390 and 360. Screenshots are in
  `docs/qa/command-center/`.
- Endpoint: cross-origin → 403, no origin → 403, non-JSON → 415, malformed → 400, over 8 KB → 413,
  events without a consent cookie → 204 with nothing stored.
- Every `/admin/*` route redirects to `/admin/login` in a production build, even with `VELTO_ADMIN_PREVIEW=1`.
- The client bundle was scanned for server secrets and service tables: none found.

## Production activation plan

1. Review and merge this PR after the production-readiness PR, then add the env line to `.env.example`.
2. Review `website_analytics.sql`, then apply it to production in a maintenance window.
3. Schedule `website_analytics_purge()` daily with pg_cron.
4. In GTM, require consent on the GA4 tag (`analytics_storage`) and the Meta tags (`ad_storage`), and
   publish. Verify in GTM preview that nothing fires under "Reject non-essential".
5. Set `NEXT_PUBLIC_GTM_ID` and `WEBSITE_ANALYTICS_WRITES_ENABLED=true` on a Vercel **preview** pointed at
   staging, and walk accept, reject, custom and withdraw.
6. Enable on production. Confirm on `/admin/consent` that events arrive and "last event" is recent.
7. Update `/cookies` and `/privacy` "Last updated" dates if the live setup differs from what they describe.

## Known limits / blockers

- `/api/track` belongs to the production-readiness PR, so tracking **failures** are not logged yet. The
  Health check reports configuration only. After both PRs merge, add
  `after(() => logServerEvent("tracking_error", "/api/track", code))` there.
- GA4 and Meta Pixel sit inside GTM, so the dashboard can confirm the container but cannot see which tags
  are published. Those rows say so.
- Revenue is not shown. Orders are not yet linked to website sessions, and no number is invented.
- The anonymous analytics session travels with booking/quote attribution (Analytics consent only), which
  lets Ops join a request to its journey later. That join is not built.
- There is no QR code in the link builder, because it would need a dependency.
