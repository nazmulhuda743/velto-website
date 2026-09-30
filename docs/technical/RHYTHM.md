# Velto Rhythm: reminders that fit each customer

Plan and designs (approved 30 Sep 2026): https://claude.ai/artifact/EZUgeTk4Pavfvod9ymnhko

Step 1 is built: groups, the one-tap link, SMS for “Regular, due now”, and staff call tasks for
slipping regulars. Notifications (step 2), the first-timer journey and seasonal messages (step 3)
and WhatsApp Business messages (step 4) come later.

## How it works

1. **Groups.** `website_rhythm_refresh()` rebuilds `website_rhythm` from Velto Ops orders: one row
   per customer with their group, usual gap (median days between orders), usual service (most
   frequent in the last 5 orders), open order (Picked/Ready, or an open website pickup) and a fixed
   10% hold-out flag. It takes well under a second.
2. **Runs.** pg_cron calls `POST /api/rhythm/run` with the key from `website_rhythm_keys`
   (`website_rhythm_schedule.sql`):
   - **18:25 Dhaka, evening:** SMS to “Regular, due now” customers, if switched on.
   - **10:30 Dhaka, morning:** one Ops `call` task per slipping regular (due 6 pm, source
     `website_rhythm`), if switched on.
3. **Who qualifies** is decided in the database (`website_rhythm_candidates`):
   - at most one reminder per 7 days and three per 30 days;
   - none while an order is open, none within 3 days of an order;
   - none to opted-out numbers;
   - one per playbook per order cycle;
   - highest lifetime spend first, up to the playbook's limit.

   Hold-out customers are recorded but never contacted. SMS only go out between 10:00 and 20:00
   Dhaka, whatever calls the run.
4. **The link.** `/r/<8-character code>` (Bangla: `/bn/r/…`) shows the first name, usual service,
   usual gap and days since the last order. It never shows the address or phone.
   - Day and window: live capacity when the Ops address names a sector, otherwise preference
     windows.
   - **Yes, pick up** posts only the code and window to `/api/rhythm/book`. The server takes the
     name, phone and address from Ops and books through the same path as the booking form
     (`lib/booking-handler.ts`).
   - A code books once and expires after 7 days.
   - **Reply on WhatsApp** opens the chat with the message written.
   - **Stop these reminders** adds the number to `website_rhythm_optouts` for good.
   - `/r/preview0` shows example details with booking off.
5. **Admin → Reminders** (`/admin/retention/reminders`):
   - group counts, today's queue per playbook, the message text (Bangla and English) with an
     SMS-length check, the limits, and the last 30 days' results against the hold-out;
   - only an Owner or Manager can switch a playbook on;
   - settings are saved in `website_content.rhythm`.

## Measuring

“Ordered within 7 days” counts any Ops order or website pickup in the 7 days after the reminder,
for contacted customers and for the hold-out group alike. The difference is what the reminders
added.

## Production activation

1. Apply `docs/technical/sql/website_rhythm.sql`, then `website_rhythm_schedule.sql` (production
   only: it calls www.velto.com.bd).
2. Everything starts switched off. In Admin → Reminders, read the queue and the message, then
   switch on.
3. SMS use the GreenWeb account already configured for sign-in codes
   (`VELTO_SMS_PROVIDER=greenweb`, `GREENWEB_SMS_TOKEN`).

## Files

- SQL: `docs/technical/sql/website_rhythm.sql`, `website_rhythm_schedule.sql`,
  `tests/website_rhythm_test.sql` (staging, rolled back)
- Logic: `src/lib/rhythm.ts` (pure, `tests/command-center/rhythm.test.cjs`), `src/lib/rhythm-server.ts`
- Routes: `src/app/api/rhythm/{run,book,stop}`, `src/app/[lang]/(site)/r/[code]`
- Admin: `src/app/admin/(panel)/retention/reminders`, `src/app/admin/rhythm-actions.ts`,
  `src/lib/admin/rhythm.ts`
