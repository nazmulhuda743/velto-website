# Today (pickup & delivery scheduling) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One phone-first admin page, `/admin/today`, where managers call, assign, plan deliveries
and follow the day's route, replacing the scheduling parts of Bookings & quotes, Pickup & delivery
and Capacity.

**Architecture:** Pure decision logic (which tab a job is in, rider load, the day strip) lives in
tested `src/lib/admin/today-logic.ts`; a server loader `src/lib/admin/today.ts` reads jobs, riders
and Ops context; the page is server-rendered with tabs as URL state and two small client pieces
(rider sheet, refresher). Existing dispatch RPCs (`website_dispatch_contact/plan/pick/close/
link_order`) do every write; new SQL adds rider settings, days off, auto-link and a 5-minute cron.

**Tech Stack:** Next.js 16 app router (server components + server actions), TypeScript,
Tailwind 4 with the repo tokens, Supabase (service role, REST + RPC, pg_cron), node:test.

**Spec:** `docs/superpowers/specs/2026-10-01-today-scheduling-design.md` (approved 1 Oct with
mockup v2). Read it with this plan.

## Global Constraints

- Time windows: **Morning 9–12, Afternoon 12–4, Evening 4–8** (`SLOTS` in
  `src/lib/admin/dispatch-logic.ts`); Dhaka time everywhere (`dhakaToday()`).
- Rider capacity default **8** stops per window (`DEFAULT_CAPACITY`); full = load ≥ capacity;
  assigning a full rider needs one confirm, never a hard block.
- "Late" = waiting **over 30 minutes** since the request (`callTimer` tone `late`).
- One vocabulary: To call · To assign · Assigned · Picked up · In process · Ready to deliver ·
  Out for delivery · Delivered; "Time window"; "Cancel booking"; toasts "Marked as picked up" /
  "Marked as delivered".
- Copy in `src/content/i18n/admin-today/{en,bn}.ts`; names, phones, areas, VEL numbers as entered.
- Roles: sections `dispatch` (owner, manager, customer support) see Today; rider settings need
  `canEditCapacity(role)` (owner, manager).
- Quotes (`source = 'website_quote'`) never appear on Today.
- No new dependencies. Admin primitives (`AdminHeader`, `Badge`, `.admin-btn*`) and tokens only;
  add `--color-warning` / `--color-warning-soft` instead of hard-coded ambers.
- SQL: idempotent, service role only (`revoke … from public, anon, authenticated`), staging
  rollback test before a human applies it to production.
- Old screens stay until the owner confirms (spec §10): nothing is removed in Tasks 1–7.

## Review Focus

1. **A job whose rider is off or deleted** (profile inactive, or `website_rider_days_off` for
   that date): it must still show on Route under its rider's name, and the sheet must not offer
   that rider. Test in Task 1 (`riderChoices` with an off rider who has load).
2. **Combined trips** (pickup + delivery sharing `trip_key`) count as one stop in load, strip
   and "3/8". Test in Task 1 (`riderLoad` with a shared `trip_key`).
3. **Midnight / date edges:** a job planned for tomorrow is not in today's Route; `nowWindow` is
   null before 9:00 and after 20:00 Dhaka. Tests in Task 1.
4. **Two Ops orders for one phone after pickup:** auto-link must not guess; the card asks
   "Which order?". SQL test in Task 3; UI in Task 5.
5. **Ops unreachable:** the page shows the yellow "Can't reach Velto Ops right now…" bar with the
   time of the last good load, and buttons fail without changing the card. Test in Task 4
   (loader returns `state: "error"`), checked visually in Task 5.

---

### Task 1: Today decision logic

**Files:**
- Create: `src/lib/admin/today-logic.ts`
- Test: `tests/today-logic.test.cjs`
- Modify: `tests/foundation-modules.txt` (add `src/lib/admin/today-logic.ts`)

**Interfaces:**
- Consumes: `DispatchJob`, `SlotId`, `SLOTS`, `DEFAULT_CAPACITY`, `stopCount` from
  `dispatch-logic.ts`; `callTimer` from `request-flow.ts`.
