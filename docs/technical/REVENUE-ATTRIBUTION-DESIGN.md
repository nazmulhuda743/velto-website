# Revenue attribution V1

Status: **BUILT · TESTED on staging.** Not approved, not deployed.
Branch `claude/velto-revenue-attribution` is stacked on PR #19 (Command Center) plus the current `main`.
The original proposal (with the full inspection notes) is on `claude/revenue-attribution-design`.

It answers: which campaign acquired a customer, their first-order revenue, 30/60/90-day and lifetime
revenue, whether they repeated, and CAC / ROAS / revenue by source and campaign. **Customer identity is
never guessed.**

---

## 1. Ground truth (inspected 2026-09-25, read-only)

- `customers.phone` is **unique** and **CHECK `^01[0-9]{9}$`**, so exact phone equality gives 0 or 1 customer.
  Production: 723 customers, 723 distinct phones, no emails.
- `orders.customer_id` is a foreign key. 20 production orders have no customer and 5 have a
  `phone_snapshot` that differs from their customer's phone. Revenue follows `customer_id`.
- `tasks.order_number` is already filled in by staff, so it is used as the explicit staff link.
- Staging has `orders.v2_*` columns that production lacks. Nothing here depends on them.
- `expenses` has a Marketing category but no campaign dimension, so there is a separate spend ledger.

## 2. Canonical attribution contract

One contract, enforced in three places: the browser (`src/lib/attribution-client.ts`), the server
validation (`readSubmissionAttribution` in `src/lib/attribution.ts`) and the database
(`public.website_clean_attribution`). Anything not listed is dropped.

| Key | Source | Rule |
|---|---|---|
| `utm_source` `utm_medium` `utm_campaign` `utm_content` `utm_term` | landing URL | ≤ 256 chars, no control characters |
| `source` `medium` `campaign` `content` `ad` `service` | landing URL / CTA | same |
| `landing_page` | first page of the visit | on-site path only; query and fragment removed |
| `fbclid` `fbc` `fbp` `gclid` | landing URL | **kept only with Marketing consent**; the task text and lead store presence only (`click_id=fbclid\|gclid`), never the value |
| `referrer` | set by the site | external host only (`^[a-z0-9.-]{1,120}$`) |
| `device` | set by the site | `mobile` \| `tablet` \| `desktop` |
| `consent` | set by the site | `none` \| `essential` \| `analytics` \| `marketing` \| `analytics+marketing`; anything else becomes `none` |
| `analytics_session` | set by the site | UUID v4, **kept only with Analytics consent** |

`device`, `consent` and `analytics_session` are never read from a URL, so a crafted link cannot set them.
This closes the PR #17 / PR #19 mismatch: PR #17's allowlist had dropped the four site keys.

## 3. Database objects (`docs/technical/sql/website_revenue_attribution.sql`)

| Object | Purpose |
|---|---|
| `website_leads` | One row per booking / quote, written **in the same transaction** as the Ops task by `website_create_request`. Holds the task id, reference, service, outlet, sector number, consent snapshot, analytics session (Analytics consent only), device, last-touch campaign fields and first-touch fields. **No phone, name, address, email or notes.** |
| `website_lead_customer_links` | Lead ↔ Ops customer (and the order it became): method, window kind, status, `name_mismatch`, `conflict`, review and reversal fields, rule version. Only one live link per lead and per order (partial unique indexes). |
| `website_attribution_audit` | Every automatic link, update, supersession, confirm, reject and reverse, with the actor. |
| `website_marketing_spend` | Spend ledger (§8). |
| `website_clean_attribution(jsonb)` | The canonical contract in SQL. |
| `website_match_leads(lookback_days)` | Deterministic matching engine (§4). |
| `website_review_link(link, action, actor, note)` | Confirm / reject / reverse, with audit. |
| `website_attribution_leads(from, to)` | Leads and link state for a date range. |
| `website_attribution_conversions(from, to)` | Attributed conversions, classification and cohort revenue. |
| `website_attribution_totals(from, to)` | Period coverage, which reconciles to Ops. |
| `website_attribution_review()` | Exceptional cases only. |

`docs/technical/sql/website_create_request.sql` is updated to use the canonical contract and to insert
the lead. It refuses to install unless the attribution objects exist.

Access: RLS on every table; `anon`, `authenticated` and `public` have all privileges revoked;
`service_role` only; every function has a fixed `search_path`. The browser never reaches any of it.
Admin pages call these objects server-side after `requireAdmin()`.

## 4. Matching (rule_version 1)

Precedence:

1. **Staff-linked order** (`staff_order_link`): the Ops task's `order_number` matches an order with a
   customer. This is explicit, has **no time window**, and wins. It supersedes a system exact-phone
   link on the same lead or order, and the supersession is audited.
