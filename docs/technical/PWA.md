# Installable app (PWA)

The website can be installed from the browser ("Install app" / "Add to Home Screen"). It opens
the same website, on the customer's account page (`start_url: /account`).

## "Install Velto" popup

`src/components/pwa/InstallSheet.tsx`: a native `<dialog>` (bottom sheet on phones), asked for only
once the customer has booked or opened their account.
- **After a booking** (booking success, and the one-tap rebook page `/r/[code]`): it waits for the
  notification sheet (`NotifyCard` variant `after` sends `velto:notify-done` once it is answered or
  can't show). iPhone, where notifications need the home-screen app first, sees Install straight
  away; Android sees notifications first, then Install. Never both at once.
- **Account page:** 1.5 s after it opens.
- **`velto.com.bd/app`** (in the Bring-back WhatsApp messages) → `/account?install=1` (sign-in first
  when signed out), which opens the popup at once, even after "Not now".
- **Android / Chrome:** the browser's `beforeinstallprompt` is kept by an inline script at the top of
  `<body>` (`INSTALL_PROMPT_SCRIPT`, `src/lib/pwa/install-card.ts`; it fires before React hydrates),
  and "Install Velto" calls it: one tap.
- **iPhone:** no prompt exists, so the popup shows the Share → "Add to Home Screen" steps.
- **Never** inside the installed app or on desktops without a prompt; "Not now" (or closing it) holds
  for 14 days (`velto.install.dismissed`). Rules in `install-card.ts`, tests in
  `tests/command-center/install-card.test.cjs`.
- **Events:** `install_prompt_shown`, `install_ios_shown`, `install_accepted`, `install_dismissed`
  (detail: prompt, not_now, close), plus `app_launch`. They are the only events recorded on account
  pages (`PRIVATE_PATH_EVENTS`, `src/lib/analytics/events.ts`); the path stays redacted.

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
- Manual, on real devices: Android Chrome (book → notification sheet → "Install Velto" popup → one tap;
  the app opens on the account page and the popup no longer shows), iPhone Safari (book → the popup's
  steps; open Velto from the home screen → turn on notifications works), desktop Chrome/Edge. With the server stopped: a visited page opens, an unvisited page and
  `/book` show the offline page. Chrome DevTools → Application shows no manifest or installability errors.

## Differences inside the installed app

- iPhone keeps a separate cookie store for installed apps: customers sign in once more there.
- Email links (confirm, password reset) open in the browser, not the app.
- WhatsApp, phone and Google Maps links open their own apps as before.
