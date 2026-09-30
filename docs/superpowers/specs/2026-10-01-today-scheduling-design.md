# Today: one screen for pickup & delivery scheduling (design)

Status: **DESIGNED**, awaiting owner review of this written spec.
Date: 2026-10-01. Owner decisions were taken in the brainstorming session of 30 Sep – 1 Oct.

## 1. Goal

Managers schedule every pickup and delivery from **one phone-first page in the website admin**,
guided by "what to do next", with the system doing the bookkeeping. Today the same work is
spread over three screens (Bookings & quotes 5.6 phone screens long, Pickup & delivery 2.5,
Capacity 8.5), uses four names for one time period, needs a page to be opened before new data
syncs, and needs the Ops order number typed in by hand.

**Success looks like:** a manager on a phone opens `/admin/today`, sees at the top what needs a
call or a rider, and moves each job forward with one tap per step, without visiting another
screen or typing an order number.

## 2. Decisions (from the owner)

| Question | Decision |
|---|---|
| Who schedules | Managers, on their phones |
| Where scheduling lives | Website admin (Command Center) |
| Where riders work | Velto Ops, unchanged ("Assigned to me", reminders, mark done) |
| Capacity | Per rider: stops per time window |
| Website booking time | A preference; a manager always calls to confirm |
| Approach | A: one "Today" screen (not tidy-up, not a drag-and-drop planner) |
| Language | Today has a বাংলা / English switch; the rest of the admin stays English |
| Sections 1, 2, 4, 5 | "Decide for me": the recommendations below stand |

Out of scope: the Ops "new order" push trigger (`velto_notify_order_push` calls a missing
`send-push` function); changing the Ops app; customer-facing booking; showing only free windows
to customers (the old per-area limits stay off).

## 3. The Today screen (`/admin/today`)

First item under Operations; managers land on it after sign-in. Roles: those with the
`dispatch` section today (owner, manager, customer support).

- **Top bar:** day switcher (Today · Tomorrow · date), search (name, phone, VEL-number),
  বাংলা / English switch (remembered per person in a cookie).
