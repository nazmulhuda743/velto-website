# Smart upsell (phase 6)

The ৳499 nudge (PR #77) suggested a fixed list of popular items. The suggestions now come from what
Velto's customers actually send, read from Velto Ops orders (`docs/technical/sql/website_upsell.sql`):

| Where | What | Source |
|---|---|---|
| Booking form, order summary | **You usually send**: the signed-in customer's regular items not yet in the order | `portal_usual_items()`: items in 2+ of their last 10 orders |
| Booking form, order summary | **Often sent with Shirt**: what customers most often send with the items already in the order | `website_item_affinity()`: pairs from the last 180 days, seen together in 8+ orders and in 15%+ of the item's orders |
| Booking form, order summary | Popular items that close the ৳499 gap (as before), only when nothing better fits | the fixed popular list |
| Bookings & quotes card | **Usually sends**: the phone's regular items, to ask about on the confirmation call | `website_usual_items(phones)` |

Rules (`smartAddOns` in `src/lib/booking-upsell.ts`, unit-tested):
- Only items on the price list with a fixed price for that service.
- Never an item already in the order, and one suggestion per item.
- Below ৳499: at most 3, in the order usual → sent together → popular.
- Once delivery is free: at most 2, and only usual or sent-together items (no generic push).
- Each chip says why it is offered ("You usually send", "Often sent with Shirt"). The heading reads "Often added"
  when any suggestion is data-based.

Store-wide pairs are cached on the server for 6 hours; in production they take about 40 ms to compute
(2,300+ orders with item lines in 180 days gave 46 pairs across 19 items on 2026-09-29).
Measure it with `booking_addon_add`, whose placement is `addon_usual`, `addon_pair` or `addon_popular`.
Tests: `tests/booking-upsell.test.cjs`, `docs/technical/sql/tests/website_upsell_test.sql` (staging, rolls back).
