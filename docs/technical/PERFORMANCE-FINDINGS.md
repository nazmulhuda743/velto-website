# Launch Performance Findings

Scope: launch-critical public pages only. No visual redesign is part of this pass.

## Current strengths

- App Router/server components are the default. Client components are limited to real interaction such as navigation, forms, analytics, marquee/process behavior and tracking.
- No animation framework or large third-party UI runtime is required.
- Fonts use `next/font` with `display: swap` and only the required weights.
- Site imagery is rendered through `next/image` (`ResponsiveImage` / `Logo`) and launch smoke enforces alt text plus intrinsic sizing or a valid fill box.
- Next Image serves AVIF/WebP and the production Supabase `website-media` path is explicitly allowlisted.
- Service detail pages cache/revalidate pricing content rather than forcing every page request to be fully dynamic.
- Browser GTM loads `afterInteractive`, not before the initial render.

## Launch risks / actions

1. **Production pricing must never become mock data.** `/api/prices` now returns 503 on Vercel Production when the live Supabase pricing integration is missing.
2. **Admin-managed site content has a one-hour tagged server cache.** Admin saves invalidate the tag and layout, avoiding a request waterfall on every public visit.
3. **Remote admin images can be up to 8 MB at upload.** Next Image prevents shipping the original dimensions directly to normal responsive slots, but editors should still upload sensible source files. Do not delete existing production uploads during launch.
4. **GTM/marketing scripts must be reconciled with Claude's consent implementation before production measurement is enabled.** No additional third-party script should be inserted directly into page components.
5. **CSP is deferred.** A guessed enforcement policy can block Next runtime, GTM, or Supabase media. Use a report-only policy after final consent/tag sources are known, then enforce from observed violations.

## Practical launch budgets

These are regression budgets, not synthetic Core Web Vitals guarantees:

- No new client dependency for launch engineering.
- No launch-critical route may ship a full-size raw hero via plain `<img>`.
- Every rendered image must have dimensions or a stable fill container.
- No synchronous third-party script in the document head.
- No public page should require sequential Supabase calls solely for layout chrome.
- Pricing/health upstream calls use bounded server timeouts and no-store where freshness/safety requires it.
- Build must remain warning/error free under the Quality Gate.

## Post-cutover measurement

After the production domain is on the reviewed Next.js deployment, capture real-user and lab data for `/`, `/services/dry-cleaning`, `/pricing`, `/book`, `/quote`, and `/track`. Investigate LCP/INP/CLS regressions before adding animation or more tags.