2. **WhatsApp reference** (`whatsapp_reference`): reserved; **not active** (§11).
3. **Exact phone** (`exact_phone`): `tasks.source_ref`, already normalized to `01XXXXXXXXX`, equals
   `customers.phone`. The order is the customer's first qualifying order (not Cancelled, total > 0) with
   `order_date` from the lead's Dhaka date up to +14 days, ordered by `order_date`, then `created_at`,
   then `id`, and not already claimed by another live link.

Deterministic tie rules:
- Leads are processed oldest first, so the earliest lead wins a shared order.
- Orders on the same date are ordered by `created_at`, then `id`.
- A customer with no order yet is `pending` until the window closes, then `none`.

Never used: name similarity, partial phone, IP, device, location, fingerprinting, time proximity.
A lead whose phone matches no customer stays unlinked. Coverage is not forced to 100%.

Rejected links, and links reversed by an admin, are never recreated. Matching is idempotent. It runs
from the dashboard ("Run matching now") and, after activation, nightly via pg_cron.

## 5. Windows

| Lead | Primary window | Otherwise |
|---|---|---|
| Booking | order on day 0–7 → `primary` | day 8–14 → **`late`** (late/assisted): listed separately, **excluded** from primary attribution, CAC and ROAS; after day 14 → `none` |
| Quote | order on day 0–14 → `primary` | after day 14 → `none` |
| Staff link | any date → `explicit` | — |

## 6. Name mismatch and conflicts

- **Name mismatch:** the booking name and the Ops customer name share no word of two or more letters.
  The link is still made and **counted** automatically, with `name_mismatch = true`. It shows in the
  review queue.
- **`staff_link_other_customer`:** the staff-linked order belongs to a different customer than the phone
  matches. The staff link wins and is counted, and the conflict is visible.
- **`order_claimed_by_other_lead`:** two leads are staff-linked to the same order. The second is not
  counted until an admin resolves it.
- The review queue also shows `staff_order_not_found`, and `unresolved_lead`: the Ops task is done,
  the window is closed, and nothing could be linked.
- Admin actions: **Confirm** clears the flag, **Reject** stops counting, **Reverse link** stops counting.
  All are audited.

## 7. Revenue, classification and maturity

- **Billed revenue** (primary) = `orders.total_amount` of qualifying orders: not `Cancelled`, total > 0.
- **Collected** = `payments.amount` on those orders. Also shown: collection rate and outstanding.
- **Classification**, based on the customer's qualifying orders before the attributed order:
  - no earlier order → **acquired**
  - earlier orders, but none within the prior 90 days → **reactivated**
  - an order within the prior 90 days → **existing**
- **Cohort values**, measured from the attributed order date `a`:
  - first-order billed and collected
  - billed and collected for `[a, a+30)`, `[a, a+60)` and `[a, a+90)`
  - lifetime (orders ≥ `a`), order count, repeat, days to second order, repeat within 30/60/90
  - Collected-N counts payments with `paid_at < a+N` on orders inside the window.
- **Maturity:** an N-day value is **NULL** until `a + N ≤ today` (Dhaka). The dashboard shows
  "pending (n)". A group total is only shown when every row in it has matured, never as 0.
- **Acquisition touch:** the visitor's first first-party session (Analytics consent, ≤ 90 days) when
  known, otherwise the campaign sent with the booking/quote. The dashboard labels which one was used.

## 8. Campaign spend, CAC and ROAS

`website_marketing_spend` columns: `spend_date`, `platform` (the utm_source vocabulary), `medium`,
`campaign_name`, optional `campaign_id`, `adset_name`, `adset_id`, `ad_name`, `ad_id`, `spend`,
`currency`, `spend_bdt` (must equal `spend` for BDT), `notes`, `import_source`
(`manual` | `csv` | `meta_api` | `google_api`), `import_batch_id`, `external_key` (for future API
rows), and created/updated/deleted by/at.

- **Duplicates:** there is one live row per day × platform × campaign × ad set × ad (case-insensitive
  unique index) and per `(import_source, external_key)`. A second entry is rejected, not double-counted.
  CSV import shows a preview with row errors, in-file duplicates and already-recorded rows, and saves
  only after confirmation, re-validating everything server-side.
- **Delete** is a soft delete, confirmed on screen and kept for audit.
- Spend is joined to attribution by **campaign name = `utm_campaign`**, case-insensitively.

Definitions:
- **CAC** = spend ÷ **acquired** customers (reactivated and existing never count).
- **First-order ROAS** = first-order billed ÷ spend.
- **30/60/90-day ROAS** = matured N-day billed ÷ spend, "pending" until every conversion in the group
  has matured.
- **Lifetime revenue ÷ spend** and **collected ROAS** (cash) are secondary.
- Top-level CAC and ROAS use **only campaigns with recorded spend**, so organic acquisitions are never
  counted against ad spend.
- **No spend → "Spend not recorded" / "—"**, never 0.

## 9. Coverage (on every report)

`website_attribution_totals` puts every qualifying Ops order in the period into exactly one bucket:

- **conversion:** the linked order
- **follow-on:** a later order by a customer with a primary or explicit link
- **late:** a late booking conversion
- **unattributed**

