# Google Tag Manager container (GA4 + Meta Pixel)

`velto-gtm-container.json` is a ready-to-import GTM container for www.velto.com.bd. It only reads the
events the website already pushes to `dataLayer` (`src/components/layout/Analytics.tsx`); nothing in the
website changes.

## What it contains

| Tag | Fires on | Consent needed |
|---|---|---|
| GA4 - Google tag (`send_page_view` off) | All Pages | `analytics_storage` |
| GA4 - `page_view` and 14 events: `service_view`, `pricing_search`, `pricing_view`, `book_pickup_click`, `booking_start`, `booking_success`, `booking_error`, `quote_start`, `quote_success`, `whatsapp_click`, `google_reviews_click`, `directions_click`, `track_order_open`, `regular_laundry_interest` | the matching custom event | `analytics_storage` |
| Meta - Pixel base (no automatic PageView) | All Pages, once per load | `ad_storage` |
| Meta - PageView | `page_view` | `ad_storage` |
| Meta - Lead | `booking_success`, `quote_success` | `ad_storage` |
| Meta - Contact | `whatsapp_click` | `ad_storage` |
| Meta - ViewContent | `service_view` | `ad_storage` |

- Page views come from the site's own `page_view` event, so client-side navigation is counted once per
  page. The GA4 Google tag therefore has `send_page_view` off.
- Every Meta event tag runs the Pixel base tag first (tag sequencing), so no event is lost if it arrives
  before the base code.
- Event parameters sent to GA4: `service`, `placement`, `section`, `branch`, `item`, and the campaign
  fields `source`, `medium`, `campaign`, `content`. No name, phone, email or form text ever reaches
  `dataLayer`.
- The website loads GTM only after the visitor accepts Analytics or Marketing, and sets Consent Mode v2
  (`default` all denied, then `update`). The per-tag consent checks above are a second safeguard.

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
7. GA4 → Admin → Events: mark `booking_success` and `quote_success` as **key events**.
   Meta Events Manager: check that `Lead` arrives and set it as the conversion for lead campaigns.

## Ads links

Tag every ad and profile link with UTM parameters so bookings carry their source into Ops
(the "Campaign:" line on the task) and into revenue attribution:

- Meta ads: `?utm_source=facebook&utm_medium=paid_social&utm_campaign=<campaign>&utm_content=<ad>`
- Google Ads: auto-tagging on (`gclid`) plus `utm_source=google&utm_medium=cpc&utm_campaign=<campaign>`
- Google Business Profile: `https://www.velto.com.bd/locations/sector-11?utm_source=google&utm_medium=gbp&utm_campaign=sector-11`
  (and `sector-18` for the RUAP outlet)
