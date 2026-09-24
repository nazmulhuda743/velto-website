# Velto Website — Production Launch Checklist

This checklist is the release gate for the Velto V1 website. A page being built is not the same as the website being launch-ready.

## 1. Code integration

- [ ] Claude service-page batch is complete and visually approved.
- [ ] Remaining approved internal pages are complete.
- [ ] `gpt/velto-launch-foundation` is rebased/merged onto the final website branch without changing approved visual behavior.
- [ ] No unresolved merge conflicts or temporary debug code remain.
- [ ] `main` contains only reviewed launch code.

## 2. Automated quality gate

The final commit must pass:

- [ ] TypeScript / `npm run typecheck`
- [ ] ESLint / `npm run lint`
- [ ] foundation tests / `npm run test:foundation`
- [ ] production build / `npm run build`
- [ ] launch smoke audit / `npm run test:launch`
- [ ] Vercel deployment check is green

The smoke audit verifies public routes, a real 404, canonical output, sitemap, robots rules, security headers and public form request guards.

## 3. Production domain and indexing

- [ ] `NEXT_PUBLIC_SITE_URL=https://www.velto.com.bd`
- [ ] `www.velto.com.bd` is attached to the intended Vercel production project.
- [ ] canonical URLs resolve to the production domain.
- [ ] production `robots.txt` allows public pages and disallows `/api/`.
- [ ] production `sitemap.xml` contains the approved search-facing pages.
- [ ] Vercel preview deployments return `X-Robots-Tag: noindex, nofollow, noarchive` and disallow crawling in `robots.txt`.
- [ ] `/privacy` and `/terms` stay out of the search sitemap and use noindex metadata.

## 4. Pricing

- [ ] Production `VELTO_SUPABASE_URL` is configured server-side only.
- [ ] Production `VELTO_SUPABASE_SECRET_KEY` is configured server-side only.
- [ ] `VELTO_PRICING_VIEW=website_pricing_public` (or the reviewed production view name).
- [ ] No Supabase secret/service-role value is exposed with a `NEXT_PUBLIC_` prefix.
- [ ] Production pricing matches the approved Velto Ops source of truth.
- [ ] Ironing, Blazer services and Comforter values are verified again after the final merge.
- [ ] pricing loading, no-result and unavailable states are browser-tested.

## 5. Booking and quote integration

Current repository warning: `src/lib/integrations/ops/server.ts` still returns `null` on the branch this checklist was written from. In that state, `/api/bookings` and `/api/quotes` intentionally return 501 and customers are not shown fake success.

Before launch:

- [ ] the reviewed Velto Ops gateway implementation is present in the final branch.
- [ ] the production database function/migration has been reviewed and applied.
- [ ] production writes remain disabled until the final controlled test.
- [ ] booking creates the intended pickup task in production Ops.
- [ ] quote creates the intended call/quote task in production Ops.
- [ ] duplicate submission returns the original/reference-safe result and does not create a second task.
- [ ] `+880...` and `01...` formats normalize to the same customer/rate-limit identity.
- [ ] Sector 18 routes to RUAP; other approved Uttara sectors follow the verified routing rule.
- [ ] invalid, malformed, non-JSON and oversized requests are rejected.
- [ ] booking/quote API responses are `no-store`.
- [ ] a failed website request never appears as a successful booking to the customer.

## 6. Analytics and campaign measurement

- [ ] `NEXT_PUBLIC_GTM_ID` is set to the reviewed production GTM container.
- [ ] GTM contains only one intended GA4 configuration.
- [ ] GTM contains only one intended Meta Pixel/browser setup.
- [ ] no duplicate GA4 or Meta browser tags are hardcoded outside the chosen container.
- [ ] `book_pickup_click` fires from booking CTAs.
- [ ] `booking_start` fires on first meaningful booking-form interaction.
- [ ] `booking_success` fires only after a real successful Ops response.
- [ ] `booking_error` fires on a real failed booking submission.
- [ ] `quote_start` and `quote_success` behave as specified.
- [ ] WhatsApp, pricing, service-view, directions and Google-review events are checked where those controls exist.
- [ ] source / medium / campaign / content / landing-page context survives into the intended measurement path.

### Meta CAPI

Do not enable server-side Meta conversion events until all of these are ready:

- [ ] production Pixel/Dataset ID
- [ ] server access token stored server-side only
- [ ] agreed event mapping
- [ ] shared browser/server `event_id` strategy
- [ ] deduplication verified in Meta Events Manager

Without deduplication, browser + server events can double-count conversions.

## 7. Security and privacy

- [ ] no secrets exist in committed source or client bundles.
- [ ] public form endpoints use bounded JSON input and server-side validation.
- [ ] database/command rate limiting is active for write requests.
- [ ] `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` and `Permissions-Policy` are present.
- [ ] Privacy and Terms copy still matches the actual launch data flow.
- [ ] optional photo wording matches the real upload behavior. Do not claim photos are uploaded if the controlled upload flow is not active.

## 8. Business facts to re-check immediately before launch

- [ ] WhatsApp destination is final.
- [ ] Sector 11 and Sector 18 addresses are final.
- [ ] operating hours are current.
- [ ] Google rating/review counts are current or replaced with durable wording.
- [ ] Google Maps/directions links point to the correct outlets.
- [ ] free pickup/delivery threshold is still ৳499+.
- [ ] any below-threshold charge is sourced from one current operational rule, not duplicated in copy.
- [ ] turnaround wording still matches operations.

## 9. Final browser QA

Check at minimum:

- [ ] 1440 × 900
- [ ] 1280 × 800
- [ ] 1024 × 768
- [ ] 390 × 844
- [ ] 360 × 800

Verify:

- [ ] no horizontal overflow
- [ ] no broken images
- [ ] no console errors
- [ ] keyboard focus is visible
- [ ] mobile menu works
- [ ] sticky/mobile conversion controls do not collide with forms or safe areas
- [ ] booking and quote success/error states are understandable
- [ ] 404 and unexpected-error pages are branded and actionable
- [ ] all primary CTAs route to the correct destination with service/campaign context where supported

## 10. Controlled production activation

Order matters:

1. Deploy final code with production write capability still disabled.
2. Verify production pricing and public pages.
3. Verify analytics browser events in debug/test mode.
4. Apply/review the production Ops function or command integration.
5. Enable production writes only for the controlled test.
6. Submit one real booking and one real quote.
7. Confirm the exact Ops tasks, routing, references and customer-facing confirmation.
8. Check logs for unexpected errors or duplicate writes.
9. Keep writes enabled only if the controlled tests pass.
10. Confirm production indexing/canonical/robots after the final deployment.

## Launch definition

Velto V1 is launch-ready only when the final integrated branch is built, tested, browser-verified and connected to the real production workflow. Placeholder success, unverified pricing, a 501 booking gateway, or an untested production write path are launch blockers.
