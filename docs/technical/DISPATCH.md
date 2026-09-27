# Pickup & delivery (Command Center → Operations)

`/admin/dispatch`, for Owners, Managers and Customer support.

## The flow

| Step | Pickups (website bookings and quotes) | Deliveries (orders Ready in Velto Ops) |
|---|---|---|
| 1. Comes in | A website request appears under **Needs a plan**, oldest first | An order at Ready (or Out for Delivery) appears under **Needs a plan** |
| 2. Plan | Call the customer, then give it a **person** and a **slot** (day + Morning / Afternoon / Evening). The customer's own choice is pre-filled | Give it a person and a slot |
| 3. In Velto Ops | The website's task is assigned to that person (it shows under "Assigned to me") and is due at the end of the slot, so the Ops 5-minute reminder fires. They also get a push if their phone is subscribed | One `delivery` task per order is created for that person (`source = website_dispatch`), due at the end of the slot |
| 4. Finish | **Picked up** (or done in Ops) closes it; **Cancel** needs a reason, which is written on the Ops task | Closes itself when the order is Delivered (or Cancelled) in Ops |

Changing a plan updates the same Ops task; nothing is created twice. Every change is in **Activity**.

## Overlaps

The board finds them and offers one tap:

- **Duplicate:** the same phone sent more than one pickup request. *Merge* keeps the first and closes the others (their Ops tasks too). The kept task notes the merge.
- **Same place:** a pickup and a delivery (or two stops) for the same phone or the same address, not on one trip yet. *Combine* gives the second stop the first one's person and slot and marks them as one trip. *Take out of trip* undoes it.
- **Overbooked:** one person has more than 8 stops in one slot (a combined trip counts once). The board links to that day so stops can be moved.

## Data

`docs/technical/sql/website_dispatch.sql`: table `website_dispatch_jobs` and the functions `website_dispatch_sync / plan / close / merge / combine / split`. Service role only. Each function updates the job and the Velto Ops task in one transaction. Orders are only read. Test: `docs/technical/sql/tests/website_dispatch_test.sql` (staging only; rolls back).

The rules (slots, capacity, overlaps, suggested slot) are pure functions in `src/lib/admin/dispatch-logic.ts`, unit-tested in `tests/dispatch.test.cjs`.

Status: applied and tested on **staging**; applied on **production** 2026-09-27 (owner-approved). The test script stays staging-only.

## Later: the Velto Ops engine

The planned Ops engine (velto-ops-engine, design stage) replaces the legacy `tasks` list with `ops_tasks`, route templates and rider capacity. When it goes live, `website_dispatch_plan` should place jobs on its routes instead of writing `tasks`; the board and the overlap rules stay the same.
