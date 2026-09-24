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
fields. It also rejects rows containing any additional column, including a
column newly added to the view by mistake. Results are grouped by item and
capped before reaching UI code.

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

Both booking and quote validators accept the sanitized attribution object and
discard unknown properties. Direct campaign fields (`source`, `medium`,
`campaign`, `content`, `ad`), UTM fields, selected service, landing page and
supported click identifiers (`fbclid`, `fbc`, `fbp`, `gclid`) can travel with
the submission. This is acquisition context only; reporting and revenue
attribution remain outside the current phase.

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

Server-side validators in `src/lib/integrations/ops/validation.ts` produce only
allowlisted booking and quote fields. Household quotes are provisional
enquiries: no exact price is required or represented. `photoReferences` holds
at most five opaque references produced by a future controlled upload flow; it
does not accept URLs, file bodies or arbitrary storage paths.

The gateway receives `idempotencyKey` and `requestId` in a separate submission
context rather than as customer data. The website can generate and reuse the
same idempotency key while a submission is retried. True duplicate prevention
still requires Velto Ops to atomically recognize that key. Whether the existing
Ops API/function can do this—and its retention window—is an Ops/database
decision. No schema change is proposed here.

## Safe failures

`src/lib/integrations/errors.ts` exposes controlled error codes only:
`invalid_request`, `pricing_unavailable`, `booking_unavailable`,
`quote_unavailable`, `request_timeout`, `duplicate_submission` and
`internal_error`. Customer responses contain a request ID and retryability flag,
but no upstream message, SQL detail, stack trace, payload or secret.

Server logs should use `integrationLogContext` as their base and attach only
reviewed operational metadata. Never log credentials, complete submissions,
raw upstream response bodies or customer photo data.

## Foundation tests

The focused tests use Node's built-in test runner. In the complete Next.js
checkout, compile the runtime-neutral modules with the project's TypeScript
compiler and run:

```sh
npx tsc --ignoreConfig --outDir .foundation-test-build --module node16 --moduleResolution node16 --target ES2022 --esModuleInterop --skipLibCheck src/lib/attribution.ts src/lib/integrations/errors.ts src/lib/integrations/ops/validation.ts src/lib/integrations/pricing/validation.ts
node --test tests/*.test.cjs
```

Remove `.foundation-test-build` after the run. The separate
`tests/analytics.type-test.ts` is checked by the normal project TypeScript run.

## Merge notes

All additions are outside Claude's current visual component paths. The only
expected follow-up edits on the homepage branch are narrow imports in the
existing analytics component and pricing route after this foundation is merged.

## Post-Phase-3 Integration Order

1. Claude's approved homepage branch is merged into main.
2. Rebase `codex/velto-technical-foundation` onto the updated main.
3. Resolve integration conflicts without altering approved visual behavior.
4. Run TypeScript, lint, tests and production build.
5. Wire Find a Price UI to the pricing adapter.
6. Wire Book Pickup UI to the booking gateway.
7. Wire Request Quote UI to the quote gateway.
8. Wire analytics/attribution to the approved UI.
9. Verify mobile and desktop behavior.
10. Only then open the technical integration PR.
