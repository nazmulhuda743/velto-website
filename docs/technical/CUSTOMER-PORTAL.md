# Customer Portal V1

Customer sign-in, order history and booking prefill for the Velto website. Velto Ops stays the
source of truth for customers, orders, items, payments and outlets. Supabase Auth (same Ops
project) only provides customer identity.

Status: **BUILT and TESTED on staging** (`ekgdefcdqcsqvpbqponv`). **SQL applied to production** (`erutxtnepbejdxkoimeo`) on 2026-09-25; accounts stay off until SMTP, email templates and redirect URLs are set (§8 steps 5–9).

> ### Production activation log (2026-09-25)
> - `dashboard@velto.internal` kept by owner decision: `profiles` row created (role `manager`, outlet `all`).
> - Policy snapshot taken first: `docs/technical/sql/customer_portal_rollback_production.sql` (145 policies).
> - Applied as migrations: `website_admin_and_tracking`, `website_analytics_command_center`, `website_revenue_attribution_v1`,
>   `website_create_request_attribution_v1`, `customer_portal_v1` (hardening + portal).
> - `customer_portal.sql` now runs on both projects: the Ops v2 objects that exist only on staging
>   (`orders.v2_promised_at`, `order_status_history.v2_corrected_by_event_id`, `velto_v2_local_phone()`) are read through
>   JSON or replaced by the portal-owned `portal_local_phone()`.
> - Verified: 0 ungated policies; an active staff session sees all orders/customers/payments/tasks, a non-staff session sees 0;
>   `customer_accounts` and staff link functions are not reachable by API roles.
> - Cron: `website-analytics-retention` (21:15 UTC) and `website-match-leads` (21:30 UTC).
> - Website Vercel env points at production; booking, quote, tracking and duplicate handling tested live (test tasks removed).

