# Velto Website Production Activation Readiness

Audit date: 25 September 2026

Baseline: `4c51106a3e18623bde6b4db5bc1af85c2ece09c3`

Production Supabase: `velto-production` (`erutxtnepbejdxkoimeo`)

Staging comparison: `Velto Staging - Prod Clone` (`ekgdefcdqcsqvpbqponv`)

This is a readiness record, not an activation record. No production SQL was applied. `VELTO_OPS_WRITES_ENABLED` must remain `false` until the controlled activation sequence is explicitly approved.

## Reconciliation with latest main

This readiness branch is rebased/reconciled onto the admin dashboard + order-tracking merge at `4c51106a3e18623bde6b4db5bc1af85c2ece09c3`.

Claude's admin/dashboard work is preserved. No admin page, component, session/auth module, public website page, `website_content` behavior, or `website-media` behavior is redesigned by this readiness work.

The only tracking runtime changes are production hardening for `/api/track` and the reviewed SQL migration.

## Admin security posture preserved

Verified on latest main:

- `/admin` metadata remains `noindex, nofollow`.
- The protected admin panel layout calls server-side `requireAdmin()`.
- Admin mutation actions call `requireAdmin()` before writes.
- `src/lib/admin/content-store.ts` remains server-only.
- `website_content` writes remain service-role-only.
- `website-media` uploads remain server-side through the Supabase service credential.
- The existing public read behavior of the `website-media` bucket is unchanged.

The session module currently supports `ADMIN_SESSION_SECRET` with a fallback to `VELTO_SUPABASE_SECRET_KEY`. Production must configure a separate `ADMIN_SESSION_SECRET`; readiness must not rely on that fallback.

## Production database findings

Production already contains:

- `public.price_list`
- `public.website_pricing_public`
- `public.tasks`
- `public.website_create_request(text, text, jsonb)`

Production does not yet contain:

- `public.website_track_order(text, text)`
- `public.website_track_rate_limit(text, text)`
- the tracking rate-limit table introduced by the revised admin/tracking migration

Those tracking objects are intentionally not applied by this branch.

`price_list` and `tasks` have RLS enabled. `website_pricing_public` is a `security_invoker=true` view.

The production `tasks` table contains every field used by the website booking/quote RPC, and the required unique partial `tasks_dedupe_uidx` exists.

Production Ops data confirms `S11` and `RUAP` as active outlet codes used by website routing.

## Pricing readiness

Production and staging have the same website-visible commercial pricing.

Both contain:

- 534 active/public service rows
- 195 distinct items
- 195 Dry Cleaning rows
- 195 Wash + Iron rows
- 144 Ironing rows
- 6 POA rows
- 8 per-square-foot rows
- zero active non-POA rows with null price
- zero public rows with a null service slug
- zero duplicate item/service slug pairs

The ordered seven-field public dataset fingerprint is identical in production and staging:

`1ca4d69df562cf967ab64902cb3f9f30`

The commercial source fingerprint across `item_name`, `service_category`, `price`, `unit`, `price_type`, `active`, and `is_active` is also identical:

`45dc4d914c2f7ec06de9d4d2bbec6b8d`

Therefore no production price-data migration is required. `docs/technical/sql/website_pricing_public.sql` remains the reproducible public-view migration and exposes only the approved seven fields to the server-side service role.

## Booking and quote RPC readiness

The revised `docs/technical/sql/website_create_request.sql` remains unchanged from the prior production-readiness review.

It preserves:

- booking -> open `pickup` task
- quote -> open `call` task
- idempotency through `tasks_dedupe_uidx`
- duplicate retries returning the same reference
- normalized phone rate limiting
- approved service allowlists
- Sector 18 -> `RUAP`
- other approved/outside labels -> `S11` for staff review
- bounded payloads and attribution
- `search_path=pg_catalog, public`
- service-role-only execution

`VELTO_OPS_WRITES_ENABLED` remains `false`.

## Order tracking production readiness

### Search-path hardening

The reviewed `website_track_order` migration now uses:

`search_path = pg_catalog, public`

Execution remains restricted to `service_role`; `public`, `anon`, and `authenticated` have no execute permission.

