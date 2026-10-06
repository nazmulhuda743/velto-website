# Meta Pixel

Browser Pixel now, verified event by event. A controlled Conversions API (server events with the same
`event_id`) comes later; nothing server-side is switched on today.

## Setup

| What | Value |
|---|---|
| Dataset (Pixel) | **Velto**, ID `1572691373844990` |
| Business | VELTO Main Business Manager (`1347126786644196`) |
| Ad account | `873792777878854` (the account Velto's ads run from); already connected to the dataset |
| Env var | `NEXT_PUBLIC_META_PIXEL_ID=1572691373844990`, Vercel Production + Preview |

Dataset settings, as of 6 Oct 2026:

- Automatic website matching (advanced matching): **Off**. It would hash phone/email from the booking form.
- Automatically include more detailed page and product info: **Off**.
- Automatic events, Core setup, "Track events automatically without code": **Off**.
- Conversions API: a "Web-only, connection pending" entry exists and is **not** active. Leave it until the
  controlled CAPI work.
- A second dataset, "Velto Website" (`28841158055514208`, business "Velto", ad account "Velto Ad Account"),
  was created by mistake on 6 Oct 2026. It is unused; the site does not send to it.

Do not add a Meta Pixel tag in GTM: the site loads the Pixel itself and a second copy double-counts.
The live container GTM-NZGDZXTM had the five `Meta - …` tags from the old export (placeholder Pixel
`000000000000000`, broadcast `fbq('track')`). They were **paused** in GTM Version 3 ("Pause Meta Pixel tags",
6 Oct 2026); GA4 tags were not touched. Unpause them only if the site's own Pixel is removed. As a second
safeguard, the site's `fbq` ignores broadcast `track`/`trackCustom` calls and `init` of any other Pixel.

## How it works

- `src/components/consent/MetaPixel.tsx` starts the Pixel only after **Marketing** consent, never on
  account, sign-in, `/r/`, `/i/` or `/track` pages. Withdrawing consent sends `fbq('consent','revoke')`.
- `src/lib/meta-pixel/client.ts` is the only `fbq()` caller. Automatic configuration and the Pixel's own
  history-based PageView are off; PageView is sent once per path. Every event carries an `eventID`.
- `src/lib/meta-pixel/events.ts` maps the site's analytics events (`track()` in
  `src/components/layout/Analytics.tsx`) to Meta events. Parameters are fixed words or sanitised slugs only:
  no name, phone, address, notes or email.

## Event map

| Meta event | Type | Fires when | Parameters |
|---|---|---|---|
| PageView | standard | each page (once per path) | none |
| ViewContent | standard | a service page or outlet page opens | content_name, content_category (`service` / `location`), page_path |
| Contact | standard | WhatsApp or call tap | contact_method, service, button_location, placement, page_path |
| WhatsAppClick | custom | WhatsApp tap | service, button_location, placement, page_path |
| CallClick | custom | call tap (`phone_click`) | button_location, placement, page_path |
| BookPickupClick | custom | Book a Pickup / Set up regular pickup tap | service, cta, button_location, placement, page_path |
| InitiateCheckout | standard | first real interaction with the `/book` form | content_category, service, page_path |
| Lead | standard | booking or household quote **accepted by Velto Ops** | lead_type (`pickup_booking` / `household_quote`), service, page_path |
| Schedule | standard | that booking reserved a live pickup window | content_category, service, page_path |
| FindPrice | custom | an item is chosen in Find a Price | item, page_path |
| QuoteStart / CallbackRequest | custom | quote form started / call-back requested | page_path |
| GetDirections / ReviewClick | custom | directions / Google reviews link | branch (`sector_11` / `sector_18`), button_location, page_path |

There is no Purchase: the website never sees a completed order. Services are normalised to
`dry_cleaning`, `wash_and_iron`, `ironing`, `curtain_cleaning`, `carpet_cleaning`, `blanket_cleaning`,
`express_service`. `button_location` is one of `hero`, `header`, `sticky_mobile`, `mobile_menu`, `footer`,
`final_cta`, `pricing_section`, `location_section`, `reviews_section`, `service_section`,
`regular_laundry_section`, `booking_form`, `quote_form`, `other`.

The public site has no call button today, so CallClick is mapped but has nothing to fire it.

## Staff browsers

A browser with the `velto_staff=1` cookie loads no GTM/GA4, no Meta Pixel and sends no first-party events, so
staff use never counts as customer traffic. It is set on admin sign-in, or by opening any page with
`?velto_staff=1` once (`?velto_staff=0` removes it). Use `?velto_staff=0` before testing tracking.
An IP filter was not used: Bangladeshi ISPs share IPs, so it could filter real customers.

## Verify

1. Events Manager → Velto → **Test events** → open the site from there.
2. Accept **Marketing** in the cookie banner (Reject must send nothing).
3. Check: one PageView per page; ViewContent on `/services/*` and `/locations/*`; Contact + WhatsAppClick
   on a WhatsApp tap; BookPickupClick on Book a Pickup; FindPrice on choosing an item; InitiateCheckout on
   the first booking-form input; Lead (and Schedule if a window was reserved) only after a real booking.
4. Browser devtools → Network → filter `facebook.com/tr`: one request per event, no duplicate `ev=PageView`.

## Meta Ads

Velto's current campaigns are click-to-message (Messenger/WhatsApp). They don't send people to the website,
so the Pixel doesn't measure them. The Pixel is for website-destination campaigns and retargeting site
visitors. For website campaigns, optimise for **Lead** once it has volume; until then optimise for
**Contact** or **InitiateCheckout** and judge results against real orders in Ops.
