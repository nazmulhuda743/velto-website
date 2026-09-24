# Production Launch SQL Package

Apply only after review and a fresh capture of the current production definitions/ACLs. Production project: `erutxtnepbejdxkoimeo`.

Order:

1. `001_preflight.sql` — validates the real Ops tables/columns/indexes required by the website.
2. `002_public_pricing.sql` — normalizes the seven-field pricing view and SELECT-only website ACL.
3. `003_website_content.sql` — creates the admin content table and configures the public website-media bucket without seeding/deleting content.
4. `004_tracking.sql` — durable limiter plus order+phone tracking RPC.
5. `005_booking_quote.sql` — hardened booking/quote task RPC.
6. `006_permissions.sql` — explicit ACL normalization plus read-only `website_launch_state()` verifier.
7. `007_verify.sql` — read-only DB verification/fingerprint output.
8. `008_rollback.sql` — emergency RPC-disable rollback that preserves orders/tasks/content/media/pricing data.

## Before step 1

Capture with the database change record:
- `pg_get_functiondef` and ACL for any existing `website_create_request`, `website_track_order`, and tracking limiter functions;
- `pg_get_viewdef` and ACL for `website_pricing_public`;
- current `website-media` bucket row if present;
- current website table/index existence;
- a production backup/PITR status reference according to the Supabase plan in use.

Do not store secrets or customer rows in the repo.

## Safety

- None of these files alters existing order/customer/price rows.
- `003` can create/update only the website-owned content table/bucket configuration.
- `004` creates only website limiter state and tracking functions.
- `005` replaces a function definition; it does not create a task merely by being installed.
- `VELTO_OPS_WRITES_ENABLED=false` must stay set until the controlled website mutation tests.
- `008` does not drop operational data. Its purpose is to cut website RPC execution while preserving recovery data.
