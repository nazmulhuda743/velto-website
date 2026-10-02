-- Invoice links (docs/technical/INVOICES.md).
--
--   one order → one link: www.velto.com.bd/bn/i/<8-character code>
--     website_invoice_list()   Admin → Invoices: recent orders with their link (made on first view)
--     website_invoice_sent()   staff opened WhatsApp with the message for this order
--     website_invoice_get()    the invoice page: what the customer may see by link
--
-- The page opens without sign-in, so it never shows the phone, the address or the full name:
-- only the first name, the order, its items and prices, and the payments. A link works for 120
-- days after the order; after that the order is in the customer's account only. Signing in with
-- the same number (SMS code, Welcome back) puts every order in the account: portal_orders().
--
-- Requires customer_portal.sql and website_identity_claim.sql (portal_first_name). Idempotent.
-- Every function is service_role only: the website calls them on the server.

create table if not exists public.website_invoice_links (
  code         text primary key check (code ~ '^[A-Za-z0-9_-]{8}$'),
  order_id     uuid not null unique references public.orders (id) on delete cascade,
  created_at   timestamptz not null default now(),
  sent_at      timestamptz,
  sent_by      text check (sent_by is null or char_length(sent_by) <= 120),
  sent_count   integer not null default 0,
  opened_at    timestamptz,
  open_count   integer not null default 0
);

comment on table public.website_invoice_links is
  'One unguessable invoice link per Ops order, sent by staff on WhatsApp. The website reads it on the server only.';

alter table public.website_invoice_links enable row level security;
revoke all on table public.website_invoice_links from public, anon, authenticated, service_role;

-- A fresh code for an order (or its existing one).
create or replace function public.website_invoice_code(p_order uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  select code into v_code from public.website_invoice_links where order_id = p_order;
  if v_code is not null then
    return v_code;
  end if;
  loop
    v_code := translate(encode(extensions.gen_random_bytes(6), 'base64'), '+/', '-_');
    begin
      insert into public.website_invoice_links (code, order_id) values (v_code, p_order)
      on conflict (order_id) do nothing;
      select code into v_code from public.website_invoice_links where order_id = p_order;
      return v_code;
    exception when unique_violation then
      -- the same code was drawn for another order: draw again
    end;
  end loop;
end;
$$;

-- Admin → Invoices. p_search: an order number (VEL-01234 or 01234) or a phone number.
create or replace function public.website_invoice_list(p_days integer default 3, p_search text default null, p_limit integer default 150)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
  v_digits text := regexp_replace(coalesce(p_search, ''), '[^0-9]', '', 'g');
  v_phone  text;
  v_ids    uuid[];
begin
  v_phone := case when v_digits ~ '^(?:88)?01[3-9][0-9]{8}$' then right(v_digits, 11) end;
  select coalesce(array_agg(id), '{}') into v_ids from (
    select o.id from public.orders o
    left join public.customers c on c.id = o.customer_id
    where case
      when v_phone is not null then right(regexp_replace(coalesce(c.phone, o.phone_snapshot, ''), '[^0-9]', '', 'g'), 11) = v_phone
                                 or right(regexp_replace(coalesce(c.whatsapp, ''), '[^0-9]', '', 'g'), 11) = v_phone
      when v_search is not null then o.order_number ilike '%' || v_search || '%'
      else o.created_at >= now() - make_interval(days => least(greatest(coalesce(p_days, 3), 1), 31))
    end
    order by o.created_at desc
    limit least(greatest(coalesce(p_limit, 150), 1), 300)
  ) x;

  perform public.website_invoice_code(i) from unnest(v_ids) i;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'orderNumber', o.order_number,
      'code', l.code,
      'name', coalesce(c.name, o.name_snapshot),
      'phone', coalesce(c.phone, o.phone_snapshot),
      'whatsapp', nullif(btrim(coalesce(c.whatsapp, '')), ''),
      'status', o.order_status,
      'orderDate', o.order_date,
      'createdAt', o.created_at,
      'total', o.total_amount,
      'due', greatest(coalesce(o.due, o.total_amount - o.amount_paid), 0),
      'hasAccount', exists (select 1 from public.customer_accounts a where a.customer_id = o.customer_id and a.link_status = 'linked'),
      'sentAt', l.sent_at,
      'sentCount', l.sent_count,
      'openedAt', l.opened_at,
      'openCount', l.open_count
    ) order by o.created_at desc)
    from public.orders o
    join public.website_invoice_links l on l.order_id = o.id
    left join public.customers c on c.id = o.customer_id
    where o.id = any (v_ids)
  ), '[]'::jsonb);
end;
$$;

-- Staff opened WhatsApp with this order's message (the send itself happens in WhatsApp).
create or replace function public.website_invoice_sent(p_code text, p_by text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_code is null or p_code !~ '^[A-Za-z0-9_-]{8}$' then
    return false;
  end if;
  update public.website_invoice_links
     set sent_at = now(), sent_by = left(btrim(coalesce(p_by, '')), 120), sent_count = sent_count + 1
   where code = p_code;
  return found;
end;
$$;

-- The invoice page. Records the open. Never returns the phone, the address or the full name.
create or replace function public.website_invoice_get(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  l public.website_invoice_links;
  o public.orders;
begin
  if p_code is null or p_code !~ '^[A-Za-z0-9_-]{8}$' then
    return jsonb_build_object('ok', false, 'reason', 'unknown');
  end if;
  select * into l from public.website_invoice_links where code = p_code;
  if l.code is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown');
  end if;
  select * into o from public.orders where id = l.order_id;
  if o.id is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown');
  end if;
  update public.website_invoice_links
     set opened_at = coalesce(opened_at, now()), open_count = open_count + 1
   where code = p_code;
  if coalesce(o.order_date, o.created_at::date) < current_date - 120 then
    return jsonb_build_object('ok', false, 'reason', 'expired', 'orderNumber', o.order_number);
  end if;
  return jsonb_build_object('ok', true) || public.portal_order_json(o) || jsonb_build_object(
    'firstName', public.portal_first_name((select c.name from public.customers c where c.id = o.customer_id)),
    'expressFee', coalesce(o.express_fee, 0),
    'lines', coalesce((
      select jsonb_agg(jsonb_build_object(
        'item', i.item_name,
        'service', i.service_category,
        'quantity', i.quantity,
        'price', coalesce(i.quoted_price, i.reference_price)
      ) order by i.created_at)
      from public.order_items i where i.order_id = o.id
    ), '[]'::jsonb),
    'payments', coalesce((
      select jsonb_agg(jsonb_build_object('amount', p.amount, 'method', p.method, 'on', p.paid_at) order by p.paid_at, p.created_at)
      from public.payments p where p.order_id = o.id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.website_invoice_code(uuid) from public, anon, authenticated, service_role;
revoke all on function public.website_invoice_list(integer, text, integer) from public, anon, authenticated;
revoke all on function public.website_invoice_sent(text, text) from public, anon, authenticated;
revoke all on function public.website_invoice_get(text) from public, anon, authenticated;
grant execute on function public.website_invoice_list(integer, text, integer) to service_role;
grant execute on function public.website_invoice_sent(text, text) to service_role;
grant execute on function public.website_invoice_get(text) to service_role;
