# Customer push notifications

Source design: the owner's "Velto — out-of-app push notification system" design doc (Oct 2026).
It was written for a native app. Velto's customers use the website (web push in Chrome on Android;
on iPhone only after "Add to Home Screen"), so this file records what was built as designed, what
was translated, and what still needs an Ops event before it can be sent.

## What is built

| Piece | Where |
|---|---|
| The mapping layer: 23 states (P01–P20 plus the variants P12b, P14r, P16d, P20s, and P00 welcome), each with its class, lane, customer setting, English and Bangla copy, picture and link | `src/lib/push/catalog.ts` |
| Copy rules enforced in tests: no emoji, no second "!", no banned phrases, no order code as the headline (except as the last-resort label), no address or phone | `copyProblems()`, `tests/command-center/push-catalog.test.cjs` |
| Truth rules enforced in tests: requested ≠ confirmed, collected has no count or price, reported ≠ verified, ready ≠ on the way, a balance never on the lock screen | same test |
| Which-order label: none → service → garment count → order number | `orderLabel()` |
| One card per order and lane (collapse key `order:lane`); a late, older push never overwrites a newer one (`seq`); Delivered clears that order's other cards except an open payment; class 1 stays until opened; class 3 is silent | `src/app/sw.js/route.ts` |
| Pictures per kind of news | `public/notify/*.png` |
| Admin gallery: every design in English and Bangla, sendable to a phone for review | `/admin/accounts/notifications` |
| Live today: P04 Collected, P10 Ready, P12 Delivered (from Ops order status), P20 / P20s reminders, P00 welcome and the staff test | `src/lib/push/messages.ts` |
| Six customer settings (order, pickup & delivery, care, payment, reminders, offers) and the after-booking permission sheet | `NotifyCard.tsx`, `website_push_prefs.sql` |

## Audit: design doc → website

| Doc says | Website reality | What we did |
|---|---|---|
| `velto://order/...` deep links | No app; links are website paths | Same destinations as site paths: `/account/orders/VEL-…#care`, `#payment`, `#delivery`, `/account#pickups`, `/r/<code>` |
| Android channels (velto.care / velto.order / velto.repeat), iOS Time Sensitive | Web push has no channels or interruption levels | Class 1 → `requireInteraction` (stays); class 2 → alerts once, replaced by tag; class 3 → `silent` |
| Lock screen: two payloads (public vs private) | A website cannot tell whether the phone is locked | Every payload is written to be lock-screen safe. P13 never carries the balance; P11 and P12b keep the amount because the customer needs it at the door |
| "Remind me later" on P07 | Needs a server-side reminder schedule | Not added yet (integration step 3). P07 has one button: Review decision |
| Header "Velto · now" | Chrome shows "Chrome · velto.com.bd" unless the site is installed | Unchanged; installing the site as an app shows "Velto" |
| Icon: monochrome Velto mark | The small badge is already the monochrome mark | Kept, plus a large picture per kind of news (owner's choice of 1 Oct) |
| Buttons only on class 1 | The 1 Oct version had "View order / Call Velto" on every update | Now only class 1 has a button, following the doc. `/go/call` stays available |
| No emoji | 1 Oct titles had "✓" | Removed |
| P04 has no count | 1 Oct "picked up" push showed the item count | Removed |
| P12 "receipt is ready" only when settled | The Ops event doesn't carry the balance yet | P12 says only "Thank you for choosing Velto" until the balance is in the event (step 1) |
| Permission asked after the first booking | Already shown after a booking | Restyled to the doc's sheet, "Not now" offered again at the next order |
| Preferences: operational ≠ marketing | Two switches | Six switches, offers off by default |

## Integration plan (Ops events → pushes)

Each step is one PR plus one SQL file (staging test, then production), in this order: what customers
feel most first, and what Ops already records first.

1. **Order lane, from data Ops already has.** `orders.order_status` + `order_status_history`
   (Picked, Ready, Delivered), `orders.total_items`, `orders.total_amount`, `orders.due`,
   `orders.service_category`, `orders.delivery_date`. Extend `website_push_order_events` to return
   due, service and the customer's other live orders, so P12/P12b pick the right variant and every
   push gets the which-order label. Add P05 when Ops has a "verified at outlet" moment (today the
   count is entered at intake: confirm with the owner whether intake = verification).
2. **Customer approvals (P07, P08).** Ops already has `orders.advisory_status`
   (pending / approved / declined) and `floor_issues` (decision, notify_to). Map a new
   `pending` → P07 (class 1), and an approval made by phone or WhatsApp → P08. Build the website's
   decision screen at `/account/orders/VEL-…#care`, showing the decision without the garment
   detail in the push, and the choice buttons only after sign-in.
3. **Reminder for a pending approval.** One reminder after 4 hours, one the next morning, then stop
   (doc P07). A small schedule table plus the existing 10-minute push cron. Add "Remind me later"
   then.
4. **Pickup lane (P01–P03).** P02 from Today: when a manager assigns a rider and a window
   (`website_dispatch_plan`). P01 only for requests made by phone or WhatsApp. P03 needs an
   "approaching" tap in the Ops rider app; it is never inferred.
5. **Delivery lane (P11, P16–P18).** P11 when the rider starts the delivery run. P16/P16d/P17 from
   the customer's own change and the manager's confirm or decline. P18 from a "could not deliver"
   button in Ops.
6. **Payment lane (P13–P15).** `orders.due` and `payments` exist; a customer "I have paid" report
   and a finance "verified / rejected" step do not. Build both before P14/P14r/P15.
7. **Problems (P19).** `floor_issues` covers outlet problems; customer-reported problems need a case
   record first.
8. **Pipeline guarantees.** One idempotency key per order + lane + state (the existing
   `website_push_sent` table), `seq` from the state change time, every send/suppress/open logged,
   preferences checked at send time, and an unmapped Ops status can never produce a push.

Before each step goes live: check it in `/admin/accounts/notifications` with "Send to this phone".
