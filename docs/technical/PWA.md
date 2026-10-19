# Installable app (PWA)

The website can be installed from the browser ("Install app" / "Add to Home Screen"). It opens
its own screens under `/app/` (see below), starting at `/app/home`.


## The app's own shell (/app/*)

The installed app is **everything under `/app/`** (manifest `scope: "/app/"`, `start_url: "/app/home"`),
with its own layout: `src/app/[lang]/app/(shell)/layout.tsx` (logo header, the screen, tab bar
Home · Book · Orders · Profile). No website component loads there, so nothing from the website can
appear in the app. The website's routes and pages are unchanged.

The screens follow the owner's app design (`docs/design/velto-app-screens.dc.html`); their rules
(home state, default slot, expected return, tracker) are pure and tested in
`src/lib/customer/app-logic.ts` / `tests/app-logic.test.cjs`.

| App screen | Route | View (`src/components/app/…`) |
|---|---|---|
| Home | `/app/home` | `home/AppHomeView` (state card: first, rebook, welcome back, in progress; `RebookCard`) |
| Book | `/app/book` | `book/AppBookView` + `book/AppBookingFlow` (summary rows and sheets) |
| Orders | `/app/orders`, `/app/orders/[id]` | `orders/AppOrdersView`, `orders/AppOrderView` |
| Prices | sheet from the header's Prices pill; `/app/prices` for links | `prices/PricesButton`, `prices/PricesPanel` |
| Profile | `/app/profile` and its sub-screens | `profile/AppProfileView` (details, addresses, preferences, weekly, notifications, language) |
| Rewards | `/app/rewards` (only when rewards are on) | `RewardsView` (shared with the website) |
| Sign-in | `/app/login` | the website's mobile sign-in, the code as six boxes |
| Install screen | `/app` | `pwa/AppInstallPage` (for browsers; inside the app it goes to `/app/home`) |
| Offline | `/app/offline` | stored by the worker, shown for `/app` pages it can't reach |
| Error, loading | `(shell)/error.tsx`, `(shell)/loading.tsx` | `AppErrorScreen`, the Home skeleton |

- **Links** come from `customerRoutes("/app")` (`src/lib/app-routes.ts`), so the app never links out
  of `/app/` and the website never links in.
- **Sessions:** `accountGate()` (`src/components/account/AccountGate.tsx`) gives the website account
  and the app the same states (can't load, staff, welcome back, unfinished profile). Signed out, the
  proxy sends `/app/*` to `/app/login?next=…`.
- **Language:** app addresses are never prefixed (a `/bn/app/…` page would fall outside the scope).
  The proxy serves `/app/*` from the Bangla tree when the `velto_lang` cookie says so; `/bn/app/…`
  redirects to `/app/…` and sets the cookie.
- **Safety net:** inside the installed app, a website page (an old install that started at
  `/account`, a push or email link) goes to the app's own page: `appSafetyTarget` /
  `APP_MODE_SCRIPT` (`src/lib/pwa/install-card.ts`) and `AppMode`. Legal pages, `/auth`, `/r`, `/i`
  open as they are.
- `/app/*` is private for analytics (only the app's own events below), never cached by the worker
  (only its offline screen is stored), and disallowed in robots.txt.
- **App events** (handoff §7; first-party only, consent-gated, no order or customer data, order
  numbers redacted from the path): `app_home_state` (detail: first, regular, lapsed, in_progress),
  `rebook_tap` (placement: home_card, book_again, book_tab), `app_booking_success` (detail: seconds
  from app open; the website's `booking_success` stays the website's conversion), `order_view`
  (detail: the step), `prices_open` (sheet, page), `feedback` (all_good, off), `weekly_offer_shown`
  and `weekly_on` (home, order), `notify_prompt` / `notify_on` / `notify_denied`. Helpers in
  `src/components/app/appEvents.tsx`.

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
  (detail: prompt, not_now, close), plus `app_launch`. With the notification and app events above,
  they are the only events recorded on account pages (`PRIVATE_PATH_EVENTS`,
  `src/lib/analytics/events.ts`); the path stays redacted.

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
- **Account, booking, quote, track, sign-in, admin**: network only, never saved; offline shows `/offline`
  (the app's own `/app/offline` for `/app` pages, `swOfflinePage`).
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