- Produces:
  - `type TodayTab = "call" | "assign" | "deliver" | "route"`
  - `type Rider = { id: string; name: string; stopsPerWindow: number; off: boolean }`
  - `type RiderChoice = Rider & { load: number; full: boolean; best: boolean }`
  - `tabFor(job: DispatchJob): TodayTab | "done" | null`
  - `callQueue(jobs: DispatchJob[], now?: number): DispatchJob[]` (late first, then oldest)
  - `riderLoad(jobs: DispatchJob[], riderId: string, date: string, slot: SlotId): number`
  - `riderChoices(riders: Rider[], jobs: DispatchJob[], date: string, slot: SlotId): RiderChoice[]`
  - `dayStrip(riders: Rider[], jobs: DispatchJob[], date: string): { slot: SlotId; planned: number; capacity: number }[]`
  - `nowWindow(now?: Date): SlotId | null`
  - `changedTime(job: DispatchJob): boolean` (last `history` entry has action
    `"customer changed time"`; drives the "Changed time" badge)

- [ ] **Step 1: Write the failing tests** (`tests/today-logic.test.cjs`, fixture helper `job(over)`
  building a full `DispatchJob`):
  - `tabFor`: pickup `new` → `"call"`; pickup `confirmed` → `"assign"`; pickup `assigned` with
    `assignee_id` but no `slot_date` → `"assign"`; pickup `scheduled` → `"route"`; pickup
    `picked` → `"done"`; delivery `new` → `"deliver"`; delivery `scheduled` → `"route"`; delivery
    `done` → `"done"`; `cancelled`/`merged` → `null`; `source: "website_quote"` → `null`.
  - `callQueue`: jobs created 45, 12 and 5 minutes ago come back 45, 12, 5.
  - `riderLoad`: two scheduled jobs for rider `b` on `2026-10-02` morning with the same
    `trip_key` plus one more → `2`; a job for `2026-10-03` is not counted.
  - `riderChoices` for evening with riders Bappy (1 stop), Monir (0), Rakib (8 of 8), Oli (off,
    with 2 stops) → order `["Monir","Bappy","Rakib","Oli"]`; `best` only on Monir; Rakib
    `full: true`; Oli `off: true, best: false`.
  - `dayStrip` with three riders at 8 and Oli off → capacity `24` for each window; planned
    matches `riderLoad` sums.
  - `changedTime`: history ending in `{ action: "customer changed time" }` → `true`; a later
    `"confirmed"` entry → `false`.
  - `nowWindow`: 03:00 UTC (09:00 Dhaka) → `"morning"`; 06:00 UTC → `"afternoon"`; 10:00 UTC →
    `"evening"`; 14:30 UTC (20:30 Dhaka) → `null`; 02:59 UTC → `null`.

- [ ] **Step 2: Run** `npm run test:foundation` → FAIL (guard: "requires admin/today-logic.js";
  after listing the module: `tabFor is not a function`).

- [ ] **Step 3: Implement** the signatures above in `src/lib/admin/today-logic.ts`. `riderLoad`
  filters `stage === "scheduled"` jobs for the rider/date/slot and returns `stopCount(...)`.
  `riderChoices` sort key: off last, then full after not-full, then load ascending, then name.
  `nowWindow` uses Dhaka hour (UTC+6) against 9–12 / 12–16 / 16–20.

- [ ] **Step 4: Run** `npm run test:foundation` → PASS.

- [ ] **Step 5: Commit** `feat(today): decision logic for tabs, rider load and the day strip`.

### Task 2: Today copy, English and Bangla

**Files:**
- Create: `src/content/i18n/admin-today/en.ts`, `src/content/i18n/admin-today/bn.ts`,
  `src/content/i18n/admin-today/index.ts`
- Test: `tests/i18n/i18n.test.mjs` (add a case)

**Interfaces:**
- Produces: `type TodayText` (from `en`), `todayText(lang: "en" | "bn"): TodayText`,
  `TODAY_LANG_COOKIE = "velto_admin_lang"`.
