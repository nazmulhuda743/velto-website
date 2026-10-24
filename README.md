# Velto Website

The website and staff Command Center for **Velto Premium Laundry** (Uttara, Dhaka). It is the front
door to Velto Ops: customers book pickups, request quotes and track orders here; requests go into the
existing Velto Ops / Supabase database through server-side, public-safe interfaces. There is no
separate website database and no independent price list.

**Read first:** [`AGENTS.md`](AGENTS.md) and [`docs/PROJECT-BUILD-SPEC.md`](docs/PROJECT-BUILD-SPEC.md).
The specification holds the LOCKED strategy, homepage copy, design system, business facts and
rules. Do not reopen anything marked LOCKED; flag contradictions instead.

## What is in this repository

| Area | What it does | Where |
|---|---|---|
| Public website | Homepage, services and service pages, pricing search, how it works, regular laundry, locations, about, careers, privacy / terms / cookies | `src/app/[lang]/(site)` |
| Booking and quotes | Book Pickup (pickup day and time window, optional items with live prices, photos, browser draft, "Get a call back"), household quote requests, order tracking | `/book`, `/quote`, `/track`, `src/components/forms` |
| Customer accounts | Sign-in (mobile SMS code or Google), order history, profile, rewards, one-tap repeat, weekly routine | `src/app/[lang]/(site)/(portal)`, [CUSTOMER-PORTAL.md](docs/technical/CUSTOMER-PORTAL.md) |
| Installable app (PWA) | `/app` shell, service worker, offline page, web push | `src/app/[lang]/app`, [PWA.md](docs/technical/PWA.md), [PUSH-NOTIFICATIONS.md](docs/technical/PUSH-NOTIFICATIONS.md) |
| Command Center (`/admin`) | Staff dashboard: bookings & quotes, dispatch, capacity, retention, revenue and funnel analytics, content (SEO, images, copy, reviews, promo), prices approval, health and notifications | `src/app/admin`, [COMMAND-CENTER.md](docs/technical/COMMAND-CENTER.md) |
| APIs | `/api/bookings`, `/api/quotes`, `/api/callback`, `/api/prices`, `/api/track`, `/api/capacity`, `/api/collect` (consent-gated analytics), push and auth hooks | `src/app/api` |
| Bilingual | English and Bangla (`/bn`), with Bangla public routes behind a flag | [I18N.md](docs/technical/I18N.md) |
| Database contracts | SQL for the website-owned functions and tables in the Ops project, each with a staging test | `docs/technical/sql` |

## Stack

- Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4
- Supabase / PostgreSQL (Velto Ops), reached only from the server
- Vercel (region `hnd1`, see `vercel.json`)
- Node.js **22 or newer** (see below)

## Requirements

- **Node.js 22+** (`.nvmrc` pins 22; `package.json` declares `engines.node >= 22`). With nvm: `nvm use`.
  - Why: `node scripts/command-center-tests.mjs` runs `node --test "tests/command-center/*.test.cjs"`.
    Node 22 expands that glob itself; Node 20 treats it as a literal file name and the Command
    Center tests fail to start. CI also runs Node 22.
- npm (the repository uses `package-lock.json`; install with `npm ci`).

## Setup

```bash
nvm use            # or install Node 22 yourself
npm ci
cp .env.example .env.local
npm run dev        # http://localhost:3000
```

### Environment variables

`.env.example` lists every setting with a comment. Copy it to **`.env.local`** (git-ignored) and fill
in only what you need. Never commit `.env.local`, never paste real keys into issues or docs, and never
prefix a server secret with `NEXT_PUBLIC_` (those values are sent to the browser).

- **With no Supabase values the site still runs**: pricing falls back to a clearly marked mock, and
  booking/quote submission answers "isn't switched on yet" (HTTP 501) instead of pretending to succeed.
- Use the **staging** Supabase project for local work. Every write switch (`VELTO_OPS_WRITES_ENABLED`,
  `WEBSITE_ANALYTICS_WRITES_ENABLED`, `VELTO_CUSTOMER_ACCOUNTS_ENABLED`, …) is off unless set to `"true"`;
  leave them off unless you are deliberately testing against staging.
- `NEXT_PUBLIC_SITE_URL` is the canonical production origin (`https://www.velto.com.bd`). Metadata,
  canonicals, the sitemap and structured data are built from it; the SEO audit expects this value.
- `NEXT_PUBLIC_BANGLA_ENABLED` switches the public Bangla routes (`/bn/...`, hreflang, Bangla sitemap
  entries). `"false"` is the production setting until the owner approves the Bangla copy.

Development-only helpers (not in `.env.example`):

| Variable | Effect |
|---|---|
| `VELTO_ADMIN_PREVIEW=1` | `next dev` only: opens `/admin` with synthetic data and no sign-in (`VELTO_ADMIN_PREVIEW_ROLE` picks the role) |
| `NEXT_PUBLIC_SHOW_PHOTO_BRIEFS=1` | Shows image briefs on placeholder photos outside development |
| `NEXT_PUBLIC_PWA_ENABLED=false` | Turns the service worker off |
| `VELTO_NEW_REQUEST_PUSH=false` | Stops the staff push alert for new requests |