> ## ⛔ Production blockers (read first)
>
> **Update 2026-09-25:** blockers 1 and 2 are resolved on production (see the activation log above). Blocker 3 (custom SMTP) is still open.
>
> ### 1. Critical: public sign-up + permissive Ops policies (live risk today)
> Production Ops (`erutxtnepbejdxkoimeo`) currently has:
> - **public sign-up enabled** (email provider on, `disable_signup = false`), and
> - **always-true policies for `authenticated`** on sensitive Ops tables: customers, orders,
>   payments, tasks, profiles, weekly_subscriptions and more.
>
> Anyone can create an account with the publishable key and then read or change that data.
> **Immediate manual mitigation (owner):** Supabase → **Authentication → Sign In / Providers →
> turn off "Allow new users to sign up"**. Keep sign-up **disabled** until *all* of the following hold:
> 1. production policy hardening (`customer_portal.sql` part 1) is applied and verified,
> 2. the Ops app regression test passes against hardened policies,
> 3. the service-account question below is decided,
> 4. portal activation is explicitly approved.
>
> ### 2. Service account without a staff profile
> Production user **`dashboard@velto.internal`** has **no `profiles` row**. After hardening, any
> integration signing in as it loses all Ops access. **Before hardening production, the owner
> decides:** either create the correct `profiles` row (role and outlet) if the account is still
> needed, or confirm it is obsolete and should stay blocked. This is not decided automatically.
>
> ### 3. Custom SMTP (launch blocker)
> The built-in Supabase email sender is rate-limited to a few emails per hour; on staging the
> second sign-up in an hour was refused. Sign-up verification, password reset and recovery are
> not reliable until **custom SMTP** is configured (Auth → SMTP). Not built here.
>
> ### 4. Tracking RPC missing on staging (belongs to activation SQL)
> The staging deployment's `/api/track` returns **503** because `website_track_rate_limit`
> (added by PR #17) does not exist on staging. That's production/activation SQL work
> (`docs/technical/sql/website_admin_and_tracking.sql`); the portal doesn't change tracking.

---

## 1. Security precondition: Ops authorization hardening

Before this work, Ops treated every `authenticated` user as staff. Many policies were
`USING (true)` / `WITH CHECK (true)` for `authenticated` (customers, orders, payments, tasks,
profiles, weekly_subscriptions, outsource_*, …) and Postgres ORs permissive policies, so the
`is_active_staff()` policies next to them did not restrict anything. Both staging and production
also have **public sign-up enabled**. Anyone holding the publishable key could therefore sign up
and read or change Ops data.

`docs/technical/sql/customer_portal.sql` part 1 fixes this in a way that is safe to re-run:

- Every policy on `public.*` and `storage.objects` that applies to `authenticated`/`public` is
  rewritten to `is_active_staff() AND (<original expression>)`. Staff keep exactly the access
  they had (they are active staff); anyone without an active `profiles` row gets nothing.
- `cockpit_stats()` (SECURITY DEFINER, no caller check) is renamed to `cockpit_stats_unguarded()`
  (execute revoked from API roles) and replaced by a staff-gated wrapper. Its body is untouched.
- Every other SECURITY DEFINER function executable by `authenticated` was reviewed. The
  `velto_v2_*` functions already gate on `velto_v2_caller()` / profile checks. The invoker
  functions (`dashboard_counts`, `dashboard_stats`, `velto_followups_due_today`, finance) now see
  no rows for non-staff because of the hardened RLS.
- Views are `security_invoker`, so they follow the hardened RLS.

Verified on staging with real customer JWTs over PostgREST: 0 rows from `orders`,
`customers`, `payments`, `order_items`, `tasks`, `profiles`, `weekly_subscriptions`,
`order_status_history`, `price_list`, `outlets` and the Ops storage buckets. Writes are rejected
and Ops RPCs are denied. Active staff still see all rows (692 customers, 2,119 orders on staging).

**Production needs the same hardening before (or instead of) anything else**, even if the portal
is never launched: see §8.

Rollback for staging: `docs/technical/sql/customer_portal_rollback_staging.sql` restores the exact
pre-hardening expressions. That reopens Ops data to any signed-in user, so only use it while
sign-up is disabled.

---

## 2. Architecture

| Concern | Implementation |
| --- | --- |
| Identity | Supabase Auth, same project as Ops. Customers sign in with a mobile number (SMS code) or Google; there are no customer passwords. The Email provider stays on in Supabase because staff use it for `/admin` |
| Session | `@supabase/ssr` server client. Cookies are httpOnly, `SameSite=Lax`, `Secure` in production, `path=/`. No Supabase client in the browser; the publishable key stays server-side (`VELTO_SUPABASE_PUBLISHABLE_KEY`) |
| Session upkeep | `src/proxy.ts` (Next 16 proxy) on `/account*`, `/login`, `/signup`, `/book`: validates with `auth.getUser()` (server round-trip, never trusts the cookie alone), refreshes tokens, redirects signed-out visitors from `/account*` to `/login?next=…` |
| Header state | Non-sensitive `velto_account=1` hint cookie so public pages stay static; account pages always re-verify on the server |
| Customer data | SECURITY DEFINER SQL functions granted to `authenticated` only, deriving the caller from `auth.uid()` |
| Staff linking | Website admin (`/admin/accounts`) → service-role-only SQL functions |
| Admin auth | Unchanged and separate (`velto_admin` HMAC cookie, path `/admin`, Ops `role=admin`) |
| Feature flag | `VELTO_CUSTOMER_ACCOUNTS_ENABLED=true` + URL + publishable key. When off, auth pages show "coming soon", the header shows no Sign in, and `/account` redirects to `/login` |

Brute-force brake: Google sign-in starts are limited per IP (10 per 10 minutes) on each server
instance; SMS codes use the database limiter (lib/sms/limits.ts). Because auth calls come from
Vercel, Supabase sees Vercel's IPs. Review Supabase **Auth → Rate Limits** for production.

---

## 3. Flows

**Sign up / sign in** (`/signup`, `/login`): mobile number first, then "Continue with Google".
Sign-up also asks for the full name and the Terms/Privacy consent. A correct SMS code signs the
customer in and creates the account on first use. Success → the `next` destination, which must be
a same-site path under `/account`, `/book`, `/quote` or `/track`; anything else falls back to
`/account`. Already signed in → "You're already signed in" with Continue / Sign out.

**No passwords** (since 28 Sep 2026): the email + password forms, `/forgot-password` and
`/reset-password` are gone. Both old URLs redirect (307) to `/login`. `/auth/confirm` still
completes Google sign-in and older email links; a password-recovery link goes to `/login`.
Existing email accounts can sign in with Google (same address) or their verified mobile number.

**Sign out**: `auth.signOut({ scope: "local" })`, hint cookie cleared, back to `/`.

---

## 4. Customer ↔ Ops identity bridge

`public.customer_accounts` (RLS on, **no policies**, no grants to `anon`/`authenticated`):

| Column | Notes |
| --- | --- |
| `auth_user_id` uuid PK → `auth.users` (cascade) | one row per customer login |
| `customer_id` uuid **unique** → `public.customers` (set null) | set only when a link is approved |
| `full_name`, `phone` | customer-entered; `phone` is a claim and grants nothing |
| `verified_phone` | the Ops customer phone, set at approval |
| `address`, `area` | pickup details used for booking prefill (Ops customers are not modified) |
| `link_status` | `none` · `pending` · `linked` · `rejected` |
| `link_requested_at`, `link_decided_at`, `link_decided_by`, `link_method` (`staff_callback` / `sms_otp`) | audit |
| `terms_version`, `terms_accepted_at`, `created_at`, `updated_at`, `last_login_at` | |

Constraint: `linked ⇔ customer_id and verified_phone are set`.

**Typing a phone number never unlocks history; proving it by SMS code does.**

Proving the phone never links by itself: the customer sees a **welcome back** preview and
decides (`docs/technical/sql/website_identity_claim.sql`, `src/components/account/WelcomeBack.tsx`).

- **Signed in with the mobile number:** the phone is already proven by the sign-in code.
- **Google account:** the account card offers **Show my past orders** → the website
  texts a 6-digit code to the account's phone (`src/lib/customer/sms-link.ts`, signed cookie,
  10-minute expiry, database rate limits) → `portal_link_verified_phone` (service role) records
  the proven phone (`proven_phone`).