### Production/staging schema difference found

Staging has `orders.v2_promised_at`; production currently does not.

The previous tracking SQL selected that column directly, which would fail at runtime after production activation.

The revised function still requires both the normalized order number and normalized phone number to match, but reads the matched order row as JSON. `promisedAt` is therefore populated when the column exists and safely returns null when it does not. No weaker lookup path or order-number-only lookup is introduced.

### Durable tracking rate limiter

The previous `/api/track` limiter was an in-memory JavaScript `Map`, which is not durable across Vercel instances.

The revised design adds a small rate-limit table in the existing Velto Supabase project plus a service-role-only `website_track_rate_limit` function.

Controls:

- 10-minute fixed window
- 12 attempts per requester-IP bucket
- 20 attempts per normalized order-number bucket across requesters
- atomic PostgreSQL upsert, so limits are shared across Vercel instances
- raw IP addresses are never persisted; the route stores only SHA-256 rate keys
- order-number rate keys are also SHA-256 digests
- limiter table has RLS enabled and direct access revoked from `public`, `anon`, `authenticated`, and `service_role`
- only the `SECURITY DEFINER` limiter function can mutate it
- the limiter function uses `search_path=pg_catalog, public`
- `/api/track` fails closed with 503 if the durable limiter is unavailable
- blocked requests return 429 with `Retry-After`
- malformed/non-JSON/oversized requests are rejected before a lookup

Vercel documents that `x-forwarded-for` is overwritten for normal deployments rather than trusting a client-supplied value. The route hashes that value before it reaches the database.

The tracking migration was compiled and exercised inside an explicit transaction against the real staging clone. A first limiter call returned allowed and a safe nonexistent order lookup returned `found:false`; the transaction was rolled back, so no test schema/data persisted.

## Vercel Production environment matrix

| Variable | Required | Visibility | Role |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Yes | Browser-visible | Canonical origin, must be `https://www.velto.com.bd` |
| `NEXT_PUBLIC_GTM_ID` | Optional for readiness | Browser-visible | GTM measurement entry point |
| `VELTO_SUPABASE_URL` | Yes | Server-only | Must target production project `erutxtnepbejdxkoimeo` |
| `VELTO_SUPABASE_SECRET_KEY` | Yes | Server-only secret | Pricing, admin server access and service-role RPC credential |
| `ADMIN_SESSION_SECRET` | **Required for production admin sessions** | Server-only secret | Dedicated admin-cookie signing secret; do not rely on the Supabase-key fallback |
| `VELTO_PRICING_VIEW` | Yes | Server-only | Must be `website_pricing_public` |
| `VELTO_OPS_WRITES_ENABLED` | Yes | Server-only | Booking/quote write kill-switch; keep `false` during readiness |

`ADMIN_SESSION_SECRET` should be a long independent random secret and must not equal `VELTO_SUPABASE_SECRET_KEY`.

Never expose either secret through `NEXT_PUBLIC_*`, source code, logs, screenshots, or documentation.

## Read-only production verifier

Run:

```bash
npm run verify:production-readiness
```

The script sends GET requests only. It never calls booking, quote, tracking, rate-limit, admin-write, update, insert, or delete endpoints.

It fails closed when required configuration is absent or wrong and verifies:

- canonical production origin
- exact production Supabase host
- approved pricing view
- `VELTO_OPS_WRITES_ENABLED=false`
- server-side Supabase secret format
- dedicated `ADMIN_SESSION_SECRET` exists, is long enough, and differs from the Supabase secret
- pricing view reachability and seven-field shape
- approved row/item/service/POA/square-foot counts
- exact public pricing fingerprint and representative values
- OpenAPI visibility of `website_content`, `website_create_request`, `website_track_order`, and `website_track_rate_limit` through the service-role contract
- homepage canonical
- public `/api/prices` reporting `source: live`

Because production tracking/admin SQL has not yet been applied, the final verifier is expected to fail those tracking/admin object checks until controlled activation reaches that step.

## Security findings

### Fixed in this branch

