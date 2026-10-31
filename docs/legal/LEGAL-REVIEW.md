# Legal pages: owner and lawyer review

Pages: `/terms`, `/privacy`, `/cookies`. Shared facts: `src/content/legal.ts`. Layout: `src/components/legal/LegalDocument.tsx`.

These pages were drafted in plain language to international good practice, and they describe the website's real data flows. **They are not legal advice.** Have a Bangladeshi lawyer review them before the public launch.

## 1. Facts to fill in (`src/content/legal.ts`)

Each is `null` today and is not shown until it is set.

- [ ] `legalEntity`: the registered business name that operates Velto.
- [ ] `tradeLicence`: the trade licence number, if it should be shown.
- [ ] `email`: a monitored address for privacy and legal requests. Without it, requests go through WhatsApp or the outlets.

## 2. Policies the Terms state that the build spec doesn't already confirm

Confirm or edit each one. None of them contain an invented amount, period or cap.

| Terms section | What it says | Decide |
|---|---|---|
| 6 Payment | Payment is due on delivery or collection, or as agreed; finished items may be held until paid | Accepted payment methods? Is prepayment ever required? |
| 7 Intake | The intake count is the order record; we contact you about differences, damage or risky stains before going ahead | Matches the intake SOP? |
| 10 Care | Lists inherent risks (shrinkage, dye bleed, glued parts, prints, weak fabric) | Add or remove any? |
| 11 Pockets | Not responsible for items left in pockets; found items are returned with the order | OK? |
| 12 Issues | Report "as soon as possible and before the item is worn, washed or cleaned elsewhere"; the usual remedy is a free re-clean | Do you want a fixed reporting window (e.g. 48 hours)? |
| 13 Liability | Fair compensation based on value, age, condition and wear, not new-for-old; evidence of value may be requested; standard exclusions | Do you want a cap (e.g. a multiple of the cleaning charge)? This needs legal advice under consumer law. |
| 14 Cancellations | Free before pickup; charges for work already done after work has started | OK? |
| 15 Uncollected | Kept safely; we try to contact you; we write before taking any further step | Do you want a defined holding period and a disposal or donation policy? |
| 20 Law | Laws of Bangladesh, Dhaka courts, the Directorate of National Consumer Rights Protection | Lawyer to confirm the wording. |

## 3. Privacy statements that depend on configuration

Keep these true when settings change:

- Analytics retention (90 days raw, 25 months daily totals, 13 months consent counts) depends on `website_analytics_purge()` being scheduled daily (docs/technical/COMMAND-CENTER.md).
- **Booking photos (drafted 31 Oct 2026, needs approval):** bookings can now attach up to 3 photos, stored privately in Supabase Storage (`booking-photos`). The Privacy draft says so. Quote photos still stay on the device. **Open: how long booking photos are kept.** Nothing deletes them today, so choose a period (for example 90 days after the order is delivered) and we will add the clean-up and the sentence.
- **Service providers (drafted 31 Oct 2026, needs approval):** Vercel, Cloudflare, Supabase, Meta (WhatsApp), GreenWeb / bdbulksms.net (SMS sign-in codes and reminders), Google sign-in (only if chosen), and Google/Meta ad tools only with consent. Update the list if another provider is added, for example email sending.
- Booking and quote retention is written as "as long as needed … then deleted or anonymised". Decide on an actual period (for example 3 years after the last order, subject to tax rules) and state it.
- **Customer accounts are live.** Drafted 31 Oct 2026 (needs approval): the account data (phone sign-in by SMS code, or Google name and email) in Privacy, and the sign-in and language cookies (`sb-…-auth-token`, `velto_account`, `velto_link_code`, `velto_lang`) in Cookies. **Still open:** how a customer deletes their account. Today it is by request (Privacy §9), and there is no self-service button.

## 4. Cookie list

The cookie tables in `/cookies` must match the code. If you add a cookie in `src/lib/consent.ts`, `src/lib/analytics/client.ts`, `src/lib/attribution-client.ts` or `src/lib/admin/*`, add a row in the same change.
