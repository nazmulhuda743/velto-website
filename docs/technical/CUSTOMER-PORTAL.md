# Customer Portal V1

Status: staging-only implementation. No production SQL is included in this branch.

## Auth

The website uses Supabase Auth with `@supabase/ssr`. Cookie sessions are refreshed in Next.js `proxy.ts`. Protected account data is loaded only after server-side `getClaims()` verification and a fresh `getUser()` check. No homemade auth token exists.

## Customer linking

Staging has no phone OTP provider. A typed phone number never unlocks Ops history. `portal_request_link()` creates a pending verification state; staff approval is the only current path to `linked`. New/unlinked users can use profile and booking prefill without order access.

## Data boundary

Account pages call customer-safe RPCs with the authenticated user's Supabase session. They do not receive or accept `customer_id` from the browser. `portal_order_get` derives ownership from `auth.uid()` and returns null for another customer's order. No service-role key is used by the portal runtime.

Customer-safe RPCs in staging:
- `portal_me`
- `portal_orders`
- `portal_order_get`
- `portal_profile_save`
- `portal_request_link`
- `portal_touch_login`

Privileged portal functions use a fixed empty `search_path`; customer-facing execute grants are limited to `authenticated`.

## Environment

Preview/staging requires server-only:
- `VELTO_PORTAL_SUPABASE_URL`
- `VELTO_PORTAL_SUPABASE_PUBLISHABLE_KEY`

Optional:
- `VELTO_PORTAL_SITE_URL`

Vercel previews otherwise use the platform-controlled `VERCEL_URL` for auth redirects.

## Scope isolation

This clean portal branch starts from `bd58a8a117801237afde9342c2f1a3d3228dcfce` and deliberately excludes the parallel image-upload, Command Center/consent, revenue-attribution and admin-architecture work.
