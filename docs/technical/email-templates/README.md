# Customer account emails (Bangla + English)

Bilingual versions of the two Supabase Auth emails website customers receive:

| File | Supabase template | Subject |
| --- | --- | --- |
| `confirm-signup.html` | Auth → Email Templates → **Confirm signup** | `Confirm your Velto account · আপনার Velto অ্যাকাউন্ট নিশ্চিত করুন` |
| `reset-password.html` | Auth → Email Templates → **Reset password** | `Reset your Velto password · আপনার Velto পাসওয়ার্ড রিসেট করুন` |

Status: **prepared, not applied.** Apply on **staging first**; production only after the owner approves.

## How they work

- **One template per project, so it branches.** The Supabase project is shared with Velto Ops, so these
  templates also go to staff. Each file therefore has two branches:
  - **Website customers** get the bilingual email. They are recognised by `terms_version` in their
    account metadata, which only the website sign-up sets.
  - **Everyone else** (Ops staff) gets the project's **current** template, unchanged: the `{{ else }}` branch.
- **Language order and link.** `.Data.locale` is set by the website at sign-up (`"bn"` or `"en"`). For
  `"bn"`, Bangla comes first and the link opens the Bangla pages (`/bn/account`, `/bn/reset-password`).
  Anything else, including accounts created before this change, gets English first and English pages.
  The value only selects between fixed paths and is never printed, so a customer editing their own
  metadata can't inject anything.
- **Links go to the website's `/auth/confirm`**, which checks `next=` with `safeNextPath` and keeps the
  language. This is the link format from `CUSTOMER-PORTAL.md` step 7.

Checked by rendering both files with Go's `text/template` and `html/template` (what Supabase uses) for a
Bangla customer, an English customer, a customer with no saved language, a customer with an unexpected
language value, a staff user and a user with no metadata. Each case got the expected branch, language
order and link, and the language value never appeared in the output.

## Apply (staging first)

1. **Copy the current template.** Supabase dashboard → the **staging** project → Authentication →
   Email Templates → **Confirm signup**. Copy the current *Message body*.
2. **Keep it for staff.** Open `confirm-signup.html` and paste that body in place of the line
   `{{/* ↓ PASTE THE PROJECT'S CURRENT "Confirm signup" TEMPLATE HERE … */}}`. Staff keep exactly what
   they get today.
3. **Point links at staging.** For staging only, replace `https://www.velto.com.bd` in the link with
   the staging/preview website host that has customer accounts enabled. That host must be in
   Authentication → URL Configuration → Redirect URLs.
4. **Save.** Paste the whole file into the *Message body* and set the *Subject* from the table above.
5. **Reset password.** Repeat steps 1–4 for **Reset password** with `reset-password.html`.
6. **Test** with a real inbox:
   - Sign up on `/bn/signup`: the Bangla-first email arrives and the link opens `/bn/account`.
   - Sign up on `/signup`: the English-first email arrives and the link opens `/account`.
   - Use "Forgot password?" for each account: the reset links open `/bn/reset-password` and `/reset-password`.
   - Trigger a staff password reset from the Ops app: the email is unchanged and the link still goes to Ops.
   - Delete the test accounts afterwards.
7. **Production,** only after the owner approves: repeat on the production project with
   `https://www.velto.com.bd`, after the rest of the `CUSTOMER-PORTAL.md` launch steps (custom SMTP,
   redirect URLs).

To roll back, paste the saved original body and subject back.
