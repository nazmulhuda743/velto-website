# Monthly goal → next-month reward

"Spend ৳X this month, get Y all next month." The Kohl's Cash mechanic: a visible target (progress bar in the account), a head start (the first order of the month counts twice), and a reward that is only good the following month, so it brings the customer back.

## For customers (account home)

`GoalCard`: this month's spend from their own Velto orders (cancelled excluded), the rung reached, the next rung and how much more it needs, the whole ladder, and the coupons they hold. Booking with an open coupon shows it in the order summary on `/book`; a free-delivery coupon makes the pickup & delivery line free in the estimate. The server adds `Coupon VG-XXXXXX: … (valid to …)` to the Ops notes from the customer's session (never from the browser), and Velto applies it when confirming the order.

## For staff

- **Loyalty → Monthly goal** (Owner edits, others view): switch, head start, up to four rungs (spend, reward type, amount, label + Bangla). Shows how many customers last month would have reached each rung.
- **Goal coupons** (Owner, Manager, Support, Marketing): issue a month's coupons (idempotent; one per customer per month; valid the whole following month), a WhatsApp line to tell the customer, mark used (with the order number), withdraw or reopen. Activity log: `goal_saved`, `goal_settled`, `coupon_used/void/open`.

Issuing is manual on the 1st for now; a scheduled call to `website_goal_settle` can replace the button later.

## Data

`docs/technical/sql/website_monthly_goal.sql`: table `customer_goal_coupons` (RLS, no API grants; service role reads through the functions) and `portal_goal` (customer), `website_goal_settle / preview / coupons / coupon_mark` (service role). Test: `docs/technical/sql/tests/website_monthly_goal_test.sql` (staging only; rolls back). Settings: `website_content.loyalty.goal` (`parseGoal` in `src/lib/customer/goal.ts`, tested in `tests/customer-goal.test.cjs`).

Status: applied and tested on **staging**; applied on **production** 2026-09-28 (owner-approved). The test script stays staging-only.
