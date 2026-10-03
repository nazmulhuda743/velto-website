# The Second Service ladder

Status: **BUILT and TESTED on staging** (`ekgdefcdqcsqvpbqponv`). Production needs, in this order:
`docs/technical/sql/website_invoices.sql`, then `docs/technical/sql/website_second_service.sql`.

## Why (prod, 2 Oct 2026)

| Services a customer has used | Customers | Orders each | Lifetime value |
|---|---|---|---|
| Dry Cleaning only | 291 | 1.3 | ৳811 |
| Ironing only | 185 | 2.3 | ৳366 |
| Wash + Iron only | 51 | 1.4 | ৳996 |
| Any two | 166 | 3.9–6.9 | ৳2,400–2,700 |
| All three | 57 | 11.8 | ৳4,673 |

70% of customers use one service, and the second service multiplies value by 3–7×.
- **Dry cleaning** is an occasion purchase: 38.8% order again and ~15% ever try ironing. They need a *habit*, so
  they pick a weekly day (an implementation intention).
- **Ironing** customers already trust us weekly but spend ৳140 an order. They need *no extra effort*: "add it to
  the pickup you already have" (habit stacking).

## What the customer sees

The invoice link staff send on WhatsApp (`INVOICES.md`). When the order is **Delivered**, the page opens with:
1. **"Delivered. Thank you, {name}"**, with their real items, then **"How did it go?"** (5 stars).
   - 4–5 stars: thanks, then the outlet's Google review link.
   - 1–3 stars: what went wrong, which opens a task on the website board (the same `customer_order_feedback` as
     the account, shown in Admin → Customer feedback; the source is `via_link`).
2. **One next service** (`src/lib/second-service.ts` `nextService`):
   - Dry Cleaning only → **"Your everyday clothes, too"**: pick a day and time (Saturday evening by default),
     which creates an Ops call task to confirm a weekly pickup.
   - Ironing / Wash, never Dry Cleaning → **"Next time, add your dry cleaning"**, which creates an Ops call task
     to add it at the next pickup.
   - Ironing + Dry Cleaning, never Wash → **"Next time, add washing"**.
   - Live prices for 3–4 items come from the price list (`INVITE_ITEMS`). There are no offers.
3. The invoice, then **"Sign in to keep every order"**.

Previews: `/bn/i/preview0?state=first-dc` and `?state=iron-regular` (nothing is sent).

## What staff see
- **Ops tasks** (type `call`, source `website_second_service`). Each carries the name, phone, the request and the
  order. It is deduped per order, kind and service; a changed day is noted on the same task.
- **Admin → Today, Call list:** a hint under the name, e.g. "Ask: anything for dry cleaning? Blazer, sari… (never
  tried)" (`staffAsk`: dry-cleaning-only customers always; add-a-service hints for customers with 2+ orders).
- **Admin → Reminders:**
  - the **Second service** tile: one-service customers before the last 60 days who added another since, split
    A and B, plus the asks and the link ratings;
  - the First-timer card now has a second text for customers whose first order was dry cleaning only
    (`templateFor`).

## Data (`website_second_service.sql`, service_role only)
- `website_invoice_get` (replaces the one in `website_invoices.sql`) adds `isFirst`, `servicesEver`, `rating`
  and `asked`. It still never returns the phone, address or full name.
- `website_invoice_rate`, `website_link_request` (`routine` / `addon`), `website_service_mix(phones)` and
  `website_second_service_stats(days)`.
- `website_link_requests` holds the requests. `customer_order_feedback.auth_user_id` is now nullable, and it
  gains `via_link`.
- The actions work only on Delivered orders whose link is within 120 days. The API is
  `POST /api/invoice/<code>` (`action`: `rate` | `routine` | `addon`).

Test: `docs/technical/sql/tests/website_second_service_test.sql` (staging only, rolls back). Unit tests:
`tests/command-center/second-service.test.cjs`.
