# Vercel Production Cutover

Canonical production origin: `https://www.velto.com.bd`.

## Before cutover

1. Review and merge the launch-engineering PR only after green CI and review.
2. Capture the currently serving production deployment/domain configuration and DNS records.
3. Capture the current production Supabase website function/view definitions and ACLs before applying migrations.
4. Apply the ordered production-launch SQL only through the reviewed DB change process.
5. Configure Production environment from `PRODUCTION-ENVIRONMENT.md` with `VELTO_OPS_WRITES_ENABLED=false`.
6. Confirm `ADMIN_SESSION_SECRET` is dedicated and independent.
7. Deploy the reviewed main commit to a Vercel Production deployment without moving the custom domain yet if a preview/temporary production URL is available.
8. Run route/API/health checks against that deployment.

## Domain cutover

1. Add/confirm `www.velto.com.bd` on the intended Vercel project.
2. Make `www` the canonical serving host.
3. Configure `velto.com.bd` to redirect permanently to `https://www.velto.com.bd`, preserving path/query.
4. Change only the DNS records required by Vercel's current domain instructions; do not delete unrelated mail/TXT records.
5. Wait for Vercel to report valid ownership and TLS before sending traffic.
6. Verify HTTPS certificate, `www` 200, root-domain redirect, canonical tags, robots and sitemap.
7. Verify old-path redirects from `REDIRECT-MAP.md`.
8. Run `npm run verify:launch` with Production configuration.

## Cache behavior

- Public page/content caches can remain enabled; admin saves invalidate the site-content cache tag.
- `/api/prices`, booking, quote, tracking and health responses are `no-store` where freshness/safety matters.
- If a stale page persists after cutover, redeploy/revalidate the reviewed app. Do not clear operational Supabase data.

## Fast website rollback

If the new deployment itself regresses:

1. Set `VELTO_OPS_WRITES_ENABLED=false` first.
2. Promote/restore the previous known-good Vercel deployment.
3. Keep the `www` domain on Vercel if the previous deployment is hosted there; changing DNS is slower and should not be the first rollback.
4. Re-run root/canonical/pricing/health checks.
5. Leave website write RPCs disabled until the regression is understood.

## Domain rollback

Use DNS rollback only if the Vercel project/domain configuration itself is the problem and a previous hosting target is still known-good. Restore the exact captured DNS values, not reconstructed guesses. Expect DNS caching; the application/deployment rollback above is preferred when possible.

## HSTS / CSP

Production sends HSTS for one year with subdomains only when `VERCEL_ENV=production`. Do not add `preload` during this cutover.

CSP stays unenforced at launch. After Claude's consent work and the final GTM/media source list are stable, deploy a report-only CSP, inspect violations, then move to enforcement in a separate reviewed change.