- **Five sections, fixed order, each with a count.** An empty section is one line
  ("Nothing to call ✓").
  1. **📞 To call:** new website bookings, call-back requests (badge "Call-back"), routine
     requests waiting to be confirmed (badge 🔁), and customer time changes (badge "Customer
     changed time"). Oldest first; waiting over 30 min turns red and rises to the top.
  2. **🛵 To assign:** confirmed jobs without a rider (including active routine pickups for the
     day). Rider chips show load in that window ("Bappy 3/8").
  3. **🧺 Ready to deliver:** Ops orders at Ready without a planned delivery. Window select +
     rider chips on the card.
  4. **🗓 On the road:** the day's plan, grouped by window, then by rider.
  5. **✓ Done:** finished stops of the day, collapsed.
- **Card rules:** name, area, asked-for window, badges (first website order · 10% off,
  goal coupon, 🔁, call-back), notes; **one main button** for the next step; Cancel, Merge,
  Change time, Notes and WhatsApp templates under **More**.
- **Layout:** phone first (390px): one column, cards about one thumb-height, touch targets
  ≥ 44px. From 1024px, sections 1–3 sit in columns above "On the road".
- **Refresh:** the page re-fetches every 60 s while visible (existing `NotificationRefresher`
  pattern) and after every action.
- Built with the existing admin primitives (`AdminHeader`, `Badge`, `.admin-btn*`,
  `.admin-card`) and design tokens; no new visual language.

## 4. Steps, names and buttons

One vocabulary on every screen, in WhatsApp templates and in Ops notes. "Time window" replaces
slot / time of day / window: **Morning 9–12, Afternoon 12–4, Evening 4–8** (Night off unless
switched on).

| Shown as | Stored as (`website_dispatch_jobs`) | Main button | Moved by |
|---|---|---|---|
| To call | pickup `new` | Confirmed for [window ▾] | Manager |
| To assign | pickup `confirmed`, or `assigned` without a person | Rider chip | Manager |
| Assigned | pickup `scheduled` | Picked up | Rider in Ops, or manager |
| Picked up | pickup `picked`, no order linked | none (auto-links) | System |
| In process | pickup `picked` + linked order not Ready | none | Ops |
| Ready to deliver | delivery `new` / `confirmed` / `assigned` | Window + rider chip | Manager |
| Out for delivery | delivery `scheduled` | Delivered | Rider in Ops, or manager |
| Delivered | delivery `done` | none | Ops / system |

- **No answer:** counts attempts ("No answer ×2"); after 3 it offers Cancel with a WhatsApp
  message; it never cancels by itself.
- **Customer changes time** (account): back to To call with a badge; **the rider is kept when
  still free in the new window** (today the plan is always wiped).
- **One word per action:** "Cancel booking"; "Picked up" → toast "Marked as picked up";
  "Delivered" → "Marked as delivered".
- **Routines:** active weekly pickups start at To assign (the customer already agreed).
- Quotes (household) stay out of Today: they are calls about a price, not stops.

## 5. Rider capacity

- **New table `website_riders`** (service role only): `profile_id` (Ops profile), `can_ride`
  (bool), `stops_per_window` (int, default 8), `updated_at`, `updated_by`.
  Riders = Ops profiles with role `rider` plus anyone ticked "Can do pickups & deliveries".
- **New table `website_rider_days_off`**: `profile_id`, `day` (date). "Off today / Off tomorrow"
  switch removes the rider from that day's chips.
- **Load** = stops assigned to the rider in that window; pickup + delivery at the same phone
  and address in the same window count as **one** stop (today's "Combine into one trip" becomes
  automatic).
- **Full:** chip shows 8/8 greyed; assigning anyway needs one confirm tap ("Bappy is full in the
  morning. Assign anyway?"); never a hard block.
- The per-area limits (`capacity_*`, 6/6/7) stay switched off and their page leaves the menu.
  `DEFAULT_CAPACITY = 8` in `dispatch-logic.ts` becomes the per-rider default.

## 6. Automation

1. **Sync every 5 minutes** with pg_cron calling `website_dispatch_sync()` (and the existing
   Ready-order delivery sync, including older Ready orders). Opening Today also syncs. The
   separate `capacity_sync_jobs()` step is no longer needed for confirmation.
2. **Auto-link the Ops order:** for a picked pickup with no order, an Ops order created for the
   **same phone** within 2 days after pickup links automatically (→ In process). Two or more
   candidates: the card asks "Which order? [VEL-…] [VEL-…]" (one tap). Pure matching logic in a
   tested module; the link itself through the existing link RPC.
3. **Assigning** keeps today's behaviour: sets the Ops task's assignee and due time (window end),
   so the rider sees it in "Assigned to me" with Ops' reminder. Delivery plans create the Ops
   delivery task as today.
4. **Rider ticks in Ops** (task done) move the job to Picked up / Delivered on the next sync, as
   today.
5. **Failures:** if Ops is unreachable, a yellow bar: "Can't reach Velto Ops right now. Showing
   the list from 10:42. Retry". A failed button leaves the card unchanged and says what failed.
   All actions are idempotent (safe to press twice).

## 7. Bugs fixed on the way

- Pickup & delivery reads only `new, assigned, scheduled` (`dispatch.ts:118`), so `confirmed`
  jobs older than 3 days drop off; Today reads every open stage.
- Website window bookings become "confirmed" only when Capacity is opened; with the cron sync
  and "always call" there is one rule: every booking starts at To call.
- Night window missing from `SLOTS` while Capacity has it: one window list shared by all screens.
- Change deadlines in `CUSTOMER-PORTAL.md` (09:00/14:00/18:00) use the old window ends; align
  them with 12/16/20.
- `COMMAND-CENTER.md:10-11` says the admin never changes Ops tasks; correct it.

## 8. What happens to the old screens

- **Bookings & quotes → "All requests":** history and search, each request with its timeline;
  actions link to the card on Today. The breakdown charts (service, area, source, landing page,
  device) move to Insights → Funnel.
- **Pickup & delivery:** permanent redirect to `/admin/today`.
- **Capacity:** leaves the menu. Windows, rider stops and days off move to **Settings → Riders
  & windows** (owner and manager).
- **Menu:** Operations goes from 9 items to about 6, Today first.

## 9. Bangla / English

Today's copy lives in `src/content/i18n/admin-today/{en,bn}.ts` like the site's other
dictionaries; names, phone numbers, areas and VEL numbers are shown as entered. Bangla copy is
reviewed with the repo's `i18n:review` script before release.

## 10. Rollout

- **Week 1:** Today ships alongside the old screens; old screens show "Try the new Today
  screen". A dismissible "How Today works" card for the first days.
- **Week 2:** after the owner confirms, Pickup & delivery redirects and Capacity leaves the menu;
  Bookings & quotes becomes All requests.
- SQL changes are idempotent, applied to staging with a rollback test, then to production by a
  human, as in the other `docs/technical/sql/*.sql` files; Today degrades to "not set up yet"
  when a table is missing.

## 11. Testing

- **Unit (foundation tests):** section for each job state; the main button for each state; rider
  load, one-stop merging and "full"; auto-link matching (none, one, two candidates, outside the
  2-day window, different phone); window list and labels in both languages.
- **SQL:** staging rollback test for `website_riders`, days off, cron sync and auto-link.
- **Visual:** admin preview data at 390px and 1440px, English and Bangla, every section empty and
  full; keyboard focus visible.
- Existing suites (security, typecheck, lint, foundation, Command Center, i18n, build) stay
  green.

## 12. Open items for the plan

- Where exactly pg_cron is enabled (production already runs Ops' cron jobs; confirm the website
  sync can join them).
- Whether customer support should also see Settings → Riders & windows (default: no).