- Then `portal_match_preview()` decides what the account layout shows:

| State | Screen |
| --- | --- |
| `none` | new-customer onboarding (name → sector → address) |
| `recent` (one customer, order in the last 12 months, not linked to another login) | "Welcome back, {first name}", order count, last order month → **Continue** restores everything |
| `stepup` (older than 12 months, no orders, or linked to another login) | nothing shown; the customer types the name they use with Velto. A match restores; 3 misses → `pending` for staff |
| `assisted` (several customers share the phone, or the name check failed) | no data; onboarding with a "we'll check" note; staff link it in /admin/accounts |
| `rejected` ("This isn't me") | fresh profile; this login is never offered that history again |
| `linked` | straight in |

- Before **Continue** nothing is shown beyond the first name, order count and last order month
  (and nothing at all for `stepup`): no address, sector, amounts or order details.
- **Continue** on a new account records `terms_version` / `terms_accepted_at` ("Continuing means
  you agree to the Terms and Privacy Policy", no checkbox). The onboarding form records it the same way.
- **This isn't me** and failed name checks are stored in `customer_identity_decisions` (no API
  grants). They show in /admin/accounts under **Possible number changes**, and bookings from that
  phone carry a **Number may have changed** badge on the dispatch board until staff mark it checked.
- Ops has no sector for customers, so the step-up check is the name alone (Md/Mohammad/Mst… ignored).
- Several logins of the same person (email, Google, phone) may be linked to the same Ops
  customer: each proved the phone. `customer_id` is therefore not unique.