- Keys (exact English from mockup v2): `title "Today"`, tabs `Call / Assign / Deliver / Route`,
  `nextUp "Next up"`, `then "Then"`, `lateNote(n) "${n} customer(s) waiting over 30 min"`,
  `confirmFor(window) "Confirmed for ${window}"`, `noAnswer "No answer"`, `chooseRider "Choose
  rider"`, `planDelivery "Plan delivery"`, `readySince(t) "Ready since ${t}"`, `mostFree "Most
  free"`, `full "Full"`, `offToday "Off today"`, `free "Free"`, `allDone "All done here"`,
  `allDoneSub "Nothing left in this list."`, `opsDown(t) "Can't reach Velto Ops right now.
  Showing the list from ${t}."`, `retry "Retry"`, `firstOrder "First website order · 10% off"`,
  `callback "Call-back"`, `weekly "Weekly"`, `changedTime "Changed time"`, `pickedUp "Picked
  up"`, `delivered "Delivered"`, `markedPicked "Marked as picked up"`, `markedDelivered "Marked as
  delivered"`, `cancelBooking "Cancel booking"`, `whichOrder "Which order?"`, `stopsOf(a,b)
  "${a}/${b} stops"`, `help "Work top to bottom: call new customers, give each job a rider, plan
  deliveries for Ready orders. Riders see their jobs in Velto Ops."`. Bangla as in the mockup.

- [ ] **Step 1: Write the failing test:** `en` and `bn` have exactly the same keys, and every
  function value returns a non-empty string for sample arguments.
- [ ] **Step 2: Run** `npm run test:i18n` → FAIL (module not found).
- [ ] **Step 3: Implement** the three files; `bn` digits via `toBanglaDigits`.
- [ ] **Step 4: Run** `npm run test:i18n` and `npm run i18n:review` → PASS / no new warnings.
- [ ] **Step 5: Commit** `feat(today): English and Bangla copy`.

### Task 3: Database: riders, days off, auto-link, 5-minute sync

**Files:**
- Create: `docs/technical/sql/website_today.sql`
- Create: `docs/technical/sql/tests/website_today_test.sql` (pattern of
  `website_dispatch_stages_test.sql`: `begin; … rollback;` with `assert`s)
- Modify: `docs/technical/sql/website_customer_pickups.sql` (`portal_pickup_change`)
- Modify: `docs/technical/DISPATCH.md` (a "Today" section: tables, cron, auto-link)

**Interfaces:**
- Produces (service role only):
  - `public.website_riders(profile_id uuid primary key, can_ride boolean not null default true,
    stops_per_window int not null default 8 check (stops_per_window between 1 and 30),
    updated_at timestamptz not null default now(), updated_by text)`
  - `public.website_rider_days_off(profile_id uuid, day date, primary key (profile_id, day))`
  - `public.website_dispatch_autolink() returns int`: for pickup jobs with `stage = 'picked'`
    and `order_number is null`, the Ops orders whose phone key equals the job's `phone_key`
    and whose `created_at` is between `picked_at - interval '1 day'` and `picked_at + interval
    '2 days'`, not linked to another job; exactly one → `perform
    public.website_dispatch_link_order(job, order_number, 'Auto-link')`; returns links made.
  - `cron.schedule('website-dispatch-sync', '*/5 * * * *', $$select
    public.website_dispatch_sync(); select public.website_dispatch_autolink();$$)`
  - `website_dispatch_sync()` also creates pickup jobs for Ops tasks with `source = 'weekly'`
    and `type = 'pickup'` due today or later (stage `confirmed`, so they start at To assign;
    spec §4 "Routines"), idempotent on `task_id`.
  - `portal_pickup_change`: keep `assignee_id/assignee_name` when that rider's scheduled stops
    in the new date+slot are below their `stops_per_window` (default 8); stage `new` either way
    (the manager re-confirms), history line "Customer changed time".

