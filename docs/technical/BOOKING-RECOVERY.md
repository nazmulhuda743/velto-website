# Abandoned booking recovery (phase 5)

Owner decision (2026-09-29): a draft in the visitor's own browser plus "Call me back". **No silent capture:**
nothing typed into an unsent form reaches Velto unless the visitor presses a button that says it will.

## 1. The draft (browser only)

- `src/lib/booking-recovery.ts` (pure, unit-tested) and `src/components/forms/BookingForm.tsx`.
- While a visitor fills in `/book`, the form keeps what they typed in `localStorage` (`velto.booking.draft.v1`).
  It holds what they typed, the services, item lines, sector, address, name, phone, notes and back-by date.
  It never holds photos or the pickup window (the window may be gone when they return). It is saved only
  after they have typed something themselves.
- If they come back within 7 days, the form opens with **Continue your booking?** (Continue / Start over).
  It isn't offered over a "Book the same again" order. Typing anything without choosing dismisses it.
- The draft is removed when the booking is sent or on Start over. If storage is blocked (private mode),
  the form works exactly as before.
- It is listed on `/cookies` as essential browser storage.

## 2. Get a call back

- A link under the Book button, **Stuck? Get a call back instead**, opens a small panel: name and mobile
  (prefilled from the form), with a line saying what will be sent. Nothing is sent until **Call me back**.
- It sends the name and phone, plus what the form already holds, in English: what to pick up and items,
  services, area, and the chosen day and window. It also sends the same allowlisted attribution as a
  booking (UTM, landing page, referrer host, device).
- `POST /api/callback` → `website_callback_create` (`docs/technical/sql/website_callbacks.sql`, service role).
  It uses the same `VELTO_OPS_WRITES_ENABLED` switch as bookings. A retried tap, or a phone with an open
  request, gets the same request back. At most 3 requests per phone a day.
- The managers get a phone alert: "📞 Call-back request · name · area … Call within 30 min." (at night, 9 PM to 9 AM Dhaka: "call in the morning (from 9 AM)", and the visitor is told Velto will call in the morning; see DISPATCH.md, Night requests)
- **Command Center → Bookings & quotes → Call-back requests** shows how long each one has waited, what they
  wanted, where they came from, and whether the phone has ordered before. It has Call and WhatsApp
  (বাংলা / English, prepared) buttons, and a close with what happened: booked, will book themselves,
  not interested, no answer, wrong number, spam. Every close is recorded in Activity.

## Measuring it

Events (consent-gated like all analytics): `booking_draft_restore`, `callback_open`, `callback_request`.
Tests: `tests/booking-recovery.test.cjs`, `docs/technical/sql/tests/website_callbacks_test.sql` (staging, rolls back).