- Several Ops customers with the same phone, or no SMS access: staff decide, as below.

1. The customer taps **Ask Velto to check by phone** → `pending`. Their phone is then locked.
2. Staff open **/admin/accounts**. For each request they see the account and the only Ops
   customer whose phone equals the claimed phone, with order count, last order and whether it's
   already linked.
3. Staff call the number **on the Ops record**, confirm the person created the account, tick
   the confirmation box and **Approve**. The database re-checks the phone match. **Reject** and **Unlink** are also available.

**Sign in with a mobile number** (docs/technical/PHONE-SIGN-IN.md) proves the phone with an SMS
code. When the account's phone was proven that way and exactly one Ops customer has that phone,
the welcome-back preview above is shown; **Continue** links with `link_method = 'sms_otp'`.
Anything ambiguous still goes to staff as above.

---

## 5. Database functions

| Function | Security | Callable by | Purpose |
| --- | --- | --- | --- |
| `portal_me()` | definer, `search_path=''` | authenticated | account + link state (+ Ops name/phone/address when linked). Creates the account row from sign-up metadata on first call. Rejects staff (`42501`) |
| `portal_profile_save(name, phone, address, area, terms_version)` | definer | authenticated | own profile; phone locked while `pending`/`linked` |
| `portal_request_link()` | definer | authenticated | `none`/`rejected` → `pending` |
| `portal_touch_login()` | definer | authenticated | `last_login_at` |
| `portal_orders(limit ≤100)` | definer | authenticated | orders where `orders.customer_id = caller's linked customer_id` |
| `portal_order_get(order_number)` | definer | authenticated | one order + items + status timeline. `null` for "not yours" and "doesn't exist" alike |
| `portal_link_requests(status)` | definer | **service_role** | staff queue |
| `portal_link_decide(user, decision, by, method)` | definer | **service_role** | approve / reject / unlink |
| `portal_caller()`, `portal_order_json()`, `portal_status_label()` | internal | nobody (revoked) | helpers |

Customer-safe order fields only: order number, status (and customer label), order/pickup/delivery/
promised/delivered dates, services, item count, express, total, paid, due, payment status,
outlet name, item lines (name, service, quantity) and the status timeline (status + time).
Never returned: internal ids, staff notes (`csr_notes`, `iron_note`), rider, customer source,
snapshots, instructions, photos, operation ids or who changed a status.

Status language (presentation only): New → Booked, Picked → Collected, In Velto Facility → Being
cleaned, Ready → Ready, Delivered → Delivered, Cancelled → Cancelled.

---

## 6. Website routes

| Route | Notes |
| --- | --- |
| `/login`, `/signup` | noindex; designed states: default, code sent, wrong code, SMS failed, Google failed, network unavailable, already signed in, accounts disabled |
| `/auth/confirm` | email-link handler (route handler) |
| `/account` | greeting, active order (status, number, expected back, amount due, progress), Book another pickup, View all orders, link card, recent orders, pickup details, WhatsApp help, regular-pickup prompt after 3+ orders |
| `/account/orders` | In progress / Past orders |
| `/account/orders/[order number]` | detail. The URL takes the order number only (never an internal id); invalid format → 404; not yours → 404 |
| `/account/profile` | name, phone (locked when pending/linked, with reason), area, pickup address; email is read-only (change via Velto) |
| `/book` | signed-in customers get name, phone, sector and address prefilled; nothing is submitted automatically; signed-out visitors see a "Sign in to fill in your details" link that returns to the same booking |
| `/admin/accounts` | staff link verification |
| `/cookies` | cookie policy + settings |

---

## 7. Cookie consent and analytics privacy

Consent and analytics belong to PR #19 (Website Command Center); see
`docs/technical/COMMAND-CENTER.md` for the banner, `velto_consent_v1`
(`{ version, analytics, marketing, timestamp }`), Consent Mode v2, `/cookies` and `/api/collect`.
The portal adds only these privacy guards on top of it:

- **Private paths** (`src/lib/analytics/private-paths.ts`): `/account`, `/account/*`, `/auth/*`,
  `/login`, `/signup`, `/forgot-password` and `/reset-password`. The sign-in pages are included
  because `/login?next=` can carry an order page address.
- **GTM** (`ConsentGatedTagManager`): never started on a private path. A loaded container cannot
  be unloaded, so a client-side move from a public page (with GTM running) onto a private path
  reloads the document; order pages opened from the account area never share a page with GTM.
- **First-party analytics:** `track()` emits nothing on private paths (no data-layer entry, no
  `/api/collect` event); `/api/collect` also drops events whose path is private and redacts
  `/account/orders/<n>` to `/account/orders/[order]` in every stored path (including 404s).
- Account functionality never reads consent: rejecting everything still allows sign-in, orders,
  profile edits, booking (with prefill), tracking and password reset. Signing in never changes consent.
- **GTM container requirement** (as in COMMAND-CENTER.md): GA4 tags require `analytics_storage`
  and Meta/Ads tags require `ad_storage`.

---

## 8. Production activation (in order)

Nothing below has been done on production.

1. **Immediately, whatever happens with the portal:** in production Supabase go to **Authentication → Sign
   In / Providers** and turn off **Allow new users to sign up** until step 3 is applied. Production
   currently has open sign-up plus always-true Ops policies.
2. Owner decision on `dashboard@velto.internal` (no `profiles` row): create the correct profile
   if it is still needed, or confirm it is obsolete and should stay blocked (see blockers above).
3. Snapshot production policies (the query at the top of `customer_portal_rollback_staging.sql`
   shows the format: `select format('alter policy …') from pg_policies …`), then apply
   `docs/technical/sql/customer_portal.sql` and run its verification queries (§6 of the file):
   0 ungated policies, `customer_accounts` not readable by API roles, link functions
   service-role only.
4. Regression-test the Ops app on hardened **staging** first (it has been applied there):
   staff login, order create/status/payment, tasks, weekly subscriptions, outsourcing, finance,
   cockpit and photos. Deactivated staff now lose access (previously they kept it).
5. Supabase **Auth → URL Configuration**: add `https://www.velto.com.bd/auth/confirm` (and
   preview/staging hosts as needed) to Redirect URLs. Keep Site URL as the Ops app if staff
   emails depend on it.
6. **Custom SMTP** (Auth → SMTP) with a Velto sender. The built-in sender is rate-limited to a
   handful of emails per hour; on staging the second sign-up in an hour was refused.
7. Email templates (Auth → Email Templates), so links work on any device. Use the bilingual
   (Bangla + English) templates in `docs/technical/email-templates/` (see its README; staff keep the
   current template through the `{{ else }}` branch). They use these links, with `/bn` for Bangla customers:
   - Confirm signup: `https://www.velto.com.bd/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/account`
   - Reset password: `…/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password`
8. Review Auth rate limits and password policy (minimum length 8 matches the website).
9. Vercel Production env: `VELTO_SUPABASE_PUBLISHABLE_KEY` (production publishable key, **no
   `NEXT_PUBLIC_` prefix**), then `VELTO_CUSTOMER_ACCOUNTS_ENABLED=true`, and redeploy.
10. Staff process for `/admin/accounts`: approve only after calling the number on the Ops record.
11. Configure the GTM container per §7 before setting `NEXT_PUBLIC_GTM_ID`.
12. Re-enable sign-up in Supabase only after steps 3–9.

Rollback: set `VELTO_CUSTOMER_ACCOUNTS_ENABLED=false` (portal hidden immediately) and disable
sign-up. Keep the policy hardening in place; it is correct for Ops regardless.

---

## 9. Staging QA data created for testing

