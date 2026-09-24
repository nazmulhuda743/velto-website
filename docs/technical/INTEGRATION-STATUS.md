# Integration status — Codex foundation on main

Branch: `claude/velto-integration` = `main` + `codex/velto-technical-foundation`
(merged, history preserved; the Codex branch itself is untouched).

## Wired in this pass

| Area | Status |
|---|---|
| Foundation merge | Clean, zero conflicts. All 12 foundation tests pass via `npm run test:foundation` (the documented `--ignoreConfig` compile + `node --test`). |
| Pricing (`/api/prices`) | Uses `getPricingSource().search()` when `VELTO_SUPABASE_URL` + `VELTO_SUPABASE_SECRET_KEY` are set (`source: "live"`); otherwise falls back to the marked mock (`source: "mock"`), so the site keeps working until the approved `website_pricing_public` view and Vercel env vars exist. Errors stay a generic 503. |
| Booking (`/api/bookings`) | New website-owned route: `validateBookingSubmission` + `validateSubmissionContext`, server `requestId`, safe error contract (`errors.ts`), gateway from `ops/server.ts`. |
| Quotes (`/api/quotes`) | Same shape with `validateQuoteSubmission`; `photoReferences` is `[]` until the controlled upload flow exists (photos never leave the browser). |
| Forms (`submit.ts`) | Real POSTs with `{ data (incl. sanitized attribution), idempotencyKey }`. One idempotency key per distinct payload, reused across retries (verified). Response mapping: 501 → honest "isn't switched on yet" UI; `invalid_request` / `duplicate_submission` / anything else → existing failure states. No fake success is possible. |
| Attribution | Browser capture and `/book`–`/quote` link carry now go through the shared sanitizer (`readAttribution` / `appendAttribution`); submissions attach `submissionAttribution()` (session campaign context + current URL). Verified end-to-end: utm/fbclid/landing_page/source reach the POST body. |
| Analytics | `track()` warns in development on names outside the taxonomy. `ANALYTICS_EVENTS` extended with the spec §23 names the foundation list was missing (`pricing_search`, `google_reviews_click`, `service_view`); `tests/analytics.type-test.ts` updated to keep the exhaustiveness check true. |

## Conventions Codex should know

- **501 = gateway not configured.** `ops/server.ts#getOpsGateway()` returns `null` today; the routes answer `501 { code: booking_unavailable | quote_unavailable }` and the UI shows "Online booking/quotes aren't switched on yet". Implement `VeltoOpsGateway`, return it from `getOpsGateway()`, and the whole path (validation → context → UI success with the Ops reference) is already live. Gateway errors map: `duplicate_submission` → 409, `request_timeout` → 504, others → 502.
- **Success references:** the UI shows a reference only when `createBooking`/`createQuote` returns one; it never invents an ID.
- **URL-level UTM carry on internal links** doesn't survive Next.js client-side navigation (Link uses its React prop, not the DOM href our click handler rewrites; behavior unchanged from before). The reliable, verified path is sessionStorage → `submissionAttribution()` → validator. If URL carry becomes a hard requirement, it needs router-level handling, not the click handler.

## Still blocked on Ops / owner decisions (unchanged from INTEGRATIONS.md)

1. `website_pricing_public` view + grants in Supabase, then `VELTO_SUPABASE_URL` / `VELTO_SUPABASE_SECRET_KEY` (+ optional `VELTO_PRICING_VIEW`) in Vercel.
2. The live Ops gateway: command/API, idempotency semantics, rate limiting/abuse controls, attribution persistence, retention.
3. The controlled photo-upload flow for quotes (until then `photoReferences` stays empty and WhatsApp remains the photo path).
4. Production analytics vendor/IDs (event taxonomy is ready; nothing is configured).
