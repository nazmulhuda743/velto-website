# Pickup & delivery (Command Center → Operations)

`/admin/dispatch`, for Owners, Managers and Customer support.

## One card per booking (`/admin/requests`)

Every website booking and quote is one card, from the first call to delivery, with the next step
done on the card itself:

| Step | Who | On the card |
|---|---|---|
| New | website | A call timer: fine for 30 min, amber after, red after 24 h. **Confirmed with customer** (day + time of day, the customer's choice pre-filled) or **No answer** (attempts counted; after 3, cancel with "No answer after 3 calls") |
| Confirmed | staff | **Assign** a person (day and time of day kept). WhatsApp confirmation, Bangla or English |
| Assigned | staff | **Picked up**, with the Ops order number if it exists already. The Ops task closes. WhatsApp confirmation with the rider's name |
| Picked up | staff | **Link** the Ops order: one tap on an order made for the same phone since the request, or type the number |
| In process → Ready → Delivery planned → Delivered | Velto Ops | Read from the linked order and its delivery job. **Plan delivery** on the card (the order's delivery date pre-filled). WhatsApp "picked up" and "ready" messages |

Also on every card: a repeat request from the same phone (**Merge**), a staff note, **Cancel** with a
reason, the customer's earlier orders in Ops (New to Velto / Returning), the request's details and
photos, and a timeline of every change and WhatsApp message opened. WhatsApp messages open with the
text written out; staff send them from their own WhatsApp. Pickup & delivery stays as the day's plan
by person and links back to each booking.

Data: `docs/technical/sql/website_dispatch_stages.sql` (stages `confirmed` and `picked`, call
attempts, notes, order link, `website_dispatch_context`). A pickup task finished in Velto Ops now
means "picked". Delivery jobs are only created for orders that became Ready in the last 7 days or
are due from yesterday on. Test: `docs/technical/sql/tests/website_dispatch_stages_test.sql`
(staging only; rolls back). Rules: `src/lib/admin/request-flow.ts`, tested in `tests/request-flow.test.cjs`.

## The flow

| Step | Pickups (website bookings and quotes) | Deliveries (orders Ready in Velto Ops) |
|---|---|---|
| 1. Comes in | A website request appears under **Needs a plan**, oldest first | An order at Ready (or Out for Delivery) appears under **Needs a plan** |
| 2. Plan | Call the customer, then give it a **person** and a **slot** (day + Morning / Afternoon / Evening). The customer's own choice is pre-filled | Give it a person and a slot |
| 3. In Velto Ops | The website's task is assigned to that person (it shows under "Assigned to me") and is due at the end of the slot, so the Ops 5-minute reminder fires. They also get a push if their phone is subscribed | One `delivery` task per order is created for that person (`source = website_dispatch`), due at the end of the slot |
| 4. Finish | **Picked up** (or done in Ops) closes it; **Cancel** needs a reason, which is written on the Ops task | Closes itself when the order is Delivered (or Cancelled) in Ops |

Changing a plan updates the same Ops task; nothing is created twice. Every change is in **Activity**.

## New request push

When a website booking or quote is saved, every active Ops **admin** and **manager** whose phone is
subscribed to Velto Ops notifications gets a push: "🧺 New pickup booking · name · area · when ·
service. Call within 30 min." (or "📐 New quote request"). It goes through the Ops `notify-push`
function, one person at a time; people without a subscription are skipped (never the whole team).
It is sent after the customer's response, so it never slows or fails a booking. The push links to
`/admin/requests?stage=new`. Set `VELTO_NEW_REQUEST_PUSH=false` on the server to turn it off.

### Night requests

Velto calls between 9 AM and 9 PM Dhaka (`src/lib/call-hours.ts`: the first outlet opens and the
first pickup window starts at 9 AM; the earlier outlet closes at 9 PM). A request made outside those
hours still sends the push, but it ends "Night request: call in the morning (from 9 AM)." instead of
"Call within 30 min.", and the customer is told the same: the booking form's line under Book Pickup,
the booking and quote confirmations and the "Get a call back" confirmation say Velto will call in the
morning, from 9 AM (English and Bangla). The page shows the daytime wording first and switches after
it loads, so the server and browser never disagree; it re-checks each minute. A booking with a
pickup window already booked needs no call, so its wording doesn't change.

## The delivery board

Deliveries waiting for a plan are grouped by the order's date in Velto Ops, most pressing first:
**Late**, **Due today**, **Due tomorrow**, **Due later**, **No delivery date**, and (folded)
**Waiting at the outlet**: orders Ready for over a week whose date has passed. Each group shows what
the riders collect. Each delivery card shows the order's items, total, **amount to collect** (red),
its date in Ops and how long it has been Ready, and a WhatsApp "your order is ready" message (with the
planned day once a person is set).

**Take off the board** closes a delivery without delivering it ("Customer will collect from the
outlet", "Couldn't reach the customer", "Already delivered (not planned here)", "Customer asked us to
hold it", or another reason). The order stays Ready in Ops; it comes back to the board only if the
order changes in Ops afterwards (`docs/technical/sql/website_dispatch_deliveries.sql`; test:
`docs/technical/sql/tests/website_dispatch_deliveries_test.sql`, staging only).

## Overlaps

The board finds them and offers one tap:

- **Duplicate:** the same phone sent more than one pickup request. *Merge* keeps the first and closes the others (their Ops tasks too). The kept task notes the merge.
- **Same place:** a pickup and a delivery (or two stops) for the same phone or the same address, not on one trip yet. *Combine* gives the second stop the first one's person and slot and marks them as one trip. *Take out of trip* undoes it.
- **Overbooked:** one person has more than 8 stops in one slot (a combined trip counts once). The board links to that day so stops can be moved.

## Data

`docs/technical/sql/website_dispatch.sql`: table `website_dispatch_jobs` and the functions `website_dispatch_sync / plan / close / merge / combine / split`. Service role only. Each function updates the job and the Velto Ops task in one transaction. Orders are only read. Test: `docs/technical/sql/tests/website_dispatch_test.sql` (staging only; rolls back).

The rules (slots, capacity, overlaps, suggested slot) are pure functions in `src/lib/admin/dispatch-logic.ts`, unit-tested in `tests/dispatch.test.cjs`.

Status: applied and tested on **staging**; applied on **production** 2026-09-27 (owner-approved). The test script stays staging-only.

## In the customer account

`portal_dispatch_plans()` (docs/technical/sql/website_dispatch_portal.sql) gives a linked customer their own planned stops: deliveries by their orders' numbers, pickups by their verified phone. The account home shows a "Today / Tomorrow, Evening 4–8 PM · with Rakib" banner and the delivery window on the active order card. Nothing shows until a manager has planned the stop.

## Later: the Velto Ops engine

The planned Ops engine (velto-ops-engine, design stage) replaces the legacy `tasks` list with `ops_tasks`, route templates and rider capacity. When it goes live, `website_dispatch_plan` should place jobs on its routes instead of writing `tasks`; the board and the overlap rules stay the same.
