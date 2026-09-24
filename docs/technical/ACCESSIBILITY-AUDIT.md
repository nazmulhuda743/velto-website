# Launch Accessibility Audit

Scope: launch-critical public website surfaces only. This pass does not redesign approved pages and does not cover Claude's customer-auth or consent UI until those changes are merged.

## Automated launch coverage

`npm run test:launch` verifies every known public launch route has:

- `lang="en"` on the document;
- a primary `<main id="main">` landmark;
- an H1;
- alt text on every rendered image;
- stable image sizing through intrinsic dimensions or a valid Next/Image fill container.

The existing site shell provides a skip-to-content link. Existing form components expose explicit labels and inline validation/error states, and launch engineering did not remove or replace those interactions.

## Keyboard and focus

The shared UI uses native links, buttons, inputs and form controls rather than click-only non-semantic containers. Existing focus styles remain in the approved design system. Launch smoke exercises rendered pages but does not claim to replace a manual keyboard traversal.

Launch-day manual check:

1. Tab from the top of `/` through the skip link, header navigation and primary CTA.
2. Complete `/book`, `/quote` and `/track` using keyboard only.
3. Confirm error messages remain visible and focus is not trapped.
4. Open/close mobile navigation using keyboard controls where a desktop viewport exposes the control.
5. Confirm the admin login remains usable by keyboard without altering admin UX.

## Forms

Booking, quote and tracking forms use bounded server validation and customer-safe errors. Invalid API payloads do not expose Supabase messages or stack traces. A production dependency failure should surface as an unavailable/retry state rather than false success.

## Images and layout stability

Public imagery is delivered through shared Next/Image components. The latest main replaces five homepage JPG assets with owner-supplied WebP files and is preserved by the launch-engineering rebase. Smoke tests reject rendered images that lack alt text or stable sizing.

## Motion

Existing approved motion behavior is retained. No launch-engineering animation library or new required motion was added. The project already carries reduced-motion handling in its shared styles/components where implemented; this audit does not claim every decorative motion path is independently browser-certified.

## Contrast and tap targets

No launch-engineering change alters the approved color system or component sizing. Existing QA screenshots cover desktop/tablet/mobile layouts. A final visual check on the production deployment is still required for browser-rendered contrast, zoom and touch-target regressions because those cannot be certified solely from source inspection.

## Status

**READY at code/build level, pending final manual production-browser verification.** No accessibility blocker was introduced by the launch-engineering changes. If the customer portal or consent UI lands before launch, add those routes/dialogs to this pass rather than assuming this certificate covers them.