1. `website_track_order` used `search_path=public`. Revised to `pg_catalog, public`.
2. `/api/track` used per-instance in-memory throttling. Replaced with a DB-backed limiter shared across Vercel instances.
3. Staging-only `v2_promised_at` was referenced directly even though production lacks it. Revised tracking SQL is production-schema compatible without weakening matching.
4. `/api/track` now uses the existing bounded JSON reader with a 4KB cap.
5. Production readiness now requires an independent `ADMIN_SESSION_SECRET` instead of treating the Supabase service key fallback as acceptable production configuration.

### Preserved controls

- order number **and** phone must both match
- tracking RPC remains service-role-only
- admin remains noindex
- protected admin pages remain server-authorized
- admin/content/media writes remain server-side service-role writes
- `website_content` and `website-media` behavior is otherwise unchanged

### Existing broader Supabase debt, not changed here

The production Supabase advisor previously reported other authenticated-callable SECURITY DEFINER functions, mutable search paths on unrelated functions, several backup/support RLS tables without policies, `pg_net` in `public`, and leaked-password protection disabled. Those are outside this website-readiness change and are not modified here.

## Controlled activation sequence

1. Review and merge this branch only after PR approval.
2. Re-confirm production pricing parity.
3. Configure Vercel Production with the production Supabase URL/secret, `VELTO_PRICING_VIEW=website_pricing_public`, canonical URL, optional GTM ID, and a dedicated `ADMIN_SESSION_SECRET`.
4. Keep `VELTO_OPS_WRITES_ENABLED=false`.
5. Apply/review `website_pricing_public.sql` only if the existing view/grants need normalization.
6. Apply the reviewed `website_admin_and_tracking.sql` to production.
7. Verify `website_content`, the website-media bucket, `website_track_order`, `website_track_rate_limit`, limiter ACLs, and `search_path=pg_catalog, public`.
8. Verify `/track` with one known order + matching phone and confirm wrong-phone lookup returns `found:false`.
9. Run `npm run verify:production-readiness` with Production configuration available.
10. Verify `/api/prices?q=Blazer` reports `source: live` and representative pricing is correct.
11. Apply the reviewed `website_create_request.sql` migration.
12. Re-check booking/quote RPC signature, search path and ACL. Keep writes disabled.
13. Temporarily enable writes only for one controlled booking.
14. Confirm exactly one pickup task, retry the same idempotency key and confirm no duplicate.
15. Submit one controlled quote and confirm exactly one call task.
16. Confirm Sector 18 -> `RUAP` and an outside-Uttara label does not accidentally route to `RUAP`.
17. Check Vercel/Supabase logs for errors, permission failures, unexpected retries, rate-limit failures, or duplicate writes.
18. Leave writes enabled only if every controlled check passes.

## Rollback

### Fast booking/quote stop

Set `VELTO_OPS_WRITES_ENABLED=false` and redeploy/reload Production. Pricing/admin/tracking can remain readable while booking/quote writes stop.

### Tracking rollback

If tracking activation misbehaves, deploy the prior website build or temporarily disable the `/track` navigation/endpoint at deployment level, then restore the previous `website_track_order` definition only after confirming the lookup still requires both order number and phone. The rate-limit table is isolated and can remain in place while tracking is disabled.

### RPC rollback

Before applying a revised RPC, capture the current production function definition and ACL. If replacement misbehaves, disable website booking/quote writes first, restore the prior function, re-check service-role-only execute privileges, and leave writes disabled.

### Pricing rollback

Capture the current view definition and fingerprint before changing it. Restore the previous `website_pricing_public` if needed, verify 534 rows and fingerprint `1ca4d69df562cf967ab64902cb3f9f30`, then re-check `/api/prices`.

### Website rollback

Restore the previous known-good Vercel production deployment. Keep booking/quote writes disabled until the failed activation step is understood and re-tested.

## Remaining blockers before production activation

- Production admin/tracking SQL has not yet been applied, intentionally.
- Production currently lacks the tracking RPC and durable limiter objects.
- Vercel Production environment still needs authorized verification, including `ADMIN_SESSION_SECRET`.
- Booking/quote writes must remain disabled until the controlled activation test.

No blocker requires redesigning the public website or changing Claude's admin dashboard implementation.
