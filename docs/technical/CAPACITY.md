# Pickup & delivery capacity (Velto Scheduling Engine, phase 1)

**Status:** BUILT and TESTED on staging (`ekgdefcdqcsqvpbqponv`). Not applied to production.

One capacity system shared by the website, the Command Center and Velto Ops. The rule:
**if the website shows a window as available, a place is already held for it.**

## How it works

- **Windows** (`capacity_windows`): Morning 9 AM–12 PM, Afternoon 12–4 PM, Evening 4–8 PM,
  Night 8–10 PM (off by default). No exact times are promised.
- **Zones** (`capacity_zones`): sectors that share riders. Proposed: Sectors 1–8, 9–12, 13–18,
  and “Other / no sector” (Ops orders whose address has no sector).
- **Capacity** (`capacity_defaults`, per kind × zone × window): proposed 6 / 6 / 7 (night 0).
  A day can have its own number or be blocked with a note (`capacity_slots`).
- **Reservations** (`capacity_reservations`): every booked pickup or planned delivery holds a
  place (1 point each for now). Held → done when the stop is finished, released when cancelled
  or moved.
- **Atomic booking:** `capacity_reserve` locks the slot row (`FOR UPDATE`) before counting, and
  `website_book_pickup` reserves and creates the Ops task in one transaction. Two customers
  racing for the last place: one gets it, the other gets `slot_full` and the website says
  “Sorry, that window was just booked. Please choose another time.” Nothing is created for the
  refused booking.
- **Cutoff:** a window stops selling 120 minutes before it ends; customers see 7 days ahead.

## Who uses it

| Where | What |
| --- | --- |
| Website `/book` | Quick form: What → Your details (name, phone, sector, address) → Pickup window (live, “2 left”, full windows can't be chosen) → Book → “Pickup confirmed · Tomorrow, Evening 4–8 PM”. |
| Command Center → Capacity | Day strip, per window bars and per-zone rows, who is booked, change a day's number, block with a note. Book a WhatsApp/phone customer through the same windows. Settings (Owner/Manager): website switch, days ahead, cutoff, window hours, zones, usual capacity. |
| Command Center → Pickup & delivery | Planning a stop reserves its window. A full window is refused unless an Owner/Manager books over capacity with a reason (recorded on the reservation and in Activity). |
| Velto Ops | Website bookings arrive as tasks due at the window end, labelled “Wed 30 Sep, Evening 4–8 PM (window booked)”. |

Roles: Owner and Manager change capacity and may override; Customer support sees the board and
books within capacity. Website bookings can never override.

## Rollout switch

`capacity_config.enabled` starts **off**. Off: the website shows the windows as a preference
and Velto confirms by phone (as today). Staff bookings and dispatch planning use capacity either
way. Turn it on in Capacity → Settings once zones and numbers are confirmed.

## Files

- SQL: `docs/technical/sql/website_capacity.sql`; test `docs/technical/sql/tests/website_capacity_test.sql`
  (rolls back; expected error `ALL_CAPACITY_TESTS_PASSED (rolled back)`).
- Server: `src/lib/capacity.ts`, pure logic `src/lib/capacity-logic.ts` (tests `tests/capacity.test.cjs`).
- Website: `src/app/api/capacity/route.ts`, `src/components/forms/PickupWindows.tsx`, `BookingForm.tsx`,
  `src/app/api/bookings/route.ts`.
- Command Center: `src/app/admin/(panel)/capacity/page.tsx`, `src/app/admin/capacity-actions.ts`,
  `src/app/admin/capacity/availability/route.ts`, `src/components/admin/StaffPickupFields.tsx`.

## Production steps (after approval)

1. Apply `website_capacity.sql` to production; run the test file (it rolls back).
2. Confirm zones and numbers in Capacity → Settings.
3. Turn on “Customers book a window on the website”.

## Later phases

Delivery slots offered when an order is Ready, rider screen, failed attempts, weighted points
(bulky items), routing and forecasting.
