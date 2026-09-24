# Velto Launch Certification

Certification date: 25 September 2026

Reviewed application baseline after reconciliation: latest `main` at `bd58a8a117801237afde9342c2f1a3d3228dcfce` plus the launch-engineering branch. This document is a readiness certificate, not proof that production activation has already happened.

Status meanings:

- **READY**: implemented and tested to the extent possible before production cutover.
- **NOT READY**: implementation or validation is materially incomplete.
- **BLOCKED**: implementation is prepared, but a production dependency or controlled activation step has not happened yet.

| Area | Status | Evidence / blocker |
| --- | --- | --- |
| Frontend | READY | Launch-critical public routes are covered by build/smoke checks. Latest owner-supplied WebP homepage imagery is preserved. Final real-domain verification still happens at cutover. |
| Pricing | READY | Production `website_pricing_public` currently has 534 rows / 195 items and approved fingerprint `1ca4d69df562cf967ab64902cb3f9f30`. Production `/api/prices` must still be verified as `source=live` after cutover. |
| Booking | BLOCKED | API validation, bounded input, idempotency and kill switch are implemented. Production `website_create_request` is still the older definition with `search_path=public`; apply reviewed `005_booking_quote.sql` before controlled writes. |
| Quote | BLOCKED | Same production RPC dependency as booking. `VELTO_OPS_WRITES_ENABLED` must remain false until controlled activation. |
| Tracking | BLOCKED | App path is hardened and keeps order-number + matching-phone verification, but production does not yet contain `website_track_order` or the durable DB rate limiter. Apply `004_tracking.sql`, verify ACLs, then test with a controlled order. |
| Admin | BLOCKED | Existing admin authorization/noindex/server-only writes are preserved. Production currently lacks `website_content` and `website-media`; production also needs a dedicated `ADMIN_SESSION_SECRET`. |
| SEO | READY | Route-specific metadata/canonicals, robots, sitemap exclusions, Organization/Service/LaundryService/BreadcrumbList schema and legacy redirect map are implemented. Real-domain crawl output must be rechecked after cutover. |
| Performance | READY | No new client framework was introduced; Next/Image, WebP/AVIF, font swap and launch budgets are documented. Real-user LCP/INP/CLS remains a post-cutover measurement, not a prelaunch claim. |
| Security | BLOCKED | Application/API controls are ready and production migrations harden search paths/ACLs. Production still needs the ordered migration package. CSP is intentionally staged instead of shipping an unverified enforcement policy. |
| Domain | BLOCKED | Canonical target is `https://www.velto.com.bd`; the live domain must be moved to the reviewed Next.js production deployment with deliberate non-www -> www redirect and valid TLS. |
| Analytics | BLOCKED | Analytics hooks/GTM entry point exist, but Production GTM configuration cannot be verified from the current Vercel connector and must be reconciled with the customer consent implementation before activation. |
| Production DB | BLOCKED | Core Ops/pricing tables exist and pricing matches. Missing production website objects: `website_content`, `website-media`, tracking RPC, durable tracking limiter; booking RPC still needs hardened replacement. |
| Rollback | READY | Ordered rollback plan exists. Fastest emergency action remains `VELTO_OPS_WRITES_ENABLED=false`; deployment/domain/database rollback paths preserve operational orders/tasks. |

## Production database snapshot used for certification

Read-only inspection of project `erutxtnepbejdxkoimeo` confirmed:

- `price_list`, `website_pricing_public`, `tasks`, `orders`, `customers`, and `profiles` exist.
- `tasks_dedupe_uidx` exists as a unique partial index on non-null `tasks.dedupe_key`.
- `website_pricing_public`: 534 rows, 195 distinct items, 6 POA rows, 8 per-square-foot rows, service counts 195 / 195 / 144, approved fingerprint `1ca4d69df562cf967ab64902cb3f9f30`.
- `website_create_request(text,text,jsonb)` exists, is SECURITY DEFINER and service-role executable, but its production search path is still `public`.
- `website_content` is absent.
- `website-media` bucket is absent.
- `website_track_rate_limits`, `website_track_rate_limit(text,text)`, and `website_track_order(text,text)` are absent.

No production SQL or production data mutation was performed during certification.

## Launch decision

The codebase can proceed to reviewed production activation, but **Velto is not yet fully production-certified live**. The remaining blockers are operational activation steps, not reasons to weaken tests:

1. Apply the reviewed ordered production SQL package after backup/definition capture.
2. Verify Vercel Production environment, including independent `ADMIN_SESSION_SECRET`, with Ops writes false.
3. Deploy/cut over the intended Vercel production deployment and domain.
4. Run both production-aware read-only verification commands.
5. Verify admin and tracking with controlled non-destructive checks.
6. Only then temporarily enable Ops writes for one booking + idempotency retry + one quote, confirm routing/logs, and leave writes enabled only if every check passes.

Until those checks pass, the launch posture is **BLOCKED FOR WRITE ACTIVATION**, with `VELTO_OPS_WRITES_ENABLED=false` as the required state.