- [ ] **Step 1: Write the failing SQL test** asserting: one candidate order → linked and
  `autolink()` returns 1; two candidates → not linked, returns 0; an order 3 days after pickup →
  not linked; a `weekly` pickup task becomes one `confirmed` job and a second sync does not
  duplicate it; `anon` cannot `select` from `website_riders`; `portal_pickup_change` keeps a rider
  with room and clears one who is full.
- [ ] **Step 2: Run** it on staging (Supabase SQL editor or `mcp execute_sql` inside the test's
  transaction) → FAIL (relation does not exist).
- [ ] **Step 3: Implement** `website_today.sql` and the `portal_pickup_change` change.
- [ ] **Step 4: Apply to staging, run the test** → all asserts pass, transaction rolled back.
- [ ] **Step 5: Commit** `feat(today): rider settings, auto-link and 5-minute sync (SQL)`.
  Production is applied by a human after review (spec §10).

### Task 4: Server loader and actions

**Files:**
- Create: `src/lib/admin/today.ts`
- Create: `src/app/admin/today-actions.ts`
- Modify: `src/lib/admin/dispatch.ts:118` (open stages include `confirmed`; spec §7 bug)
- Modify: `src/lib/admin/dispatch.ts` preview data (two riders' days off, one job with two
  candidate orders)
- Test: `tests/today-loader.test.cjs` (stubbed fetch, pattern of `tests/ops-gateway.test.cjs`)

**Interfaces:**
- Consumes: Task 1 types; `getStaff()`, `getRequestJobs()`, `getRequestContext()`,
  `planJob`, `contactJob`, `pickJob`, `closeJob`, `linkOrder` from `dispatch.ts`.
- Produces:
  - `getRiders(date: string, fetcher?): Promise<Rider[]>`: `website_riders` rows with
    `can_ride`, days off for `date`; **no rows → every `getStaff()` person at 8, none off**.
  - `getToday(date: string): Promise<Loaded<{ jobs: DispatchJob[]; riders: Rider[];
    context: RequestContext; callbacks: CallbackRow[]; routines: RoutineRow[]; loadedAt: string }>>`
    (open call-backs and routine requests to confirm, from the existing `getCallbacks()` /
    `getRoutines()`, go in the Call tab with the Call-back / Weekly badge).
  - Server actions (each `requireSection("dispatch")`, logs activity like `planAction`, redirects
    to `/admin/today?tab=…&done=…`): `confirmAction(form)` (job, date, slot → `contactJob(…,
    "confirmed", …)`), `noAnswerAction(form)`, `assignAction(form)` (job, rider, date, slot,
    `force=1` required when the rider is full → `planJob`), `markDoneAction(form)` (pickup →
    `pickJob`, delivery → `closeJob(…,"done",…)`), `pickOrderAction(form)` (→ `linkOrder`),
    `riderSettingsAction(form)` and `dayOffAction(form)` (need `canEditCapacity`).

- [ ] **Step 1: Write the failing tests:** `getRiders` with no rows returns staff at 8; with rows
  returns only `can_ride` people with their numbers and `off: true` for a day-off row; a 500 from
  Supabase returns the staff fallback, not an empty list.
- [ ] **Step 2: Run** `npm run test:foundation` → FAIL.
- [ ] **Step 3: Implement** `today.ts` and `today-actions.ts`; fix `dispatch.ts:118`.
- [ ] **Step 4: Run** `npm run test:foundation && npm run typecheck && npm run lint` → PASS.
- [ ] **Step 5: Commit** `feat(today): loader, riders and actions`.

### Task 5: The Today page

**Files:**
- Create: `src/app/admin/(panel)/today/page.tsx`
- Create: `src/components/admin/today/DayStrip.tsx`, `TodayTabs.tsx`, `NextUpCard.tsx`,
  `JobRow.tsx`, `RouteList.tsx` (server), `RiderSheet.tsx` (client: open/close, confirm when
  full), `LangSwitch.tsx` (client: sets `velto_admin_lang`)
- Modify: `src/app/globals.css` (`--color-warning`, `--color-warning-soft`)

