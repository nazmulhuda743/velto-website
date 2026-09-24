# Revenue attribution — design proposal

Status: **PROPOSAL, not implemented.** No schema has been applied anywhere. This builds on
PR #17 (production readiness) and PR #19 (Command Center).

Goal: answer "which campaign acquired this customer, and what have they been worth?" — first-order
revenue, 30/60/90-day revenue, repeat, CAC and revenue/LTV by source and campaign — **without ever
guessing who a visitor is.** A visitor is only connected to a customer when the customer identifies
themselves.

---

## 1. What exists today (inspected 2026-09-25)

Production (`velto-production`), read-only aggregate queries only — no rows or personal data read:

| Fact | Evidence | Consequence |
|---|---|---|
| `customers.phone` is **unique** and **CHECK `^01[0-9]{9}$`** | constraint + unique index | One normalized mobile number ↔ at most one customer. Exact phone equality is a deterministic key. |
| 723 customers, 723 distinct phones, 0 duplicates after normalization, 0 emails | aggregate | Phone is the only usable identifier. Email matching is not possible. |
| `customers.whatsapp` set on 297, always equal to `phone` | aggregate | WhatsApp number = phone in practice. |
| 2,307 orders; `orders.customer_id` FK; **20 orders have no customer**; **5 orders' `phone_snapshot` differs from their customer's phone** | aggregate | Revenue follows `customer_id`. Orders without one are reported as unattributed, never matched by snapshot phone. |
| `orders.order_date` is a `date`; `total_amount`, `amount_paid (≤ total)`, `payments(paid_at date, amount > 0)` synced by `trg_payments_sync` | schema, triggers | Two revenue measures available: **billed** (`total_amount`) and **collected** (`payments`). No refund table. |
| Statuses: Delivered 2,236 · Ready 36 · Picked 34 · Cancelled 1; 8 zero-total orders | aggregate | Exclude `Cancelled` and zero totals from revenue. |
| `VEL-` = Sector 11 (2,047), `VELR-` = RUAP / Sector 18 (260) | aggregate | Order number prefix is outlet numbering, not a re-order flag. |
| 340 of 722 ordering customers have repeated | aggregate | Repeat and LTV analysis is meaningful. |
| `orders.customer_source` / `customers.source`: free text, mostly null, inconsistent spellings (`Walk in Cusotmer`, `Walk In Customer`) | aggregate | Ops' self-reported source. **Keep it, never overwrite it.** Report it next to website attribution. |
| `tasks.order_number` exists and staff already fill it (657 process, 13 delivery, 3 pickup tasks) | aggregate | Staff can link a website task to the order it became. This is the strongest possible link. |
| `expenses` has a `Marketing` category but no campaign/channel field (191 rows) | schema | CAC by campaign needs its own spend ledger; total marketing spend exists. |
| Staging has `orders.v2_*` columns; production does not | schema | Nothing in this design may depend on `v2_*`. |
| No customer login exists | — | The "login" route is future work (OTP), not available now. |

PR #17 (`gpt/velto-production-readiness`):

- `website_create_request` writes website bookings/quotes as Ops `tasks` with `source = website_booking|website_quote`,
  **`source_ref` = normalized phone (`01XXXXXXXXX`)**, `dedupe_key`, and a text `Campaign:` line in `description`.
