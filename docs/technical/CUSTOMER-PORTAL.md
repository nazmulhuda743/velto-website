# Customer Portal V1

Customer sign-in, order history and booking prefill for the Velto website. Velto Ops stays the
source of truth for customers, orders, items, payments and outlets. Supabase Auth (same Ops
project) only provides customer identity.

Status: **BUILT and TESTED on staging** (`ekgdefcdqcsqvpbqponv`). Not applied to production.

> ## ⛔ Production blockers (read first)
>
> **Nothing in this document has been applied to production. Production is NOT fixed.**
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
| Identity | Supabase Auth (email + password), same project as Ops |
| Session | `@supabase/ssr` server client. Cookies are httpOnly, `SameSite=Lax`, `Secure` in production, `path=/`. No Supabase client in the browser; the publishable key stays server-side (`VELTO_SUPABASE_PUBLISHABLE_KEY`) |
| Session upkeep | `src/proxy.ts` (Next 16 proxy) on `/account*`, `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/book`: validates with `auth.getUser()` (server round-trip, never trusts the cookie alone), refreshes tokens, redirects signed-out visitors from `/account*` to `/login?next=…` |
| Header state | Non-sensitive `velto_account=1` hint cookie so public pages stay static; account pages always re-verify on the server |
| Customer data | SECURITY DEFINER SQL functions granted to `authenticated` only, deriving the caller from `auth.uid()` |
| Staff linking | Website admin (`/admin/accounts`) → service-role-only SQL functions |
| Admin auth | Unchanged and separate (`velto_admin` HMAC cookie, path `/admin`, Ops `role=admin`) |
| Feature flag | `VELTO_CUSTOMER_ACCOUNTS_ENABLED=true` + URL + publishable key. When off, auth pages show "coming soon", the header shows no Sign in, and `/account` redirects to `/login` |

Brute-force brake: the server actions keep a per-IP window (sign-in 10 per 10 min, sign-up 5 per
hour, reset 5 per hour, resend 3 per hour) on each server instance. Because auth calls come from
Vercel, Supabase sees Vercel's IPs. Review Supabase **Auth → Rate Limits** for production.

---

## 3. Flows

**Sign up** (`/signup`): full name, email, Bangladeshi mobile (`01[3-9]XXXXXXXX`, `+880`/spaces
accepted), password (8–72 characters, a letter and a number), confirmation, and required Terms/Privacy
consent (no marketing opt-in). `auth.signUp` stores `full_name`, `phone`, `terms_version`,
`terms_accepted_at` in user metadata, used once to create the customer's own portal profile.
Existing emails get the same "Check your email" answer (no enumeration).

**Verify email**: the link lands on `/auth/confirm`, which accepts both the PKCE `?code=` redirect
and `?token_hash=&type=`. Success → `/account?welcome=1`. An invalid, expired or used link →
`/login?error=link_expired`. Signing in before confirming shows "Please confirm your email first"
with a resend button.

**Sign in** (`/login`): email + password. A wrong password and an unknown email get the same
message. Success → the `next` destination, which must be a same-site path under `/account`,
`/book`, `/quote`, `/track` or `/reset-password`; anything else falls back to `/account`.
Already signed in → "You're already signed in" with Continue / Sign out.

**Forgot / reset**: `/forgot-password` always answers neutrally. The recovery link goes through
`/auth/confirm` (type `recovery`), which sets a 15-minute httpOnly `velto_recovery` marker. Only
then does `/reset-password` accept a new password. Success signs out other sessions and lands on
`/account?password=updated`. Expired, used or missing links show "This reset link has expired or
was already used" with a new-link button. Tokens are never logged.

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

**Typing a phone number never unlocks history.** There is no SMS/OTP provider in the project
(`sms_provider` is configured as twilio, but phone auth is disabled and there are no OTP tables or
functions), so OTP is not faked. Instead:

1. The customer taps **Link my Velto history** → `pending`. Their phone is then locked.
2. Staff open **/admin/accounts**. For each request they see the account and the only Ops
   customer whose phone equals the claimed phone, with order count, last order and whether it's
   already linked.
3. Staff call the number **on the Ops record**, confirm the person created the account, tick
   the confirmation box and **Approve**. The database re-checks the phone match and the
   one-account-per-customer rule. **Reject** and **Unlink** are also available.

When SMS OTP is configured later, `portal_link_decide(..., p_method => 'sms_otp')` is the hook: an
OTP-verification step can call it after confirming possession of the Ops phone.

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
| `/login`, `/signup`, `/forgot-password`, `/reset-password` | noindex; designed states: default, pending, invalid, verification required, expired link, success, network unavailable, already signed in, accounts disabled |
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
- The in-memory sign-in brake is per server instance; Supabase rate limits are the backstop.

---

## 12. Integration with PR #19 (done)

PR #23 was rebased onto `main` after PR #19 (and later #27 and #28) merged. The consent banner and
dialog are main's (PR #19, compact banner from PR #28); the portal does not change them. Its temporary consent implementation
(`src/lib/consent.ts`, `src/components/layout/ConsentManager.tsx`, its `/cookies` page,
`TrackingScripts` bootstrap and footer Cookie Settings) was dropped in favour of PR #19's; only
the privacy guards in §7 were ported, and `scripts/customer-portal-tests.mjs` check 7 now points
at PR #19's files.
