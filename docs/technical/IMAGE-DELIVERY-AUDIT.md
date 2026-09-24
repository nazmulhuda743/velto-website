# Image Delivery Launch Audit

## Current delivery path

- Public site imagery uses the shared Next/Image components (`ResponsiveImage` and `Logo`).
- `next.config.ts` allows AVIF/WebP optimization.
- Admin-uploaded assets are allowed only from HTTPS Supabase Storage URLs under `/storage/v1/object/public/website-media/**`.
- The production bucket contract is public read, 8 MB upload cap, MIME allowlist: JPEG, PNG, WebP, AVIF.
- Admin upload code validates MIME and size before sending data to Storage and generates non-user-controlled object paths.

## Runtime safeguards

`npm run test:launch` inspects every rendered public-page `<img>` and requires:
- an `alt` attribute;
- intrinsic width/height, or a valid Next/Image fill container.

This catches common CLS/accessibility regressions without changing page composition.

## Launch actions

- Apply the reviewed `website-media` bucket configuration before production admin image management is used.
- Verify one controlled admin image upload after production admin authorization is confirmed, but do not delete or bulk-clean storage during cutover.
- If an editor uploads a very large source within the 8 MB ceiling, Next Image still controls delivered responsive dimensions; optimize source files operationally rather than bypassing Next/Image.

## Unused uploads

Unused objects may exist after future content edits. They are not a launch blocker and must not be deleted automatically because historical/admin references may still exist. Handle storage cleanup as a separate, reference-aware maintenance task.
