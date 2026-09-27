# Installable app (PWA)

The website can be installed from the browser ("Install app" / "Add to Home Screen"). It opens
the same website: no screens, flows, consent or analytics were changed. There is no install
banner; the browser's own install option is used.

## Pieces

| Piece | Where |
|---|---|
| Manifest (`/manifest.webmanifest`) | `src/app/manifest.ts` (linked in `src/app/[lang]/layout.tsx`) |
| Icons (192, 512, maskable, monochrome) | `public/icons/`, cut from `public/brand/velto-logo.png` (official artwork, not redrawn) |
| Service worker (`/sw.js`) | `src/app/sw.js/route.ts`, rules in `src/lib/pwa/sw-rules.ts` |
| Registration + `app_launch` event | `src/components/pwa/ServiceWorker.tsx` (production only) |
| Offline page (`/offline`) | `src/app/[lang]/(site)/offline/page.tsx` |

`src/proxy.ts` excludes `manifest.webmanifest` (its extension is longer than the file rule).

## What the worker does

- **Build files, brand art, icons**: cache first (content-hashed, never change).
- **Photos**: stale-while-revalidate, up to 60.
- **Public pages**: network first. After 4 s, or offline, the last saved copy; otherwise `/offline`.
  Only responses that are not `private`/`no-store` are saved (e.g. `/pricing` is live and never saved).
- **Account, booking, quote, track, sign-in, admin**: network only, never saved; offline shows `/offline`.
- **API, `/go/*`, other sites, POSTs, server actions, RSC payloads**: not touched.
- Every deploy gets a new worker version (`VERCEL_DEPLOYMENT_ID`); old caches are deleted on activate.

## Kill switch

Set `NEXT_PUBLIC_PWA_ENABLED=false` in Vercel and redeploy: `/sw.js` becomes a worker that deletes
its caches and unregisters, and the page unregisters any worker too.

## Testing

- `node scripts/command-center-tests.mjs`: routing rules (`tests/command-center/pwa.test.cjs`).
- `npm run test:pwa` against `next start`: manifest, icons, worker headers, offline page.
- Manual, on real devices: Android Chrome (install from menu), iPhone Safari (Share → Add to Home
  Screen), desktop Chrome/Edge. With the server stopped: a visited page opens, an unvisited page and
  `/book` show the offline page. Chrome DevTools → Application shows no manifest or installability errors.

## Differences inside the installed app

- iPhone keeps a separate cookie store for installed apps: customers sign in once more there.
- Email links (confirm, password reset) open in the browser, not the app.
- WhatsApp, phone and Google Maps links open their own apps as before.
