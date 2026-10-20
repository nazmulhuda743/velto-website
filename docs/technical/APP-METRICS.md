# Velto app: metrics (app step 7)

Status: **BUILT and TESTED** (unit tests, staging SQL, local browser QA with a test page). Production needs
`docs/technical/sql/website_analytics_lang.sql` (optional: the site works without it, see "Language").

The design (`docs/design/velto-app-screens.dc.html`, "Metrics that prove it works") names eight numbers.
They are on **Admin → Velto app** (`/admin/app`, analytics section, same people as Visitor journey).

## Privacy line
- **GTM and the Meta Pixel never load on `/app/*`** (unchanged). Nothing from the app goes to Google or Meta.
- The app's events go only to Velto's own `website_analytics_events`, and only with **Analytics consent**.
  The installed app asks once, above the tab bar (`ConsentManager inApp`), because an iPhone app keeps its
  own storage.
- **Staff browsers are never counted** (`isStaffBrowser`, unchanged).
- **No customer id, name, phone or order number** is stored. Order paths are redacted to `/app/orders/[order]`.
- The website's `/account` pages stay as before: only app launches and the install card are recorded there.
- The allowed events per page live in `src/lib/analytics/events.ts` (`PRIVATE_PATH_EVENTS`, `APP_PATH_EVENTS`).
  The browser (`track`) and `/api/collect` both check them.

## Events
| Event | When | placement | detail |
|---|---|---|---|
| `app_open` | The shell loads, or comes back to the screen after 5+ minutes away (`AppOpenTracker`) | `installed` / `browser` | Home state: `in_progress`, `pending`, `regular`, `lapsed`, `first`, or `elsewhere` |
| `booking_start`, `booking_success` | An app booking is sent / saved | where it started (below) | success only: seconds from open, `0-30`, `30-60`, `60-120`, `120-plus` |
| `book_pickup_click`, `whatsapp_click` | Taps on the app's buttons | the button's placement, e.g. `app_order_help` | |
| `order_view` | An order screen opens (`OrderViewBeacon`) | `app_order` | tracker step |
| `notify_prompt`, `notify_on`, `notify_denied` | After the first booking, and Profile → Notifications | `app_book_success`, `app_profile_notifications` | `phone`, or the kind switched |
| `notify_off` | A kind of message switched off | `app_profile_notifications` | the kind, e.g. `offers` |
| `routine_change` | Weekly pickup requested, changed, paused, resumed, withdrawn or stopped | `app_profile_weekly` | the action |

**Where a booking started** (`src/lib/customer/app-sources.ts`): `app_home_card` (one tap on Home),
`app_home_change`, `app_book_again`, `app_book_tab`, `app_home_first`, `app_home_other`, `app_orders`,
`app_prices`, else `app_book`. The same value goes into the booking's `source`. It lands in the Ops task's
campaign line and in `website_leads.source`, **whatever the consent choice**, so rebook share can also be
counted from bookings.

## The report (`src/lib/admin/app-metrics.ts`, unit-tested)
1. **Second order within 30 days:** from Ops orders, on Bring customers back (linked).
2. **Rebook share:** app bookings from `app_home_card`, `app_home_change` or `app_book_again`, out of all app
   bookings.
3. **Open to booked:** the share of timed bookings in under 30 seconds, plus the four buckets.
4. **Lapsed reactivation:** people with a `lapsed` open who booked in the app within 14 days.
5. **Tracking:** order views by step, and WhatsApp taps from an order's help, per week. WhatsApp messages
   sent directly are outside the website.
6. **Weekly pickup:** routine actions in the app. 8-week survival comes from Ops weekly pickups
   (`website_routines`, `tasks.source='weekly'`).
7. **Notifications:** asks, turned on (opt-in rate), blocked, kinds turned off.
8. **Bangla:** the Bangla share of app sessions, and the booked share of sessions that opened the app, per
   language.

All numbers count only consenting app users. A rate with nothing to divide by shows "Not enough data yet".

## Language
`track()` sends the page language (`<html lang>`) with every batch. `/api/collect` keeps `en` or `bn`.
`website_analytics_lang.sql` adds the nullable `lang` column with a check, plus an index for app paths.
**Until it runs, nothing breaks:** `storeCollected` sees PostgREST's unknown-column error (PGRST204) and stores
the rows without `lang`, and the report reads `*`. Run it on production to get the Bangla numbers.

## Cleanup done in this step (design "What changes in the current build")
- The Home tab is no longer highlighted on `/app/prices`. The page stays for links into the app.
- "All items and prices" in Book's item picker and "See prices first" on Home open the prices **sheet**. The
  picked items stay.
- **Rebook repeats the whole set:** a repeated order's services win over `?service=`
  (`bookingServicesFor`).
- **Order detail:** no Due row before the items are counted. The Ready line is a pill.
- **Weekly pickup screen:** the app's look (`RoutineCard` with `base="/app"`). It is still a request staff
  confirm, so it keeps its button.
- **Removed:** 10 unused app header labels, `ProgressBar`, two unused colour tokens, and the `/app` paths left
  in the website account views.

**Still for the backend, from the design:**
- the order count that differs between languages;
- translated service names beyond the three garment services;
- Collected times on every order.
