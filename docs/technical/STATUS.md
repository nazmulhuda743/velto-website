# Velto website: current state

Checked **31 Oct 2026** against `main` at 58c09b6, the live site, and the production (`erutxtnepbejdxkoimeo`) and staging
(`ekgdefcdqcsqvpbqponv`) databases. All checks were read-only. Where an older doc disagrees with this page, this page is
the newer record. Older docs keep their history and carry a note pointing here.

## Live

- **www.velto.com.bd is served by Vercel** from this repo. DNS cutover from Webflow is done.
- **Bangla is on** (`/bn/...`). **Customer accounts are on**: `/login` serves the sign-in page and `/account` redirects to
  it. The installed app (`/app`) is live.
- **Live crawl:** 46 routes, phone and desktop, English and Bangla, and 182 internal links.
  - All pages return 200, with no console errors, no broken images, no visible placeholders and no horizontal scroll.
  - Exception: the 404 page has the homepage's title and its language link points to another 404. This is fixed in the
    small-fixes PR.
- **Speed:** the phone homepage (`/`, `/bn` at 390 px) took about 4.4 s to `load`. Other pages took 1–2.7 s. This has not
  been investigated yet.

## Production database

- **Every website SQL file in `docs/technical/sql/` that `main` uses is applied**: functions, tables, the
  `booking-photos` bucket, and the ৳999 blanket-booking table and functions (0 rows; that page is in PR #128).
  - Not applied: the analytics `lang` column (`website_analytics_lang.sql`). It is only in PR #132 and only on staging.
  - Many SQL files and older docs still say "not applied to production". This page supersedes those status lines.
- **Switches:** capacity limits are off. Loyalty, the monthly goal, the promo popup and the announcement bar are off by
  default.
- **Reminders:** SMS reminders (`website_rhythm_touches`) have sent 0 messages ever, although the morning and evening jobs
  succeed. Do a real-phone test before relying on them.
- **Push:** active on 2 devices.
- **Last 7 days:** 88 analytics events and 1 website booking.

### Scheduled jobs (pg_cron)

| Job | Schedule (UTC) | State |
|---|---|---|
| `velto-daily-followups` | 04:00 daily | **Failing every run** (124 failed, 0 succeeded in the recorded history). Its URL still contains the template text `<PROJECT_REF>`. Needs the owner's OK to fix the URL or switch it off. |
| `velto-sla-tasks` | 04:00, 12:00 | Inactive since 13 Sep 2026 (by choice) |
| `velto-iron-escalate`, `velto-task-reminders`, `velto-weekly-pickup-tasks` | — | Succeeding |
| `website-analytics-retention`, `website-dispatch-sync`, `website-match-leads`, `website-push-orders` | — | Succeeding |
| `website-rhythm-morning`, `website-rhythm-evening` | — | Succeeding |

## Staging

- 3 leftover race-test bookings (`zzrace-*`) from the ৳999 tests. Delete them with the owner's OK.

## Open pull requests (31 Oct 2026)

| PR | State |
|---|---|
| #136 Homepage premium pass | CI green, mergeable. Waiting for the owner's review. |
| #128 ৳999 blanket page | Needs `main` merged in. Its SQL is already on production. |
| #132 App step 7 | Superseded by #133. To be rebuilt as a small follow-up ("Part 2"). |
| #125 Manager scheduler (Codex draft) | Conflicts. Blocked on a signed-in staging test. The owner decides. |
| #25, #21 | Superseded by later work. Close. |

## Waiting on the owner

- **Business facts:** the 12 open items in `docs/technical/LAUNCH-QUESTIONS.md`.
  - Legal entity, licence and privacy email.
  - Terms decisions and retention periods.
  - Review counts, turnaround times, the Express fee, the weekly-pickup rules, the ৳60 charge and payment methods.
- **Legal:**
  - the Privacy and Cookie Policy drafts (photo upload, account sign-in, GreenWeb SMS, sign-in cookies);
  - how long booking photos are kept. See `docs/legal/LEGAL-REVIEW.md` §3.
- **Photos:**
  - the licence and source of the 5 owner-supplied images;
  - a Sector 18 outlet photo;
  - the real-photo shoot (`docs/brand/REAL-PHOTO-SHOT-LIST.md`).
- **Approvals:** the homepage (#136), the internal pages, and the Bangla copy review (`docs/content/BANGLA-REVIEW.md`).
