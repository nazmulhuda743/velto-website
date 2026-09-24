# Production Environment Contract

No real secret value belongs in Git, logs, screenshots, PR text, or browser-visible variables.

| Variable | Purpose | Visibility | Production requirement | Staging/preview shape | Security | Missing behavior |
| --- | --- | --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Metadata/canonical/sitemap origin | Browser-visible | Required, exactly `https://www.velto.com.bd` | Preview may still use production canonical intentionally | Public config | Wrong canonical/domain signals |
| `NEXT_PUBLIC_GTM_ID` | GTM entry point | Browser-visible | Optional until consent/tag activation is approved; if set use `GTM-*` | Can be omitted | Public config | Analytics tags do not load |
| `VELTO_SUPABASE_URL` | Server connection to Velto Supabase | Server-only | Required, production project `erutxtnepbejdxkoimeo` | Staging project URL | Sensitive configuration | Pricing/content/admin/track dependencies unavailable |
| `VELTO_SUPABASE_SECRET_KEY` | Server service-role credential | Server-only | Required | Staging secret | **Secret** | Live pricing/admin/website RPCs unavailable |
| `VELTO_PRICING_VIEW` | Approved price projection | Server-only | Required, `website_pricing_public` | Same view name | Internal config | Pricing integration is invalid |
| `VELTO_OPS_WRITES_ENABLED` | Booking/quote kill switch | Server-only | Required. Keep `false` until controlled activation | `false` by default | Internal activation switch | Missing/false keeps writes disabled |
| `ADMIN_SESSION_SECRET` | Dedicated admin-cookie HMAC key | Server-only | Required, random >=32 chars, independent from Supabase key | Separate random staging value | **Secret** | Admin session setup is not production-ready |
| `VERCEL_GIT_COMMIT_SHA` | Safe short health/log version | Server-provided | Automatic where available | Automatic | Public-safe metadata when truncated | Health reports `unknown` version only |
| `VERCEL_ENV` | Production/preview safety behavior | Server-provided | Automatic | `preview` in previews | Internal platform config | Production-only HSTS/fail-closed pricing guard cannot identify Vercel production |

## Production invariants

- `VELTO_SUPABASE_SECRET_KEY` must never use a `NEXT_PUBLIC_*` prefix.
- `ADMIN_SESSION_SECRET` must not reuse the Supabase secret.
- `VELTO_OPS_WRITES_ENABLED=false` is the required prelaunch state and fastest write rollback.
- Production `/api/prices` must return `source=live`; Vercel Production returns 503 rather than mock pricing when live config is missing.
- Preview deployments remain noindex.
- Enable GTM only after the merged consent implementation and its default/choice behavior have been verified.

## Verification

Run `npm run verify:production-readiness` and `npm run verify:launch` with Production environment values available to the process. Both scripts fail closed when required configuration is absent and never print secret values.
