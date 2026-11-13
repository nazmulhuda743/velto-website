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

## Garment condition report (`website_invoice_condition.sql`, owner 2026-11-13)

The owner: the invoice link showed no stain records. The page now has a **Garment condition** section (after the
items) with every stain staff recorded at drop-off in Velto Ops (`order_stains`): the garment, the stain type and up to
two photos, like page 2 of the app's PDF invoice, plus a short care promise. No stains → no section.

- `website_invoice_get()` gains `condition: [{ item, type, photos, more }]` (at most 30 marks, 2 photo paths each,
  only paths under `stains/`; everything else in the function is unchanged — the file pins the old body's md5).
- The website signs the photo paths on the server for **one hour** (`signConditionPhotos`, Storage
  `/object/sign/order-photos`); the bucket stays private and the browser only sees those short links. If signing
  fails, the cards show "Photo can't be shown right now" and the invoice still loads.
- Status: **applied and tested on staging 2026-11-13** (rehearsal + `tests/website_invoice_condition_test.sql`, undo
  rehearsed: it restores the old md5). Production: run `website_invoice_condition.sql` with the owner's approval;
  undo `website_invoice_condition.down.sql`. The page works before and after (no `condition` → no section).
- `/i/preview0` shows the section with example data (one site photo, not a customer's).

## Who the invoice is for (`website_invoice_customer.sql`, owner 2026-11-13)

The owner: the invoice showed no customer details (only "For Afiq"). Owner's choice: the **full name, the phone with
its middle hidden and the area** — a "Billed to" block under the heading. Never the full phone or the house address:
the link opens without sign-in, and an SMS or WhatsApp can be forwarded.

- `website_invoice_get()` gains `customer: { name, phone, area }`: name = `customers.name` (else the order's name),
  ≤60 characters; phone = the order's phone as `017•••••123`, only for a valid mobile (the full number never leaves
  the database); area = the order's zone + "Sector N" when the address names a sector.
- The page drops anything that is not a masked phone (`invoiceCustomer`).
- Status: rehearsed (`tests/website_invoice_customer_test.sql`), applied to staging, undo rehearsed (restores the
  condition body, md5 `2024b9a5…`). Production: `website_invoice_customer.sql` with the owner's approval.