## Commands

| Command | What it runs |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / serve it on port 3000 |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm run lint` | ESLint |
| `npm run test:security` | Static security audit + customer-portal static checks |
| `npm run test:foundation` | Unit tests for the runtime-neutral modules in `tests/foundation-modules.txt` |
| `node scripts/command-center-tests.mjs` | Command Center unit tests (`tests/command-center`) |
| `npm run test:i18n` | English / Bangla content tests |
| `npm run test:launch` | Launch smoke audit against a running server (routes, headers, 404s, API guards) |
| `npm run test:portal-smoke` | Customer-portal smoke test against a running server |
| `npm run test:seo` | SEO audit against a running server (canonicals, sitemap, JSON-LD, hreflang, redirects) |
| `npm run test:pwa` | PWA smoke test against a running server |
| `npm run i18n:review` | Bangla copy review helper |
| `npm run verify:production-readiness` | Checks a real environment's configuration; needs production values, so run it only when deliberately activating ([PRODUCTION-ACTIVATION-READINESS.md](docs/technical/PRODUCTION-ACTIVATION-READINESS.md)) |

The three "running server" audits need `npm run build && npm start` first (they read `http://127.0.0.1:3000`
unless `LAUNCH_BASE_URL` / `SEO_BASE_URL` is set). They only read pages and call API guards; they do
not write data.

## CI

`.github/workflows/quality.yml` runs on every pull request and on pushes to `main`, `claude/**`,
`codex/**` and `gpt/**`, with Node 22 and `NEXT_PUBLIC_SITE_URL=https://www.velto.com.bd`:

- **`verify`** (Bangla off, `NEXT_PUBLIC_BANGLA_ENABLED=false`, the production setting): security audit,
  typecheck, lint, foundation, Command Center and i18n tests, build, then launch, portal-smoke and SEO
  audits against `npm start`.
- **`verify-bangla-on`** (`NEXT_PUBLIC_BANGLA_ENABLED=true`): build, then the same three audits, so
  switching Bangla on in production is never untested.

To reproduce one configuration locally:

```bash
export NEXT_PUBLIC_SITE_URL=https://www.velto.com.bd NEXT_PUBLIC_BANGLA_ENABLED=false   # or true
npm run build && (npm start &) && sleep 5
npm run test:launch && npm run test:portal-smoke && npm run test:seo
```

## Deployment

Vercel builds `main` for production and every branch as a preview (preview deployments are
`noindex`). Environment variables are set in the Vercel project, not in the repository. Database
changes are applied separately (staging first, with the test in `docs/technical/sql/tests/`), never by
a deploy. Before turning on a production switch, follow
[LAUNCH-CHECKLIST.md](docs/technical/LAUNCH-CHECKLIST.md) and
[PRODUCTION-ACTIVATION-READINESS.md](docs/technical/PRODUCTION-ACTIVATION-READINESS.md).

## Documentation

- Specification and rules: [PROJECT-BUILD-SPEC.md](docs/PROJECT-BUILD-SPEC.md), [AGENTS.md](AGENTS.md)
- Launch: [LAUNCH-CHECKLIST.md](docs/technical/LAUNCH-CHECKLIST.md), [LAUNCH-QUESTIONS.md](docs/technical/LAUNCH-QUESTIONS.md) (open business facts), [DNS-CUTOVER.md](docs/technical/DNS-CUTOVER.md)
- Integrations: [INTEGRATIONS.md](docs/technical/INTEGRATIONS.md), [INTEGRATION-STATUS.md](docs/technical/INTEGRATION-STATUS.md), [META-PIXEL.md](docs/technical/META-PIXEL.md), [PHONE-SIGN-IN.md](docs/technical/PHONE-SIGN-IN.md)
- Booking and operations: [DISPATCH.md](docs/technical/DISPATCH.md), [CAPACITY.md](docs/technical/CAPACITY.md), [BOOKING-RECOVERY.md](docs/technical/BOOKING-RECOVERY.md), [INVOICES.md](docs/technical/INVOICES.md)
- Customers: [CUSTOMER-PORTAL.md](docs/technical/CUSTOMER-PORTAL.md), [PWA.md](docs/technical/PWA.md), [PUSH-NOTIFICATIONS.md](docs/technical/PUSH-NOTIFICATIONS.md)
- Staff: [COMMAND-CENTER.md](docs/technical/COMMAND-CENTER.md), [REVENUE-ATTRIBUTION-DESIGN.md](docs/technical/REVENUE-ATTRIBUTION-DESIGN.md)
- Language and SEO: [I18N.md](docs/technical/I18N.md), [VELTO-SEO-MASTER-PLAN.md](docs/seo/VELTO-SEO-MASTER-PLAN.md), [LEGAL-REVIEW.md](docs/legal/LEGAL-REVIEW.md)
