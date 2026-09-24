# Velto website technical integration foundation

Status: foundation only. No production credentials, database changes, or live
Velto Ops writes are included in this branch.

## Boundaries

The browser communicates only with website-owned endpoints. It must never query
private Velto Ops tables or receive a Supabase secret key. Server modules under
`src/lib/integrations` define the narrow boundary between the website and the
existing operational system.

```text
browser -> Next.js route/server action -> integration gateway -> Velto Ops
```

This branch deliberately does not add booking or quote pages. Those remain
behind the homepage approval gate. It provides their typed contracts so the
eventual routes do not establish a second data model.

## Public-safe pricing contract

`src/lib/integrations/pricing` expects an approved Supabase Data API view named
`website_pricing_public` by default. The view is allowed to return only:

| Column | Type | Notes |
| --- | --- | --- |
| `item_slug` | text | Stable public identifier |
| `item_name` | text | Customer-facing item name |
| `service_slug` | text | Stable public service identifier |
| `service_name` | text | Customer-facing service name |
| `price_amount_minor` | integer/null | BDT minor units; null requires confirmation |
| `currency` | text | Must be `BDT` |
| `unit_label` | text/null | Optional customer-facing unit |

The adapter rejects malformed rows instead of forwarding unexpected operational
fields. Results are grouped by item and capped before reaching UI code.

The view and grants must be created with the Ops/database owner after its source
tables and role model are confirmed. Do not infer that schema in this website
repository. If the view is exposed to Data API roles, use least-privilege grants,
RLS on exposed base tables, and `security_invoker = true` where supported. The
website currently uses a server-only secret key and still treats the view as a
strict allowlist boundary.

## Environment

Copy `.env.example` to `.env.local` and supply values through the deployment
environment. These names are intentionally not prefixed with `NEXT_PUBLIC_`:

- `VELTO_SUPABASE_URL`
- `VELTO_SUPABASE_SECRET_KEY`
- `VELTO_PRICING_VIEW` (optional)

Use a current `sb_secret_...` key scoped to this server integration. Never commit
it, render it into a client component, return it in an error, or log it.

## API route adoption

The homepage price route can replace its mock lookup with:

```ts
import { getPricingSource } from "@/lib/integrations/pricing/server";

const items = await getPricingSource().search({ query: q, limit: 5 });
```

The route must keep its current generic `503` response on configuration,
upstream, timeout, or contract errors. Raw Supabase errors must remain server
side. Mock preview states should remain development-only and clearly marked.

## Attribution and analytics

`src/lib/attribution.ts` is the shared allowlist/sanitizer for UTM parameters,
supported click IDs, landing page, source, and service. It only appends campaign
data to internal `/book` and `/quote` destinations and never overwrites explicit
destination parameters.

`src/lib/analytics/events.ts` provides the locked event names from the build
specification. It does not configure a production analytics vendor or ID.

## Booking and quote writes

`src/lib/integrations/ops/contracts.ts` defines the website-facing gateway only.
Before implementing a live gateway, confirm:

1. the existing Velto Ops command/API or approved database function;
2. idempotency behavior and duplicate-submission handling;
3. server-side validation, rate limiting, and abuse controls;
4. upload constraints and retention for optional quote photos;
5. which attribution fields Ops can persist safely;
6. generic customer errors and structured, secret-free server logging.

Do not create a parallel leads table from this repository.

## Merge notes

All additions are outside Claude's current visual component paths. The only
expected follow-up edits on the homepage branch are narrow imports in the
existing analytics component and pricing route after this foundation is merged.
