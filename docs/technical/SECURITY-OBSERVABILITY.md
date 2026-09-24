# Security and Observability Launch Notes

## API security

### Pricing
- GET only.
- Query is bounded and stripped of PostgREST-breaking filter characters.
- Server-side Supabase credential only.
- Vercel Production fails closed with 503 if live pricing is not configured; mock prices are not allowed on the production runtime.
- Upstream failures are sanitized and `Cache-Control: no-store` is returned.

### Booking and quote
- JSON content type and 32 KB body limit enforced before business validation.
- Field/service validation and idempotency key validation occur before the Ops gateway.
- `VELTO_OPS_WRITES_ENABLED` remains the server-side write gate.
- Database RPC has its own payload/service/phone-rate-limit/idempotency controls.
- Customer responses never include Supabase/upstream messages.

### Tracking
- JSON content type and 4 KB body limit.
- Requires both order number and matching normalized phone.
- Durable rate limiting is shared across Vercel instances, with SHA-256 digests rather than raw IPs/phone values stored in limiter rows.
- Rate limiter and tracking RPC are service-role only.
- No valid tracking lookup is sent by automated launch verification, avoiding production rate-counter mutations.

## Security headers

Enforced globally:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- restrictive `Permissions-Policy`
- production-only HSTS (`max-age=31536000; includeSubDomains`)
- preview-only `X-Robots-Tag: noindex, nofollow, noarchive`

CSP is deliberately not enforced on launch day. GTM, consent behavior, Next runtime and Supabase media must be observed together before an enforcement policy is safe. Use report-only first in a separate change.

## Structured server logs

`src/lib/observability/log.ts` emits single-line JSON and strips sensitive-looking context keys. Current launch events include:
- booking submission success/failure
- quote submission success/failure
- pricing configuration/upstream failure
- tracking dependency failure
- tracking rate-limit rejection
- website content load failure
- admin content save failure
- storage upload failure
- health dependency failure

Never log passwords, tokens, cookies, authorization headers, full phones, names, email addresses, addresses, request bodies or raw customer forms.

## Health

`GET /api/health` is read-only. It reports only app/dependency state, timestamp and a short commit when Vercel supplies one. It never returns the Supabase host, credentials, schema, stack traces, or customer data.

## Existing operational security debt

The production Ops database has broad authenticated grants and legacy RLS policies on core operational tables. This launch package does not rewrite those policies because they serve the existing Ops app and require a separate authorization review. Website entry points use server-side service credentials and tightly scoped functions/views.