QA auth users `velto-portal-qa-{alpha,beta,gamma}@mailinator.com` and
`velto.portal.qa.staff@example.com` (with a `worker` profile), plus their `customer_accounts`
rows. Alpha is linked to the synthetic customer "Staging Probe" and Gamma to "TEST". The cleanup
statement is in the PR description.

---

## 10. Automated checks

- `npm run test:portal` (also part of `test:security`): static rules. No browser Supabase client;
  no server-only module in client components; the publishable key is read in one place;
  customer code uses only `portal_*` RPCs (never tables or staff link functions); httpOnly/Lax
  auth cookies; proxy covers `/account`; `next=` and order-number validation; consent-first GTM;
  SQL contract (search_path, RLS, grants, staff-gated Ops policies).
- `npm run test:portal-smoke` (CI, against the running build): auth pages render noindex; `/account*`
  redirects when signed out; `/auth/confirm` fails closed; no external `next=`; robots/sitemap;
  no GTM request or noscript iframe before consent; exactly one footer Cookie settings control.
- `npm run test:foundation`: phone, email, password, area, `safeNextPath` and order-number validation.

## 11. Known limitations (V1)

- Only orders whose `orders.customer_id` is set appear (21 staging orders have none).
- Profile edits update the portal profile used for booking prefill; they do not change the Ops
  customer record (staff remain the source of truth).
- Email change is not self-service yet (the profile page says to contact Velto).
- The in-memory email sign-in brake is per server instance; Supabase rate limits are the backstop.
  SMS codes use durable database limits (docs/technical/sql/website_otp.sql).

---

## 12. Integration with PR #19 (done)

PR #23 was rebased onto `main` after PR #19 (and later #27 and #28) merged. The consent banner and
dialog are main's (PR #19, compact banner from PR #28); the portal does not change them. Its temporary consent implementation
(`src/lib/consent.ts`, `src/components/layout/ConsentManager.tsx`, its `/cookies` page,
`TrackingScripts` bootstrap and footer Cookie Settings) was dropped in favour of PR #19's; only
the privacy guards in §7 were ported, and `scripts/customer-portal-tests.mjs` check 7 now points
at PR #19's files.

## 13. Loyalty, order ratings and saved preferences

SQL: `docs/technical/sql/website_customer_extras.sql` (idempotent; test: `sql/tests/website_customer_extras_test.sql`, staging only, rolls back). Needs `customer_portal.sql` and `website_board.sql`. Customers reach their rows only through security-definer functions (caller = `auth.uid()`); the two new tables have RLS on and no API grants.

- **Loyalty tiers** (`lib/customer/loyalty.ts`, `components/account/LoyaltyCard.tsx`): `portal_loyalty(p_months)` counts the customer's non-cancelled orders in the window and in total. Tier names, thresholds, benefits and the milestone reward are website settings (`website_content.loyalty`, admin → Loyalty, **Owner-only save**). Off by default. Defaults are the proposal from Velto's data (1–3 / 4–7 / 8–15 / 16+ orders in 12 months) with no benefits and no reward: nothing is promised until the owner writes it. The milestone stamp card shows only when a reward is written. Staff apply benefits in Ops; the website never changes prices.
- **Order ratings** (`components/account/FeedbackForm.tsx`): delivered orders only, one per order, changeable for 14 days (`portal_feedback_save` / `portal_feedback_list`). 4–5 stars: thanks and a link to the outlet's Google profile. 1–3 stars: the database opens a task on the website task board (urgent for 1–2, high for 3, label `feedback`) with the order number, what went wrong and the comment, **never the name or phone** (every dashboard role sees the board). Staff see who on admin → Customer feedback (`website_feedback_list`, Owner/Manager/Support) and mark it handled (`website_feedback_handle`). The account home asks about the latest unrated order delivered in the last 14 days.
- **Saved preferences** (`components/account/PreferencesForm.tsx`, Profile): shirts on hangers or folded, starch, fragrance, whites/colours separate, a free note, and up to three labelled pickup addresses (`portal_prefs_get` / `portal_prefs_save`; unknown keys are dropped). On /book the care line is added to the request note Ops receives, and saved addresses appear as one-tap chips that fill area and address. Ops is not changed.

