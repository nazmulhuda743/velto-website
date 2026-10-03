# Account-first booking and the account offer

**Status:** BUILT and TESTED on staging (`ekgdefcdqcsqvpbqponv`). The SQL is not applied to production.

Owner decisions (2026-10-03): every website booking is made from a Velto account; the mobile is
verified by SMS code *inside* the booking form; the first three website bookings of ৳499 or more
get 10% off; the owner can switch the account requirement off from Command Center.

## How it works

- **"Your details" verifies the mobile.** A guest types their name and number, taps "Text me a code",
  enters the 6-digit code and carries on with the address and pickup window on the same page. That is
  the website's sign-in (Supabase phone OTP, account created on first use), so the pickup shows in the
  customer's account straight away. Signed-in customers never see the step; their number is shown locked
  with "Verified".
  - `src/components/forms/BookingVerify.tsx` (the step; calls the server actions directly, no form of its own)
  - `src/lib/customer/actions.ts`: `verifyBookingCodeAction` (same check as the login page, no redirect)
  - After the code: `router.refresh()` re-renders the page signed in while everything typed stays.
- **The API refuses guests** (`sign_in_required`, 401) and always writes the session's verified phone
  into the booking, whatever the form sent, so the Ops task's `source_ref` and the customer's account
  agree. `src/lib/booking-caller.ts` (pure, tested), `src/app/api/bookings/route.ts`.
  - The form handles `sign_in_required` (the sign-in ended between the code and Book) by reopening the step.
- **The account offer:** 10% off the first three website bookings of ৳499+. `src/lib/account-offer.ts`
  (`accountOfferFor(count)`, `accountOfferNote`, `accountSavingMinor`). The count comes from
  `portal_website_bookings()` (`docs/technical/sql/website_account_offer.sql`): the customer's website
  pickup tasks under their proven phone, cancelled ones left out. A failed count gives no discount.
  - Booking summary: "Booking 2 of 3 from your account: 10% off orders of ৳499 or more" and "You save about ৳120".
  - Account home: "10% off your first 3 bookings from your account · 2 still to use".
  - Ops note: `Account booking 2 of 3: 10% off if the order is ৳499 or more`. A monthly-goal coupon takes its place.
  - Promo & popup template reworded to the same rule.
- **Fallbacks without an account:** "Send on WhatsApp" (shown in the step when the code can't be sent or
  checked) and "Get a call back" under the Book button.

## Rollback switch

Command Center → Settings → Booking → **"Website bookings need a Velto account"** (on by default).
Off: the step disappears, guests book as before, and the API accepts bookings without a session.
Use it during an SMS outage; no deploy needed. `SiteSettings.bookingRequiresAccount`.

## Measurement

Events (`src/lib/analytics/events.ts`): `booking_verify_shown`, `booking_code_sent`,
`booking_code_verified`, `booking_verify_failed` (reason: invalid, send, verify, code, unavailable).
Two weeks after launch compare `booking_start → booking_success` with the weeks before; if verified
bookings fall below the old guest rate, switch the requirement off and look at the failure reasons.

## Limits and costs

- One SMS per sign-in, not per booking (the session cookie lasts 30 days). Limits: 5 codes per phone per
  hour, 10 per IP, 300 site-wide (`website_otp.sql`, `/api/auth/sms-hook`). Too many → the step shows
  the WhatsApp and call-back fallbacks.
- The iPhone home-screen app keeps its own cookies: the first booking inside it asks for the code once more.

## Production steps (after approval)

1. Apply `docs/technical/sql/website_account_offer.sql` (after `website_customer_pickups.sql`, already on
   production). Run `tests/website_account_offer_test.sql` (rolls back; expected error
   `ALL_ACCOUNT_OFFER_TESTS_PASSED (rolled back)`).
2. The website change is safe before step 1: without the function the count is unknown, so no 10% is
   promised or noted until it is applied.
3. Tell the Ops team: the note "Account booking n of 3" means apply 10% at confirmation when the order is ৳499+.

## Tests

`tests/booking-caller.test.cjs`, `tests/account-offer.test.cjs`, `scripts/launch-smoke.mjs` (guest POST →
401), `scripts/customer-portal-tests.mjs` (gate runs before validation), `tests/analytics.type-test.ts`.
