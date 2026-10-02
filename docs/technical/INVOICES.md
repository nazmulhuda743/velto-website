# Invoice links on WhatsApp

Status: **BUILT and TESTED on staging** (`ekgdefcdqcsqvpbqponv`). Production needs `docs/technical/sql/website_invoices.sql`.

## Why

Most customers order on WhatsApp, and Velto Ops creates the order. Only 6 of the last 446 orders (30 days to
2026-10-02) belonged to a customer with a website account, so almost nobody could see their order or invoice
on the website. Every order now has one invoice link that staff send on WhatsApp. It is also the way into the
account: signing in with the same number (SMS code, then "Welcome back") links every order to the account.

## Flow

1. **Admin → Invoices on WhatsApp** (`/admin/invoices`, dispatch section: Owner, Manager, Customer support)
   lists the last 1/3/7 days of Ops orders, or finds one by order number or phone. The link is made when the
   order is first listed.
2. **Send on WhatsApp** opens `wa.me/<customer's WhatsApp, else phone>` with the message (Bangla or English).
   It contains **exactly one link** (unit-tested): the invoice. The list records who sent it and when, and
   when the customer opened it.
3. **The invoice** (`/bn/i/<8-character code>`, `/i/<code>` in English) opens without sign-in and shows:
   - the first name;
   - the status and its progress;
   - the dates and the outlet;
   - the items with prices;
   - the express fee, and a discount or other charge when Ops' total differs from the lines;
   - the total, paid and due;
   - the payments.
   Never the phone, the address or the full name. **Save as PDF / print** prints the invoice alone.
4. **Keep every order in one place:** a signed-out visitor gets "Sign in to my account" (`/login?next=/account/orders/<n>`).
   A signed-in customer whose order it is gets "Open in my account".

Links work for 120 days after the order date; after that the page asks the customer to sign in. `/i/preview0`
shows example data.

## Data (`website_invoices.sql`)

- `website_invoice_links(code, order_id unique, sent_at, sent_by, sent_count, opened_at, open_count)`: RLS on,
  no table grants for any API role.
- `website_invoice_list(days, search, limit)`, `website_invoice_sent(code, by)`, `website_invoice_get(code)`:
  service_role only, called on the website server. `website_invoice_code(order)` is internal.
- Prices are `order_items.quoted_price`, else `reference_price`. In the last 60 days every order had prices, and
  86% matched the total exactly (with the express fee). The rest show the difference as Discount or Other charges.

Test: `docs/technical/sql/tests/website_invoices_test.sql` (staging only, rolls back).
