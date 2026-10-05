# Google Tag Manager container (GA4 + Meta Pixel)

`velto-gtm-container.json` is a ready-to-import GTM container for www.velto.com.bd. It only reads the
events the website already pushes to `dataLayer` (`src/components/layout/Analytics.tsx`); nothing in the
website changes.

## What it contains

The website keeps one event vocabulary (its own `dataLayer` names, also used by first-party analytics).
The container translates them into GA4's names. Updated 2026-10-06.

| Website event (`dataLayer`) | GA4 event | Notes |
|---|---|---|
| `page_view` | `page_view` | The only page view source: the Google tag has `send_page_view` off |
| `service_view` | `view_service` | `service` normalised to `dry_cleaning`, `wash_and_iron`, `ironing`, `curtain_cleaning`, `carpet_cleaning`, `blanket_cleaning`, `express_service` |
| `pricing_search` | `find_price` | Fires when a price is chosen in Find a Price, not when the section is seen; `item` |
| `pricing_view` | `pricing_view` | |
| `book_pickup_click` | `book_pickup_click` | Intent only, never a lead |
| `booking_start` | `begin_checkout` | First interaction with the booking form |
| `booking_success`, `quote_success` | `generate_lead` | `lead_source` = `booking_form` / `quote_form`. Reminder-link rebookings are excluded |
| `booking_success` from a reminder link | `repeat_booking` | Existing customers rebooking; not a lead |
| `booking_error`, `quote_start`, `track_order_open`, `regular_laundry_interest` | same name | |
| `whatsapp_click` | `whatsapp_click` | A tap, not a lead |
| `google_reviews_click` | `review_click` | `branch` = `sector_11` / `sector_18` |
| `directions_click` | `get_directions` | `branch` = `sector_11` / `sector_18` |

Every GA4 event carries, where known: `page_path`, `button_location` (the site's `placement`: `header`,
`hero`, `mobile_sticky`, `footer`, `locations`, `location_hero`, …), `section`, `service`, `branch`, `item`.
Campaign attribution is GA4's own (UTMs / gclid on the landing page). No name, phone, email or form text
ever reaches `dataLayer`.

Not sent, on purpose: `phone_click` (the public site has no call button), `schedule_pickup` (a website
booking is a request Velto confirms later, not a confirmed schedule) and `purchase` (orders exist only in
Velto Ops; see REVENUE-ATTRIBUTION-DESIGN.md §11a).

| Meta tag | Fires on | Consent |
|---|---|---|
| Pixel base (no automatic PageView) | All Pages, once per load | `ad_storage` |
| PageView | `page_view` | `ad_storage` |
| Lead | new booking or quote (not reminder rebooks) | `ad_storage` |
| Contact | `whatsapp_click` | `ad_storage` |
| ViewContent | `service_view` | `ad_storage` |

`GA4 Measurement ID` is `G-ZGZP27PHYW` (the ID in the live container on 2026-10-06). `Meta Pixel ID` is
`28841158055514208`, the "Velto Website" dataset in the Velto business. **The live container (version 2)
still had the placeholder `000000000000000` on 2026-10-06, so no Meta website event had reached a pixel.**

## Import

1. GTM → your container → **Admin → Import Container** → choose `velto-gtm-container.json`.
2. Workspace: **Existing** (Default Workspace). Option: **Merge → Rename conflicting tags**.
3. **Variables:** open `GA4 Measurement ID` and set your `G-…` ID; open `Meta Pixel ID` and set your Pixel ID.
4. **Preview** on https://www.velto.com.bd:
   - Choose **Reject** in the cookie banner: no GA4 or Meta tag fires (GTM should not even load).
   - Choose **Accept all**: `GA4 - Google tag`, `GA4 - page_view`, `Meta - Pixel base`, `Meta - PageView` fire.
   - Click Book a Pickup and WhatsApp, and submit a test booking: `book_pickup_click`, `whatsapp_click`,
     `booking_success` and `Meta - Lead` fire. Delete the test task in Ops afterwards.
5. **Submit → Publish.**
6. Vercel → Production env: `NEXT_PUBLIC_GTM_ID=GTM-XXXXXXX` (the container's public ID) → Redeploy.
7. GA4 → Admin → Events: mark `generate_lead` as a **key event** (and, until orders can be imported,
   `whatsapp_click` as a secondary one). GA4 → Admin → Data streams → Enhanced measurement → Page views →
   Advanced: turn **off** "Page changes based on browser history events", or every client-side page change
   is counted twice.
   Meta Events Manager: check that `Lead` arrives and set it as the conversion for lead campaigns.

## Ads links

Tag every ad and profile link with UTM parameters so bookings carry their source into Ops
(the "Campaign:" line on the task) and into revenue attribution:

- Meta ads: `?utm_source=facebook&utm_medium=paid_social&utm_campaign=<campaign>&utm_content=<ad>`
- Google Ads: auto-tagging on (`gclid`) plus `utm_source=google&utm_medium=cpc&utm_campaign=<campaign>`
- Google Business Profile: `https://www.velto.com.bd/locations/sector-11?utm_source=google&utm_medium=gbp&utm_campaign=sector-11`
  (and `sector-18` for the RUAP outlet)
