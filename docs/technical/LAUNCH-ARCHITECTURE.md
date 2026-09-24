# Velto Launch Architecture

Audit baseline: `b0822b854c42eaabe1f653a397fb8b03ab71f3d8` (25 September 2026).

## Dependency map

- Public Next.js site -> admin-managed `website_content` for SEO/settings/images/reviews, with built-in defaults as read fallback.
- Public pricing UI -> `/api/prices` -> server-only Supabase pricing adapter -> `website_pricing_public` -> `price_list`.
- `/book` -> `/api/bookings` -> Ops gateway -> `website_create_request` -> existing `tasks` as `pickup`.
- `/quote` -> `/api/quotes` -> Ops gateway -> `website_create_request` -> existing `tasks` as `call`.
- `/track` -> `/api/track` -> durable `website_track_rate_limit` + `website_track_order` -> existing `orders`.
- Admin -> server-side admin session -> existing Supabase Auth/profile -> service-role-only `website_content` and `website-media` operations.
- Browser measurement -> GTM hook when configured. Customer consent gating is owned by the separate customer/consent workstream and must be verified after that PR lands.
- Hosting/domain -> Vercel -> canonical `https://www.velto.com.bd`.

## Production drift found

Production project `erutxtnepbejdxkoimeo` currently has the operational tables, the approved pricing view, `tasks_dedupe_uidx`, and an older `website_create_request`.

Before launch migration it does not have:

- `website_content`
- `website-media` bucket
- `website_track_rate_limits`
- `website_track_rate_limit`
- `website_track_order`

The existing production `website_create_request` uses `search_path=public` and the older Sector-18 regex that can interpret `Outside Uttara Sectors 1–18` as Sector 18. The reviewed replacement fixes this and tightens payload/service/attribution handling.

Production also lacks staging's optional `orders.v2_promised_at`. Tracking therefore reads the already matched order row as JSON and safely returns `promisedAt=null` when the field is absent. Identity matching remains order number + normalized phone.

Production pricing itself is current: 534 public rows, 195 items, fingerprint `1ca4d69df562cf967ab64902cb3f9f30`. The view ACL should be normalized to SELECT-only for `service_role`.

## Launch blockers

1. Ordered production migrations are not applied yet, intentionally.
2. Vercel Production environment cannot be inspected from the currently connected Vercel session.
3. The public domain still needs controlled cutover to the reviewed Next.js deployment.
4. `VELTO_OPS_WRITES_ENABLED` must remain `false` until controlled booking/quote tests.
5. Customer consent integration must be re-checked after the separate Claude customer/consent work lands; do not enable browser marketing tags before the agreed consent behavior is verified.

## High-risk assumptions removed

- Production pricing now fails closed instead of silently using mock pricing when Vercel Production has no live pricing configuration.
- Tracking rate limits are database-backed, not per serverless instance.
- Tracking still requires both order number and phone.
- Health checks are read-only and reveal no database identity/schema/secrets.
- Production HSTS is enabled only in Vercel Production. CSP enforcement is intentionally deferred until the final script/media/consent source list is stable.

## Existing debt outside this launch branch

Core Ops tables have broad authenticated grants with RLS policies, including legacy permissive policies. This branch does not rewrite operational authorization because that would be a separate Ops security migration with a larger blast radius. Website-facing functions/views remain service-role-only.

Main branch protection was not enabled at the audited baseline. Treat PR review + green Quality Gate as mandatory operational process for launch changes.