## 14. Change or cancel a website pickup; regulars on the dispatch board

SQL: `docs/technical/sql/website_customer_pickups.sql` (idempotent; test: `sql/tests/website_customer_pickups_test.sql`, staging only, rolls back). Needs `customer_portal.sql` and `website_dispatch.sql`.

- **Who:** only a customer whose phone is proven: order history linked (staff/SMS) or signed in with an SMS code (`portal_verified_phone`). Their open website pickup tasks are those whose `source_ref` is that phone (`portal_pickups`). Email-only accounts that aren't linked see nothing here.
- **Account home** (`components/account/UpcomingPickups.tsx`): what they asked for or what Velto planned, with **Change time** (a day in the next 14 days and morning/afternoon/evening, at least an hour ahead) and **Cancel pickup** (optional reason).
- **Rules** (in the database): changes allowed until 3 hours before the end of a slot Velto has planned (09:00 / 14:00 / 18:00 for morning / afternoon / evening), at most 3 changes per pickup; after that the card points to WhatsApp. These are defaults to confirm with the owner.
- **What staff see:** a change puts the dispatch job back to *New* with the customer's new wish (any planned person/slot is cleared so the team re-plans), adds a line to the Ops task and moves its due time to the new slot; the board shows a *Changed by customer* badge. A cancel goes through `website_dispatch_close`: the job is cancelled and the Ops task is closed as "Cancelled by Customer (website): <reason>".
- **Regulars:** the dispatch board shows each customer's order count ("9 orders"), and their loyalty tier while loyalty is switched on ("Gold · 9 orders"), from `website_customer_order_counts` (service role).

## 15. One-tap repeat and routine pickup (phase 4)

**One-tap repeat** (`components/account/QuickRepeat.tsx`, `lib/customer/quick-repeat.ts`). With nothing in
progress, a linked customer with a saved address sees their last order's items, then picks a day
(today while a time is still open, tomorrow, the day after) and a time, and taps **Book pickup**. It posts to
`/api/bookings` exactly like the booking form: same validation, server-side estimate, Ops task, manager
alert and idempotency. Ops receives the same English payload as "Book the same again" on `/book` (items,
"Same as my last order (VEL-…)", saved care). Without a saved address the card keeps the link to the
prefilled form. The pickup wording is shared with the form through `lib/pickup-when.ts`.

**Routine pickup** (`docs/technical/sql/website_routines.sql`, `components/account/RoutineCard.tsx`).
The customer asks for "every Saturday, afternoon" (plus an optional usual service and a note) on
their account. The request shows on **Bookings & quotes → Routine pickups**, and the managers get a phone alert.
A manager confirms it on WhatsApp (the message is prepared in বাংলা and English), then taps **Activate**. That writes a
row into Velto Ops' own `weekly_subscriptions` (optional price per run). From then on Ops' daily job
`create_weekly_pickup_tasks` (pg_cron `velto-weekly-pickup-tasks`, 10:00 Dhaka) makes the day-before
confirmation call task, the pickup task and the delivery task. The customer sees the next pickup day and can
**change** the day or time (the routine keeps running until a manager applies the change), **pause** or **resume** it
(Ops subscription paused or active), or **stop** it (Ops subscription paused and noted, never deleted). A
declined request shows the manager's reason on the account for 30 days.

That Ops job had never run with data. It inserted into a `tasks.note` column that doesn't exist, and its
`on conflict (dedupe_key)` didn't match the partial unique index. `ops_weekly_pickup_tasks_fix.sql`
fixes only those two things (approved by the owner, 2026-09-29).
Tests: `docs/technical/sql/tests/website_routines_test.sql` (staging, rolled back; includes running Ops' job)
and `tests/routine.test.cjs`.