The dashboard shows each bucket's orders, billed revenue and share of revenue, and checks that
attributed + late + unattributed = Ops totals ("✓ Reconciles"). It also shows new-customer coverage
(new customers with a known website source ÷ all new customers). Unattributed revenue is always shown.

**Backfill:** historical customers without website evidence stay **unknown**. They count in the Ops
totals and baselines, but nothing is inferred for them.

## 10. Privacy

- An anonymous analytics session is linked to a lead **only if Analytics consent existed at submission**.
  This is enforced in the browser, the server and the database.
- Advertising identifiers are retained only with Marketing consent, and only as presence in leads and
  task text. Future Meta CAPI needs a separate short-retention store, gated by the same consent.
- No IP address, fingerprint or device identifier is used or stored. No customer PII is copied into
  analytics or lead tables.
- The admin customer report shows the Ops customer code and revenue only; no name, phone, address or
  browsing history.
- `/privacy` and `/cookies` describe the booking ↔ customer-record connection and the analytics-session
  link, without legal promises.
- Customer login and account work (another session) is independent and untouched.

## 11. WhatsApp: NOT READY

WhatsApp clicks are measured as events only. **No WhatsApp revenue is attributed**, and none is inferred
from timing.

Next architecture, not built:
- `/go/whatsapp` generates a short random reference (e.g. `W7K2PQ`) and puts "Ref W7K2PQ" in the
  pre-filled message.
- The reference is stored as a `website_leads` row of kind `whatsapp_ref` with the campaign snapshot,
  and the session id only with Analytics consent.
- When Ops can save that reference against an order or task (an Ops app change),
  `website_match_leads` links it using the reserved `whatsapp_reference` method.

## 12. Tests

- **Staging SQL suite** (`docs/technical/sql/tests/website_revenue_attribution_test.sql`): one
  transaction, synthetic data in the reserved `0179999xxxx` range, **rolled back**. 43/43 pass.
  - Lead capture: booking and quote leads are created; a duplicate submission creates one lead.
  - Consent: the session is kept with Analytics consent and dropped without it; click ids are dropped
    without Marketing consent; first touch is resolved; the landing query is stripped; unknown keys are
    dropped; no click-id values reach the task text; leads have no PII columns.
  - Links: exact phone → primary; booking day 10 → late; after 14 days → none; quote day 12 → primary;
    staff link wins outside the window; staff link to another customer → conflict; name mismatch is
    flagged but counted; cancelled and zero-value orders are skipped; open window → pending; an unknown
    phone doesn't link (no fuzzy match).
  - Matching is idempotent; a rejected link is not recreated; the audit trail is written.
  - Revenue: acquired, reactivated and existing; first-order billed and collected; matured 30-day; 60/90
    return NULL when not matured; lifetime, repeat and days to second order.
  - Coverage reconciles (orders and billed); follow-on and unattributed buckets are correct.
  - Spend: the duplicate row is rejected; BDT spend must equal `spend_bdt`.
- **Unit tests:** `node scripts/command-center-tests.mjs` (in CI), 20 tests covering the contract and
  consent gates, CAC/ROAS, missing spend, late separation, maturity, campaign join and coverage, paid-only
  rollup, reconciliation, and spend and CSV validation with dedupe.
- **Privileges:** staging checks show `anon`/`authenticated` have no table or function access; RLS and a
  fixed `search_path` are verified; the Supabase security advisor flags none of the new objects.
- **Performance:** `website_attribution_totals` over 90 days on the production-sized staging clone (844
  orders) runs in about 22 ms. Everything is server-side, bounded by date, indexed, and capped at 20,000
  rows.

## 13. Production activation

1. Merge PR #19, then this branch (rebased onto `main`), after review.
2. In a maintenance window, apply in order: `website_analytics.sql`, `website_revenue_attribution.sql`,
   `website_create_request.sql`. Each checks its schema contract first.
3. Schedule `website_match_leads()` nightly (pg_cron, 03:30 Dhaka) alongside `website_analytics_purge()`.
4. Brief staff: when a website pickup becomes an order, type the order number on the Ops task.
5. Start recording spend (manual or CSV), with campaign names equal to the `utm_campaign` from the
   link builder.
6. Enable writes (`VELTO_OPS_WRITES_ENABLED`, `WEBSITE_ANALYTICS_WRITES_ENABLED`) as planned in PR #17 and
   PR #19. Watch `/admin/revenue` coverage and `/admin/revenue/review` for the first weeks.

## 14. Known limitations

- Cross-device journeys (ad seen on a phone, booking made on a laptop) lose the first touch. They are
  never stitched.
- Visitors who decline Analytics are attributed by the campaign on the booking itself (last touch) only.
- Spend is matched by campaign name. Inconsistent naming splits a campaign; use the link builder.
- Revenue is billed order value, not margin. There is no refund model beyond cancellation.
- The WhatsApp channel is unattributed until Ops stores a reference (§11).
