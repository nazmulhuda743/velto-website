# Sign in with a mobile number (SMS code)

Customers type their Bangladeshi mobile number, get a 6-digit code by SMS, type it, and are
signed in. The same flow creates an account for a new number. Google and email/password stay
available under it.

## How it works

```
/login or /signup ──sendPhoneCodeAction──► Supabase Auth /otp ──Send SMS hook──► /api/auth/sms-hook ──► GreenWeb ──► phone
      code step ───verifyPhoneCodeAction──► Supabase Auth /verify ──► session cookies ──► /account
```

- **Supabase Auth makes, stores and checks the code.** The website never sees or stores it,
  except while the hook passes it to the SMS provider.
- **The hook** (`src/app/api/auth/sms-hook/route.ts`) accepts only requests signed by Supabase
  (Standard Webhooks, `VELTO_SMS_HOOK_SECRET`), refuses non-Bangladeshi numbers, applies the
  limits below, and sends the SMS (`src/lib/sms/send.ts`).
- **The SMS** is English on purpose (one GSM-7 segment; Bangla would cost 2–3). Its last line
  (`@www.velto.com.bd #123456`) lets Android Chrome fill the code in automatically; iPhones offer
  it from the keyboard (`autocomplete="one-time-code"`).
- **The button appears only when Supabase → Providers → Phone is on** (read from
  `/auth/v1/settings`, cached 5 minutes). Turning it off hides it; no deploy needed.

## Limits (`docs/technical/sql/website_otp.sql`)

| Bucket | Limit per hour | Where |
| --- | --- | --- |
| per phone | 5 codes | hook (applies to every way of requesting a code) |
| whole site | 300 codes | hook (ceiling on the SMS bill) |
| per IP | 10 code requests | website action |
| per phone | 10 code checks | website action |

Keys are SHA-256 hashes; no phone or IP is stored. If the limiter can't answer, no SMS is sent.
Supabase's own rate limits also apply (see setup step 4).

## Order history

A phone proven by SMS code is trusted: `portal_auth_phone()` reads it from `auth.users`
(`phone_confirmed_at`), which only Supabase Auth can set. The customer can't replace it with a
typed one (`portal_profile_save`). When exactly one Ops customer has that phone and it isn't
linked to another account, `portal_auto_link()` links the history immediately
(`link_method = 'sms_otp'`). Otherwise staff decide in /admin/accounts as before.

Customers who signed up with email or Google keep the staff callback flow for now.

## Setup (production, in order)

1. **Database:** apply `docs/technical/sql/website_otp.sql`, then the `portal_auth_phone`,
   `portal_auto_link`, `portal_me` and `portal_profile_save` functions and grants from
   `docs/technical/sql/customer_portal.sql`.
2. **SMS provider:** GreenWeb (bdbulksms.net) account with credit; copy the API token from
   https://gwb.li/token.
3. **Vercel → Production env:** `VELTO_SMS_PROVIDER=greenweb`, `GREENWEB_SMS_TOKEN=<token>`.
4. **Supabase → Authentication:**
   - **Hooks → Send SMS → HTTPS**, URL `https://www.velto.com.bd/api/auth/sms-hook`,
     generate the secret, copy it into Vercel as `VELTO_SMS_HOOK_SECRET`, save, then redeploy.
   - **Providers → Phone:** enable. OTP expiry 300 seconds, OTP length 6. (With the hook on,
     the SMS provider fields there are not used.)
   - **Rate limits:** raise "SMS messages sent per hour" to about 300 so Supabase's default
     doesn't block real customers before our own limits do.
5. **Test** with your own number: /login → Send code → the SMS arrives → type the code → /account.
   Check Command Center → Health for `Sign-in SMS failed` events.

To switch provider later (Muthofun, SSL Wireless), add it to `src/lib/sms/send.ts` and change
`VELTO_SMS_PROVIDER`.