- ⚠️ **Conflict with PR #19:** PR #17's allowlist keeps only `utm_*, fbclid, fbc, fbp, gclid, landing_page, source,
  medium, campaign, content, ad, service`. It **drops `analytics_session`, `device`, `consent` and `referrer`**,
  which PR #19 sends. Without `analytics_session` there is no deterministic session → lead link.
  This must be reconciled first. The fix below stores attribution in structured form rather than extending the text line.
- `website_track_order` verifies **order number + phone** together (a verified identity, but for an *existing* customer).
- The attribution is text inside `tasks.description`: readable by staff, not queryable. This design adds a structured copy.

---

## 2. Architecture: four layers, strictly separated

```
 ANONYMOUS (PR #19)            LEAD (new)                      IDENTITY LINK (new)             OPS (unchanged)
 website_analytics_events  →  website_leads                 →  website_customer_links       →  customers
 visitor_id, session_id        one row per booking/quote/      lead ↔ customer, with            orders, payments
 no PII, 90-day retention      WhatsApp reference; references   method + evidence; exact
                               tasks.id; attribution snapshot   rules only
                                                                        ↓
                                              website_customer_acquisition (derived) + revenue views
                                              marketing_spend (new ledger)  →  CAC, LTV by source/campaign
```

Principles:

1. **Analytics stays anonymous.** No phone, name or customer id is ever written into `website_analytics_*`.
2. **No new copy of the phone number.** Leads reference `tasks.id`; the phone stays in Ops (`tasks.source_ref`, `customers.phone`).
3. **Links are explicit rows with a method and evidence.** They can be audited, reversed and deleted per customer.
4. **Ops is read, never written.** Matching never changes customers, orders, tasks or `customer_source`.
5. **Snapshot at lead time.** Raw events expire after 90 days, so the attribution is copied into the lead when it is created.
6. **Derived tables are rebuildable** from leads + links + Ops at any time.

---

## 3. Proposed schema (sketch — for review, not a migration)

```sql
-- One row per voluntary identification event on the website.
create table public.website_leads (
  id                   uuid primary key default gen_random_uuid(),
  created_at           timestamptz not null default now(),
  kind                 text not null check (kind in ('booking','quote','whatsapp_ref')),
  task_id              uuid references public.tasks(id) on delete set null,  -- booking/quote
  whatsapp_ref         text unique check (whatsapp_ref ~ '^W[A-HJ-NP-Z2-9]{6}$'), -- whatsapp_ref leads
  consent_analytics    boolean not null,
  consent_marketing    boolean not null,
  analytics_session_id uuid,        -- ONLY when consent_analytics; else null
  -- last touch = the session that produced the lead
  lt_channel text, lt_utm_source text, lt_utm_medium text, lt_utm_campaign text, lt_utm_content text,
  lt_landing_page text, lt_referrer_host text, lt_click_id text check (lt_click_id in ('fbclid','gclid')),
  -- first touch = earliest session of the same anonymous visitor (only with analytics consent, ≤ 90 days)
  ft_channel text, ft_utm_source text, ft_utm_medium text, ft_utm_campaign text, ft_utm_content text,
  ft_landing_page text, ft_at timestamptz,
  device text check (device in ('mobile','tablet','desktop')),
  check ((kind = 'whatsapp_ref') = (whatsapp_ref is not null)),
  check (consent_analytics or analytics_session_id is null)
);

-- Lead ↔ Ops customer (and optionally the exact order it became).
create table public.website_customer_links (
  id            uuid primary key default gen_random_uuid(),
  lead_id       uuid not null references public.website_leads(id) on delete cascade,
  customer_id   uuid not null references public.customers(id) on delete cascade,
  order_id      uuid references public.orders(id) on delete set null,
  method        text not null check (method in ('staff_task_order','exact_phone','whatsapp_ref_staff')),
  status        text not null default 'active' check (status in ('active','needs_review','rejected')),
  review_reason text check (review_reason in ('name_mismatch','phone_snapshot_mismatch','multiple_leads')),
  matched_at    timestamptz not null default now(),
  matched_by    text not null,              -- 'system' or the admin's name
  rule_version  smallint not null,
  unique (lead_id)                          -- a lead links to at most one customer
);

-- Derived, rebuildable: which lead acquired each customer.
create table public.website_customer_acquisition (
  customer_id        uuid primary key references public.customers(id) on delete cascade,
  lead_id            uuid references public.website_leads(id) on delete set null,
  classification     text not null check (classification in ('new','reactivated','existing')),
  first_order_id     uuid references public.orders(id),
  acquired_on        date not null,          -- first qualifying order_date (Dhaka)
  model              text not null default 'first_touch',
  channel text, utm_source text, utm_medium text, utm_campaign text, utm_content text,
  rebuilt_at         timestamptz not null default now()
);

-- Spend ledger for CAC (manual entry first; Meta/Google import later).
create table public.marketing_spend (
  id            uuid primary key default gen_random_uuid(),
  spend_date    date not null,                 -- or period start for monthly entries
  period_days   smallint not null default 1 check (period_days between 1 and 31),
  channel       text not null,                 -- same channel keys as the dashboard
  utm_source    text, utm_medium text, utm_campaign text,
  amount_bdt    numeric(12,2) not null check (amount_bdt >= 0),
  entered_by    text not null,
  import_source text not null default 'manual' check (import_source in ('manual','meta_api','google_api')),
  note          text,
  created_at    timestamptz not null default now()
);
```

- RLS on, all privileges revoked from `anon`/`authenticated`/`public`, `service_role` only (same as PR #19).
- Revenue is computed by **views over Ops** (`orders`, `payments`), never copied: e.g.
  `website_customer_revenue` (per customer: first-order revenue, billed revenue 30/60/90/all-time from `acquired_on`,
  order count, repeat flags, collected revenue) and `website_campaign_performance` (per campaign/channel and cohort month).
  At ~2,300 orders plain views are enough. Materialize nightly only if needed.
- Marketing identifiers for future Meta CAPI (`fbc`, `fbp`) are **not** stored here. If CAPI is approved, they go
  in a separate table, only with marketing consent, with ≤ 7-day retention (Meta's event window).

---

## 4. How identification happens (voluntary only)

| Route | Available now? | What links | Strength |
|---|---|---|---|
| **Booking / quote form** | Yes (after PR #17 activation) | `website_create_request` also inserts `website_leads` (task id, consent, session id if analytics consent, snapshot) in the **same transaction** | Phone is given by the customer. |
| **Staff links the task to the order** | Yes — `tasks.order_number` already exists and is used | When a `website_booking` task gets `order_number`, that task → order → `orders.customer_id` | **Strongest (verified by staff).** |
| **WhatsApp** | Partly | `/go/whatsapp` creates a random reference (`W7K2PQ`) and pre-fills "Ref W7K2PQ" in the message; the customer chooses to send it. Staff record the ref on the order (new Ops field; exact-format match only). | Deterministic when the ref is recorded; otherwise nothing. |
| Meta click-to-WhatsApp ads (no website visit) | No | Needs WhatsApp Business API (`ctwa_clid`) | Out of scope. |
| **Order tracking** (order no. + phone) | Yes, but **not used** | Would identify an *existing* customer's browser | Not acquisition. Excluded in V1 to avoid purpose creep. |
| **Login** | No login exists | Future OTP login gives a verified phone | Later. |
| Phone typed anywhere else | — | — | Not collected. |

---

## 5. Identity-matching rules (rule_version 1)

**Allowed evidence, in priority order:**

1. **`staff_task_order`**: a website task whose `order_number` staff filled in. The link is task → that order → its `customer_id`. Always wins.
2. **`whatsapp_ref_staff`**: an order where staff recorded a website WhatsApp reference that exists in `website_leads`.
3. **`exact_phone`**: the lead's phone (`tasks.source_ref`, already normalized to `01XXXXXXXXX` by PR #17) is
   **exactly equal** to `customers.phone`. Because `customers.phone` is unique, this gives 0 or 1 customer, never a choice.
   The converted order is the customer's **first non-cancelled order with `order_date` between the lead's Dhaka
   date and 14 days after it**. With no such order, the lead is linked to the customer but has no order yet.

**Never used:** name similarity, partial or last-N-digit phone, address, area, IP address, device, user agent,
cookies across devices, WhatsApp display names, "same household" inference, or any fuzzy or probabilistic score.
If none of the three rules applies, **the lead stays unlinked.** The daily job retries, still with exact rules only
(Ops may create the customer later).

**Review flags.** These don't change the match; they only surface the link to an admin for confirmation:

- `name_mismatch`: the lead's name and the customer's name share no word. Example: someone booking with a parent's number.
  The link stays `needs_review` and counts in revenue only after an admin confirms it.
- `phone_snapshot_mismatch`: the matched order's `phone_snapshot` differs from the customer's phone (5 such orders today).
- `multiple_leads`: several leads from the same phone precede one order. The earliest one inside the window gets the order; the others are recorded as `influenced`.

**New vs existing (decides whether a campaign gets acquisition credit):**

- `new`: the customer had **no** non-cancelled order before the lead. Counts for CAC.
- `reactivated`: the last order before the lead was more than 90 days earlier. Reported separately, not in CAC.
- `existing`: an order within the 90 days before the lead. Never counted as acquisition.

**Attribution model.** Acquisition uses **first touch**, the earliest known session of that visitor within 90 days;
if unknown, it falls back to last touch and is labelled as such. Lead conversion uses last touch. No fractional or
multi-touch model in V1.

---

## 6. Revenue and metric definitions (to confirm with the owner)

- **Billed revenue** = `orders.total_amount` for orders not `Cancelled` and with total > 0, by `order_date` (Dhaka).
  **Collected** = `sum(payments.amount)` by `paid_at`. Both are shown; billed is primary.
- **First-order revenue** = billed total of the acquiring order.
- **30/60/90-day revenue** = billed revenue of orders with `order_date` in `[acquired_on, acquired_on + N days)`,
  first order included. A cohort only appears once it is at least N days old; younger cohorts are marked "maturing", not zero.
- **Repeat** = a second non-cancelled order; also reported as repeat within 30/60/90 days.
- **CAC** = recorded spend for a channel/campaign in a period ÷ `new` customers acquired by it in that period.
  It is shown only where spend is recorded; otherwise "—". It is never estimated from the `expenses` Marketing total.
- **LTV** = cumulative billed revenue per acquired customer (all-time and 90-day), plus LTV : CAC.
  It is **revenue-based**: there is no cost-of-service data, so no margin LTV and no claim of profit.
- **Coverage** is shown on every report: the share of new customers with a known website source, and the
  attributed plus unattributed revenue totals, which must reconcile to Ops' total for the period.

---

## 7. Privacy constraints

1. **Consent gates the session link.** `analytics_session_id` and first touch are stored only when Analytics consent
   was granted at submission (the consent state is recorded on the lead). Without it, the lead keeps only the URL
   campaign tags (already disclosed on `/privacy`) and no journey.
2. **No PII in analytics tables.** Links use ids (`task_id`, `customer_id`); the phone stays in Ops.
3. **Purpose limitation.** Links are used for aggregate marketing measurement. Per-customer views are admin-only and
   show `customer_code` and revenue, not phone or address.
4. **Small-cell protection in reports:** campaigns with fewer than 3 acquired customers show "< 3" for per-customer averages.
5. **Retention:** leads and links for 25 months, then kept only in aggregate. Deleting a customer in Ops cascades.
   A `website_forget_customer(customer_id)` function removes links and leads on request.
6. **Withdrawal:** withdrawing consent stops future linking. Past links can't be traced back to a browser once the
   cookie is gone, so erasure is done per customer on request.
7. **Before activation**, update `/privacy` and `/cookies` to say that, with analytics consent, website visit
   information may be connected to a booking to measure which campaigns bring customers.
8. **Service role only.** Matching runs in the database. The browser never sees link, lead or revenue data.

---

## 8. Edge cases

| Case | Handling |
|---|---|
| Phone typed as `+880…`, spaces, dashes | Normalized by PR #17 to `01XXXXXXXXX`; anything else is not matched. |
| Customer books for someone else (a parent's number) | Links to the phone owner (whom Ops actually served); `name_mismatch` → review. |
| Existing customer books through the website | `existing` or `reactivated`: no acquisition credit, shown as "website-assisted". |
| Lead, then the order is created by phone or walk-in without staff linking it | `exact_phone` within 14 days; staff linking is preferred when available. |
| Order entered the same day, before the form (staff called first) | The window starts at the lead's Dhaka **date**, so same-day orders count. Earlier days don't. |
| Several leads from one phone | Earliest lead inside the window converts; the rest are `influenced`. |
| Duplicate or retried submission | Same `dedupe_key` → same task → one lead. |
| Lead never converts | Lead with no revenue; appears in lead → customer conversion rate. |
| Order with `customer_id` null (20 today) | Unattributed; never matched by snapshot phone. |
| Customer's phone later changed in Ops | Existing links stay (keyed by `customer_id`); only unlinked leads are re-matched. |
| Ad clicked on phone, booked on laptop | Two anonymous visitors; first touch is lost and may show Direct. **No cross-device stitching.** Coverage shows it. |
| Analytics events purged after 90 days | Attribution was snapshotted at lead time. |
| Spam or fake lead using a real customer's number | Linked to that customer, but gets no acquisition credit unless a new order follows. `existing` customers never count. |
| Cancelled, zero-total or redo orders | Excluded from revenue; zero-total orders are ignored. |
| Weekly subscriptions (`weekly_subscriptions`) | Revenue is counted through the orders they generate. Confirm that each run creates an order. |
| Ops' own `customer_source` disagrees | Both are shown side by side; the Ops field is never modified. |
| Campaign names typed inconsistently | Link builder (PR #19) plus a later alias table; no automatic merging. |
| Staging / production schema drift | No dependency on `v2_*`; a schema-contract `DO` block like PR #17's. |

---

## 9. Implementation plan (after approval)

0. **Prerequisites**
   - Merge PR #17 and PR #19.
   - Resolve the allowlist conflict: `website_create_request` must accept `analytics_session`, `consent`, `device`
     and `referrer`, or better, receive them as a separate structured argument.
   - Confirm the revenue definitions in §6 and the 14-day window with the owner.
1. **Lead capture.** Add `website_leads`. Extend `website_create_request` so it inserts the lead in the same
   transaction: first/last-touch snapshot from `website_analytics_events` when consent allows. Staging only, tested
   in rolled-back transactions.
2. **Staff link (Ops side).** Staff filling `tasks.order_number` on website tasks is an Ops-app habit or UI change.
   Document it for staff; no website change needed.
3. **Matching job.** `website_match_leads()`: idempotent, applies rules 1–3 and review flags, writes only
   `website_customer_links`. Runs nightly (pg_cron) and on demand from the dashboard.
4. **Acquisition and revenue.** `website_rebuild_acquisition()` plus the revenue views, with a reconciliation test:
   attributed + unattributed = Ops total.
5. **Spend ledger.** `marketing_spend` with a minimal admin entry form (the only UI in this phase).
6. **WhatsApp references.** Reference codes on `/go/whatsapp` and an Ops field to record them (needs Ops app work).
7. **Reporting.** One attribution report (acquisition by campaign, cohort revenue, CAC, LTV, coverage).
   Built only after steps 1–5 are verified on staging.
8. **Privacy.** Update `/privacy` and `/cookies`, add `website_forget_customer`, then activate in production.

**Tests before activation:**
- Unit tests for normalization, windows and classification.
- SQL fixtures in staging covering every §8 case: exact match, no match, name mismatch, existing, reactivated,
  multiple leads, null `customer_id`, cancelled orders.
- Proof that no fuzzy path exists: a lead with a one-digit-different phone must stay unlinked.
