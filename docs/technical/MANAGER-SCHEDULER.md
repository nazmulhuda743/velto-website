# Manager Operations Scheduler

## Decision (6 October 2026)

Extend Today. Keep dispatch jobs, tasks, customers, orders and capacity authoritative. Add
`ops_appointments` as a scheduling attachment: one per transport job, many internal processing
stages per order. Transport completion/cancellation and assignee changes are projected from
Dispatch by a database trigger, including changes made by old screens and customer self-service.
A changed broad date/window clears the old exact time into Needs scheduling. No duplicate calendar.

- Exact intervals use timestamptz; inputs and day bounds use Asia/Dhaka. Default grid 30 minutes.
- A GiST exclusion constraint on profile + [start,end) prevents overlapping active work across
  all three lanes, including a manager who both rides and processes. Null assignees are allowed.
- Processing uses real profiles and outlets. Its stages are work labels, not order statuses.
  Completing a work stage never changes an order. Delivery completion uses set_order_status.
- New pickup uses a canonical Ops pickup task + dispatch job, nullable customer FK and contact
  snapshot. Normalize with website_dispatch_phone_key; matching customers are linked, never inserted.
- Capacity is reserved by the existing website_dispatch_plan RPC inside the same transaction.
  Any later error raises inside a subtransaction so task, reservation, plan and audit all roll back.
- Immutable promised day/window is saved separately from the internal plan. An owner/manager may
  override that promise or broad capacity only with a recorded reason; hard overlaps never override.
- Stale edits use an integer revision. A race cannot silently overwrite another manager's changes.
- All reads/writes go through the authenticated admin server. RPCs are service-role-only and
  independently resolve the supplied actor against existing access tables. Support retains transport
  access, has no processing data/control and cannot override. Existing active Ops managers without
  a website membership receive explicit memberships; existing memberships are preserved.
- Poll authenticated board every five seconds while visible, refresh on focus/after changes. Draft
  edits remain untouched. Database correctness does not depend on polling.
- Keep legacy Call/Assign/Deliver/Route under a secondary Requests & routes link on Today.

## Migration and rollback

Staging first. Add scheduling objects and triggers without rewriting historical jobs or orders.
Apply production only after database tests and application checks. Application can fall back to the
legacy Today screen if scheduler SQL is absent. Roll back application first; detach scheduler triggers
and revoke scheduler RPC grants to disable. Preserve appointments/audit and manager memberships.
Never drop live scheduling history as an automatic rollback.

## Verification

Results and deployment identifiers are recorded below as verification completes.

### Completed (6 October 2026)

- Final production build, TypeScript and ESLint pass. Foundation suite: 182/182. Security and customer portal static
  checks pass; existing i18n suite: 14/14.
- Staging migration applied through Supabase migration tooling. Scheduler rollback assertions
  pass for nullable new customer, normalized existing customer link, no duplicate customer,
  rider conflict, different rider, duration overlap, adjacent work, cross-lane conflict,
  cancellation/released resource, revision race, combined time/reassignment, promised window
  override, delivery completion through canonical order/dispatch, processing completion without
  changing order, support role boundaries, audit, service-only grants and configurable grid.
- Existing `website_capacity_test.sql` and `website_today_test.sql` pass on staging, rolled back.
  Capacity intentionally signals success with `ALL_CAPACITY_TESTS_PASSED (rolled back)`.
- Real simultaneous staging database sessions: same rider/time yielded one success and one
  `rider_conflict`. Exactly one appointment, task and dispatch job committed. Those identifiable
  race fixtures and their reservations/audit were removed afterwards.
- Database calls tested under actual `service_role`: board, search, pickup save and cancellation
  succeed. Those fixtures rolled back.
- Two independent Chromium contexts (1440 desktop and 390 mobile), using the existing local-only
  synthetic preview: new caller tomorrow, existing customer search/prefill, unassigned booking,
  edits, draft preserved through polling, start/complete/history, competing submissions with
  clean conflict, cross-context refresh, Delivery and Processing create/start/complete, Bangla
  preference/form/source values, no horizontal page overflow or uncaught JavaScript errors.
- Browser script: `scripts/qa/manager-scheduler.browser.cjs`. Supply `PLAYWRIGHT_MODULE` and
  `BROWSER_PATH` if using an external Playwright/browser installation. No new application dependency.
- Desktop/mobile/Bangla captures are in `docs/technical/screenshots/manager-scheduler-*.png`.

### Remaining release gate

The browser tests above use clearly labeled synthetic local preview data. They are not claimed as
an authenticated browser-to-staging-database run. Connected Supabase grants database tooling access,
but does not expose a staging server credential to the application's runtime; connected Vercel
returns sensitive environment metadata without the value, and Preview currently lacks the
Supabase server variables. No authentication bypass, credential retrieval through SQL, or production
session impersonation was added to make this gate appear passed.

An authenticated application runtime connected to staging is the remaining release gate. Keep the PR
unmerged until that flow is verified. Production migration has not been applied. The production
website remains on its existing release. The migration is additive and the app handles missing
scheduler SQL by linking to the existing requests/routes screen.

### V1 scope and operations

Processing assigns real active Ops profiles (including ironman) and real active outlets. No S9
facility is invented because this database exposes only S11 and RUAP as active outlet codes.
The stage is an internal work label; order progression remains in canonical Ops.

Exact transport time updates the canonical task `due_at`, so existing task reminders use that time.
The scheduler adds no automatic customer SMS/WhatsApp and no new outbound notification system.
Call/WhatsApp links are manually opened by staff. Existing public booking windows and capacity
contracts remain in place. Manager-created pickup source is stored on the attachment; the canonical
pickup job uses the existing dispatch source enum and a real canonical pickup task.

Rollback deployment first, then use `docs/technical/sql/manager_scheduler_disable.sql` if necessary.
It detaches the two canonical projection triggers and revokes scheduler RPC execution while preserving
all appointment history, canonical records, audit and memberships. Reapplying the additive migration
restores execution/projection.
