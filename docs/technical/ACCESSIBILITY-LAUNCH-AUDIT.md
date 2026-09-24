# Launch Accessibility Audit

Scope: current launch-critical public website and admin login. No customer-portal or cookie-consent work is included because that is owned by the parallel Claude workstream.

## Source/runtime checks in launch gate

- Every public route renders `html lang=en`.
- Every public route has a primary `<main id="main">` landmark and an H1.
- Site layout provides a keyboard skip link.
- Rendered images require alt text and stable dimensions/fill containers.
- Forms use the shared field components and preserve visible validation/error states.
- Mobile/navigation controls use real buttons/links with names rather than click-only divs.
- Motion-heavy behavior is not required; the marquee exposes pause behavior and reduced-motion users receive a non-moving alternative.
- Existing focus classes remain untouched and no launch patch removes focus indicators.

## Launch-critical manual follow-up

On the final production deployment, keyboard-walk `/`, `/book`, `/quote`, `/track`, `/pricing` and `/admin/login` at desktop and mobile widths. Confirm:

1. focus order follows visual order;
2. mobile menu opens/closes and returns focus sensibly;
3. form errors are associated with the relevant field and remain readable;
4. buttons/links have at least practical touch target spacing;
5. no focus is trapped behind sticky conversion UI;
6. reduced-motion preference prevents nonessential continuous motion;
7. text/button contrast remains legible over actual uploaded images.

## Status

Source-level accessibility regression checks are automated and green only when `npm run test:launch` passes. Final visual/keyboard certification remains tied to the final deployment after the parallel customer/consent PR is reconciled.