**Interfaces:**
- Consumes: Tasks 1, 2, 4.
- Produces: route `/admin/today?tab=call|assign|deliver|route&date=YYYY-MM-DD&job=<id>` (`job`
  = the row promoted to Next up).

- [ ] **Step 1: Build the page** to mockup v2 (spec §3): navy header + day strip, bottom tabs
  with counts (Call red when late), Next up + Then rows, rider sheet, Route lanes, empty state,
  yellow Ops-down bar with `loadedAt`, "How Today works" card dismissible (cookie), refresher
  every 60 s.
- [ ] **Step 2: Visual check** with `VELTO_ADMIN_PREVIEW=1`: 390px and 1440px, EN and BN, each
  tab full and empty, sheet open, a full rider, an off rider, the Ops-down bar (preview flag), a
  job with two candidate orders ("Which order?"); keyboard focus visible; no console errors.
  Screenshots attached to the PR.
- [ ] **Step 3: Run** `npm run typecheck && npm run lint && npm run build` → PASS.
- [ ] **Step 4: Commit** `feat(today): the Today page (mockup v2)`.

### Task 6: Riders & windows settings

**Files:**
- Create: `src/app/admin/(panel)/riders/page.tsx`
- Modify: `src/lib/admin/permissions.ts` (section `riders`: owner, manager)

- [ ] **Step 1: Build** a list of staff with "Can do pickups & deliveries" toggle, stops per
  window (1–30), and "Off today / Off tomorrow" toggles, posting to Task 4 actions.
- [ ] **Step 2: Test** (`tests/command-center/access.test.cjs`): `riders` allowed for owner and
  manager, refused for support, marketing, designer.
- [ ] **Step 3: Run** `node scripts/command-center-tests.mjs && npm run typecheck` → PASS;
  visual check at 390px.
- [ ] **Step 4: Commit** `feat(today): riders & windows settings`.

### Task 7: Menu, landing and the week-1 banner

**Files:**
- Modify: `src/components/admin/AdminNav.tsx` (Operations: **Today** first)
- Modify: `src/app/admin/(panel)/page.tsx` or sign-in redirect (dispatch roles land on
  `/admin/today`)
- Modify: `src/app/admin/(panel)/dispatch/page.tsx`, `requests/page.tsx`, `capacity/page.tsx`
  (banner "Try the new Today screen" linking to `/admin/today`)
- Modify: `docs/technical/COMMAND-CENTER.md:10-11` (correct "does not change Ops tasks"),
  `docs/technical/CUSTOMER-PORTAL.md:352` (change deadlines 12/16/20)

- [ ] **Step 1: Test** (`tests/command-center/access.test.cjs`): nav groups list `today` first
  in Operations for manager and support.
- [ ] **Step 2: Implement**; run all suites (`test:security`, `typecheck`, `lint`,
  `test:foundation`, command-center, `test:i18n`, `build`) → PASS.
- [ ] **Step 3: Commit** `feat(today): menu, landing page and try-it banner`. Open the PR with
  screenshots; merge after CI and owner review. **Week 1 starts.**

### Task 8 (week 2, only after the owner says Today works): switch over

**Files:**
- Modify: `src/app/admin/(panel)/dispatch/page.tsx` → `permanentRedirect("/admin/today")`
- Modify: `AdminNav.tsx` (Capacity out of the menu; "Bookings & quotes" renamed "All requests")
- Modify: `requests/page.tsx` (drop the action panels, callbacks and routines panels now on
  Today; keep search, list and timeline)
- Modify: `src/app/admin/(panel)/funnel/page.tsx` (the service/area/source/landing/device
  breakdowns moved from requests)

- [ ] **Step 1: Test:** `/admin/dispatch` responds 308 to `/admin/today`; nav has no `capacity`
  for any role; funnel test covers the breakdown helper it now calls.
- [ ] **Step 2: Implement; run all suites** → PASS; visual check of All requests at 390px.
- [ ] **Step 3: Commit** `feat(today): switch over from the old scheduling screens`; PR, CI,
  merge.
