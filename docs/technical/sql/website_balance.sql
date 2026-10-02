-- Velto Balance: customers keep laundry money with Velto and orders are paid from it.
--
--   Top-up    a regular customer (3+ delivered orders) asks to add ৳1,000 / ৳2,000 on their account,
--             pays by bKash / Nagad / cash, and a manager confirms the money arrived. The top-up adds
--             the paid money (cash) and Velto's bonus (bonus, 12 months) as separate lines.
--   Spend     on the Command Center, staff pay an order from the balance in one click. That writes
--             an ordinary Velto Ops payment (method 'Velto Balance'), so Ops' own trigger marks the
--             order Paid / Partial. No Ops function changes.
--   Refund    only paid money is refunded; bonus is not.
--
-- The ledger is append-only: the balance is the sum of its lines and never an editable number.
-- Spending uses bonus first, then paid money. Bonus expires 12 months after it was given: the bonus
-- still spendable is min(bonus balance, bonus given in the last 12 months); the rest is written off
-- by an 'expire' line the next time the balance changes.
--
-- Customers: portal_balance, portal_balance_request, portal_balance_cancel (their own account).
-- Command Center (service role): website_balance_overview, website_balance_for_phones,
--   website_balance_customer, website_balance_topup, website_balance_reject, website_balance_spend,
--   website_balance_reverse, website_balance_refund, website_balance_adjust.
-- Offer settings live in website_content key 'balance' (tiers, min orders, on/off).
-- Requires customer_portal.sql and Velto Ops' orders / payments / customers. Idempotent.
-- Status: staging only. Production waits for the Ops owner ("Velto Balance" payment method) and the
-- accountant (prepaid / VAT) to agree.

begin;

-------------------------------------------------------------------------------
-- Tables
-------------------------------------------------------------------------------

create table if not exists public.website_balance_ledger (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid not null references public.customers (id) on delete restrict,
  kind            text not null check (kind in ('topup', 'bonus', 'spend', 'refund', 'adjust', 'expire', 'reverse')),
  -- Change to the customer's paid money and to their bonus (each line moves one or both).
  cash            numeric(12,2) not null default 0,
  bonus           numeric(12,2) not null default 0,
  order_id        uuid references public.orders (id) on delete set null,
  order_number    text,
  payment_id      uuid,
  method          text check (method is null or method in ('bkash', 'nagad', 'cash', 'bank', 'balance')),
  reference       text check (reference is null or char_length(reference) <= 80),
  request_id      uuid,
  reverses        uuid references public.website_balance_ledger (id),
  note            text check (note is null or char_length(note) <= 300),
  actor           text not null check (char_length(btrim(actor)) between 1 and 120),
  dedupe_key      text unique check (dedupe_key is null or dedupe_key ~ '^[A-Za-z0-9._:-]{8,128}$'),
  created_at      timestamptz not null default now(),
  check (cash <> 0 or bonus <> 0)
);

comment on table public.website_balance_ledger is
  'Velto Balance: append-only money lines per Ops customer (cash = paid money, bonus = Velto''s extra). Balance = sum.';

create index if not exists website_balance_ledger_customer_idx on public.website_balance_ledger (customer_id, created_at);
create index if not exists website_balance_ledger_order_idx on public.website_balance_ledger (order_id) where order_id is not null;
create unique index if not exists website_balance_ledger_reverses_idx on public.website_balance_ledger (reverses) where reverses is not null;

create table if not exists public.website_balance_requests (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid not null references auth.users (id) on delete cascade,
  customer_id   uuid not null references public.customers (id) on delete cascade,
  name          text not null,
  phone         text not null check (phone ~ '^01[3-9][0-9]{8}$'),
  amount        integer not null check (amount between 100 and 50000),
  method        text not null check (method in ('bkash', 'nagad', 'cash')),
  status        text not null default 'requested' check (status in ('requested', 'confirmed', 'rejected', 'cancelled')),
  reason        text check (reason is null or char_length(reason) <= 300),
  decided_by    text,
  decided_at    timestamptz,
  created_at    timestamptz not null default now()
);

create unique index if not exists website_balance_requests_open_idx on public.website_balance_requests (customer_id) where status = 'requested';
create index if not exists website_balance_requests_requested_idx on public.website_balance_requests (created_at) where status = 'requested';

alter table public.website_balance_ledger enable row level security;
alter table public.website_balance_requests enable row level security;
revoke all on table public.website_balance_ledger from public, anon, authenticated;
revoke all on table public.website_balance_requests from public, anon, authenticated;

-------------------------------------------------------------------------------
-- Helpers
-------------------------------------------------------------------------------

-- The offer, from website_content 'balance' (Command Center), with safe defaults.
create or replace function public.website_balance_settings()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'enabled', coalesce((v ->> 'enabled')::boolean, false),
    'minOrders', greatest(1, least(coalesce((v ->> 'minOrders')::int, 3), 50)),
    'bonusMonths', greatest(1, least(coalesce((v ->> 'bonusMonths')::int, 12), 36)),
    'tiers', coalesce(
      (select jsonb_agg(jsonb_build_object('pay', (t ->> 'pay')::int, 'bonus', greatest(0, (t ->> 'bonus')::int)) order by (t ->> 'pay')::int)
         from jsonb_array_elements(case when jsonb_typeof(v -> 'tiers') = 'array' then v -> 'tiers' else '[]'::jsonb end) t
        where (t ->> 'pay') ~ '^\d{3,5}$' and coalesce(t ->> 'bonus', '0') ~ '^\d{1,4}$'),
      '[{"pay":1000,"bonus":50},{"pay":2000,"bonus":150}]'::jsonb))
  from (select coalesce((select value from public.website_content where key = 'balance'), '{}'::jsonb) as v) s;
$$;

-- Velto's bonus for a top-up: the largest tier the amount reaches.
create or replace function public.website_balance_bonus_for(p_amount numeric)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select (t ->> 'bonus')::numeric
                     from jsonb_array_elements(public.website_balance_settings() -> 'tiers') t
                    where (t ->> 'pay')::numeric <= p_amount
                    order by (t ->> 'pay')::numeric desc limit 1), 0);
$$;

-- Paid money, live bonus and what has expired, for one customer.
create or replace function public.website_balance_of(p_customer uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with l as (
    select coalesce(sum(cash), 0) as cash, coalesce(sum(bonus), 0) as bonus,
           -- Bonus given within the offer period (top-up bonus, goodwill). Spending eats the oldest
           -- bonus first, so whatever is left above this amount is older than the period.
           coalesce(sum(bonus) filter (where kind in ('bonus', 'adjust') and bonus > 0
             and created_at > now() - make_interval(months => (public.website_balance_settings() ->> 'bonusMonths')::int)), 0) as fresh
      from public.website_balance_ledger where customer_id = p_customer
  )
  select jsonb_build_object(
    'cash', cash,
    'bonus', greatest(0, least(bonus, fresh)),
    'expired', greatest(0, bonus - fresh),
    'available', cash + greatest(0, least(bonus, fresh)))
  from l;
$$;

-- Delivered orders for a customer (the offer is for regulars).
create or replace function public.website_balance_delivered(p_customer uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int from public.orders where customer_id = p_customer and order_status = 'Delivered';
$$;

-- Serialise all balance changes for one customer, and write off expired bonus first.
create or replace function public.website_balance_lock(p_customer uuid, p_actor text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('velto_balance:' || p_customer::text, 0));
  v := public.website_balance_of(p_customer);
  if (v ->> 'expired')::numeric > 0 then
    insert into public.website_balance_ledger (customer_id, kind, bonus, note, actor)
    values (p_customer, 'expire', -(v ->> 'expired')::numeric, 'Bonus older than the offer period', left(coalesce(p_actor, 'system'), 120));
    v := public.website_balance_of(p_customer);
  end if;
  return v;
end;
$$;

create or replace function public.website_balance_line_json(l public.website_balance_ledger)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('id', l.id, 'kind', l.kind, 'cash', l.cash, 'bonus', l.bonus, 'amount', l.cash + l.bonus,
    'orderNumber', l.order_number, 'method', l.method, 'reference', l.reference, 'note', l.note,
    'reversed', exists (select 1 from public.website_balance_ledger r where r.reverses = l.id),
    'actor', l.actor, 'at', l.created_at);
$$;

-------------------------------------------------------------------------------
-- Customers (authenticated, own linked Ops customer only)
-------------------------------------------------------------------------------

create or replace function public.portal_balance()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_acc public.customer_accounts;
  v_set jsonb := public.website_balance_settings();
  v_bal jsonb;
  v_orders int;
  v_usual numeric;
  v_req public.website_balance_requests;
begin
  v_acc := public.portal_caller();
  if v_acc.customer_id is null or v_acc.link_status <> 'linked' then return null; end if;
  v_bal := public.website_balance_of(v_acc.customer_id);
  v_orders := public.website_balance_delivered(v_acc.customer_id);
  -- Their usual order: the median of the last 6 delivered (an estimate for "about N orders").
  select percentile_cont(0.5) within group (order by total_amount) into v_usual
    from (select total_amount from public.orders
           where customer_id = v_acc.customer_id and order_status = 'Delivered' and total_amount > 0
           order by order_date desc limit 6) o;
  select * into v_req from public.website_balance_requests
   where customer_id = v_acc.customer_id and (status = 'requested' or (status = 'rejected' and decided_at > now() - interval '14 days'))
   order by (status = 'requested') desc, created_at desc limit 1;
  return jsonb_build_object(
    'enabled', (v_set ->> 'enabled')::boolean,
    'eligible', v_orders >= (v_set ->> 'minOrders')::int,
    'deliveredOrders', v_orders,
    'minOrders', (v_set ->> 'minOrders')::int,
    'tiers', v_set -> 'tiers',
    'bonusMonths', (v_set ->> 'bonusMonths')::int,
    'cash', (v_bal ->> 'cash')::numeric,
    'bonus', (v_bal ->> 'bonus')::numeric,
    'available', (v_bal ->> 'available')::numeric,
    'usualOrder', round(coalesce(v_usual, 0)),
    'request', case when v_req.id is null then null else jsonb_build_object(
      'id', v_req.id, 'amount', v_req.amount, 'method', v_req.method, 'status', v_req.status, 'reason', v_req.reason, 'at', v_req.created_at) end,
    'history', coalesce((select jsonb_agg(public.website_balance_line_json(l) order by l.created_at desc)
                           from (select * from public.website_balance_ledger where customer_id = v_acc.customer_id
                                  order by created_at desc limit 20) l), '[]'::jsonb));
end;
$$;

-- Ask to add money (one of the offer amounts). Staff confirm when the money arrives.
create or replace function public.portal_balance_request(p_amount integer, p_method text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_acc public.customer_accounts;
  v_set jsonb := public.website_balance_settings();
  v_row public.website_balance_requests;
begin
  v_acc := public.portal_caller();
  if v_acc.customer_id is null or v_acc.link_status <> 'linked' then return jsonb_build_object('ok', false, 'error', 'not_linked'); end if;
  if not (v_set ->> 'enabled')::boolean then return jsonb_build_object('ok', false, 'error', 'off'); end if;
  if public.website_balance_delivered(v_acc.customer_id) < (v_set ->> 'minOrders')::int
     and (public.website_balance_of(v_acc.customer_id) ->> 'available')::numeric <= 0 then
    return jsonb_build_object('ok', false, 'error', 'not_eligible');
  end if;
  if p_method is null or p_method not in ('bkash', 'nagad', 'cash')
     or not exists (select 1 from jsonb_array_elements(v_set -> 'tiers') t where (t ->> 'pay')::int = p_amount) then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  select * into v_row from public.website_balance_requests where customer_id = v_acc.customer_id and status = 'requested' for update;
  if v_row.id is not null then
    update public.website_balance_requests set amount = p_amount, method = p_method, created_at = now() where id = v_row.id returning * into v_row;
  else
    insert into public.website_balance_requests (auth_user_id, customer_id, name, phone, amount, method)
    values (v_acc.auth_user_id, v_acc.customer_id, coalesce(nullif(btrim(v_acc.full_name), ''), 'Customer'),
            coalesce(v_acc.verified_phone, v_acc.phone), p_amount, p_method)
    returning * into v_row;
  end if;
  return jsonb_build_object('ok', true, 'id', v_row.id);
exception when check_violation then
  return jsonb_build_object('ok', false, 'error', 'invalid');
end;
$$;

create or replace function public.portal_balance_cancel()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_acc public.customer_accounts;
begin
  v_acc := public.portal_caller();
  if v_acc.customer_id is null then return jsonb_build_object('ok', false, 'error', 'not_linked'); end if;
  update public.website_balance_requests set status = 'cancelled', decided_at = now(), decided_by = 'customer'
   where customer_id = v_acc.customer_id and status = 'requested';
  return jsonb_build_object('ok', true);
end;
$$;

-------------------------------------------------------------------------------
-- Command Center (service role)
-------------------------------------------------------------------------------

-- Open requests, every customer with money in their balance, and the totals Velto holds.
create or replace function public.website_balance_overview()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with per as (
    select l.customer_id, public.website_balance_of(l.customer_id) as b, max(l.created_at) as last_at
      from public.website_balance_ledger l group by l.customer_id
  ), month as (
    select coalesce(sum(cash) filter (where kind = 'topup'), 0) as topups,
           coalesce(sum(bonus) filter (where kind = 'bonus'), 0) as bonuses,
           coalesce(-sum(cash + bonus) filter (where kind = 'spend'), 0) - coalesce(sum(cash + bonus) filter (where kind = 'reverse'), 0) as spent,
           coalesce(-sum(cash) filter (where kind = 'refund'), 0) as refunded
      from public.website_balance_ledger
     where created_at >= date_trunc('month', now() at time zone 'Asia/Dhaka') at time zone 'Asia/Dhaka'
  )
  select jsonb_build_object(
    'settings', public.website_balance_settings(),
    'requests', coalesce((select jsonb_agg(jsonb_build_object(
        'id', r.id, 'customerId', r.customer_id, 'name', r.name, 'phone', r.phone, 'amount', r.amount, 'method', r.method,
        'bonus', public.website_balance_bonus_for(r.amount), 'at', r.created_at,
        'available', (public.website_balance_of(r.customer_id) ->> 'available')::numeric) order by r.created_at)
      from public.website_balance_requests r where r.status = 'requested'), '[]'::jsonb),
    'customers', coalesce((select jsonb_agg(jsonb_build_object(
        'customerId', p.customer_id, 'name', c.name, 'phone', c.phone, 'cash', (p.b ->> 'cash')::numeric,
        'bonus', (p.b ->> 'bonus')::numeric, 'available', (p.b ->> 'available')::numeric, 'lastAt', p.last_at)
        order by (p.b ->> 'available')::numeric desc)
      from per p join public.customers c on c.id = p.customer_id where (p.b ->> 'available')::numeric > 0), '[]'::jsonb),
    'totals', jsonb_build_object(
      'cash', coalesce((select sum((b ->> 'cash')::numeric) from per), 0),
      'bonus', coalesce((select sum((b ->> 'bonus')::numeric) from per), 0),
      'customers', (select count(*) from per where (b ->> 'available')::numeric > 0)),
    'month', (select to_jsonb(month) from month));
$$;

-- Available balance per phone (01XXXXXXXXX), for the booking cards. {} for unknown phones.
create or replace function public.website_balance_for_phones(p_phones text[])
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(c.phone, (public.website_balance_of(c.id) ->> 'available')::numeric), '{}'::jsonb)
    from public.customers c
   where c.phone = any (p_phones[1:200])
     and exists (select 1 from public.website_balance_ledger l where l.customer_id = c.id);
$$;

-- One customer (by Ops id or phone): balance and their last 50 lines.
create or replace function public.website_balance_customer(p_customer uuid, p_phone text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_c public.customers;
begin
  if p_customer is not null then select * into v_c from public.customers where id = p_customer;
  elsif p_phone ~ '^01[3-9][0-9]{8}$' then select * into v_c from public.customers where phone = p_phone order by created_at limit 1;
  end if;
  if v_c.id is null then return null; end if;
  return jsonb_build_object('customerId', v_c.id, 'name', v_c.name, 'phone', v_c.phone,
    'deliveredOrders', public.website_balance_delivered(v_c.id),
    'balance', public.website_balance_of(v_c.id),
    'history', coalesce((select jsonb_agg(public.website_balance_line_json(l) order by l.created_at desc)
                           from (select * from public.website_balance_ledger where customer_id = v_c.id order by created_at desc limit 50) l), '[]'::jsonb));
end;
$$;

-- Money arrived: add it (and Velto's bonus) to the balance. From a request, or at the counter.
create or replace function public.website_balance_topup(
  p_request uuid, p_customer uuid, p_amount numeric, p_method text, p_reference text, p_actor text, p_dedupe text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_req public.website_balance_requests;
  v_customer uuid := p_customer;
  v_bonus numeric;
  v_line public.website_balance_ledger;
begin
  if p_dedupe is not null and exists (select 1 from public.website_balance_ledger where dedupe_key = p_dedupe) then
    return jsonb_build_object('ok', true, 'existing', true);
  end if;
  if p_request is not null then
    select * into v_req from public.website_balance_requests where id = p_request for update;
    if v_req.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
    if v_req.status <> 'requested' then return jsonb_build_object('ok', false, 'error', 'closed'); end if;
    v_customer := v_req.customer_id;
  end if;
  if v_customer is null or not exists (select 1 from public.customers where id = v_customer) then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if p_amount is null or p_amount < 100 or p_amount > 50000 or p_amount <> round(p_amount)
     or p_method is null or p_method not in ('bkash', 'nagad', 'cash', 'bank')
     or p_actor is null or btrim(p_actor) = '' then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  if p_method in ('bkash', 'nagad', 'bank') and nullif(btrim(coalesce(p_reference, '')), '') is null then
    return jsonb_build_object('ok', false, 'error', 'reference');
  end if;

  perform public.website_balance_lock(v_customer, p_actor);
  v_bonus := public.website_balance_bonus_for(p_amount);
  insert into public.website_balance_ledger (customer_id, kind, cash, method, reference, request_id, actor, dedupe_key)
  values (v_customer, 'topup', p_amount, p_method, left(nullif(btrim(coalesce(p_reference, '')), ''), 80), p_request, left(btrim(p_actor), 120), p_dedupe)
  returning * into v_line;
  if v_bonus > 0 then
    insert into public.website_balance_ledger (customer_id, kind, bonus, request_id, note, actor)
    values (v_customer, 'bonus', v_bonus, p_request, 'Top-up bonus for ৳' || p_amount::int, left(btrim(p_actor), 120));
  end if;
  if v_req.id is not null then
    update public.website_balance_requests set status = 'confirmed', decided_by = left(btrim(p_actor), 120), decided_at = now(), amount = p_amount::int
     where id = v_req.id;
  end if;
  return jsonb_build_object('ok', true, 'customerId', v_customer, 'paid', p_amount, 'bonus', v_bonus,
    'balance', public.website_balance_of(v_customer));
end;
$$;

create or replace function public.website_balance_reject(p_request uuid, p_reason text, p_actor text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.website_balance_requests
     set status = 'rejected', reason = left(nullif(btrim(coalesce(p_reason, '')), ''), 300), decided_by = left(btrim(coalesce(p_actor, '')), 120), decided_at = now()
   where id = p_request and status = 'requested';
  if not found then return jsonb_build_object('ok', false, 'error', 'closed'); end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- Pay an Ops order from the customer's balance: up to what is due and what is available
-- (p_amount null = as much as possible). Bonus first, then paid money. One Ops payment row.
create or replace function public.website_balance_spend(p_order_number text, p_amount numeric, p_actor text, p_dedupe text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_bal jsonb;
  v_due numeric;
  v_amount numeric;
  v_from_bonus numeric;
  v_payment uuid;
begin
  if p_dedupe is not null and exists (select 1 from public.website_balance_ledger where dedupe_key = p_dedupe) then
    return jsonb_build_object('ok', true, 'existing', true);
  end if;
  if p_actor is null or btrim(p_actor) = '' then return jsonb_build_object('ok', false, 'error', 'invalid'); end if;
  select * into v_order from public.orders where order_number = btrim(coalesce(p_order_number, '')) for update;
  if v_order.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if v_order.customer_id is null then return jsonb_build_object('ok', false, 'error', 'no_customer'); end if;
  if v_order.order_status = 'Cancelled' then return jsonb_build_object('ok', false, 'error', 'cancelled'); end if;

  v_bal := public.website_balance_lock(v_order.customer_id, p_actor);
  v_due := greatest(0, coalesce(v_order.total_amount, 0) - coalesce(v_order.amount_paid, 0));
  v_amount := least(v_due, (v_bal ->> 'available')::numeric, coalesce(p_amount, v_due));
  if v_due <= 0 then return jsonb_build_object('ok', false, 'error', 'nothing_due'); end if;
  if (v_bal ->> 'available')::numeric <= 0 then return jsonb_build_object('ok', false, 'error', 'no_balance'); end if;
  if v_amount is null or v_amount <= 0 then return jsonb_build_object('ok', false, 'error', 'invalid'); end if;
  v_from_bonus := least(v_amount, (v_bal ->> 'bonus')::numeric);

  insert into public.payments (order_id, amount, method, received_by, paid_at, note)
  values (v_order.id, v_amount, 'Velto Balance', left(btrim(p_actor), 120), (now() at time zone 'Asia/Dhaka')::date,
          'Paid from Velto Balance (website)')
  returning id into v_payment;
  insert into public.website_balance_ledger (customer_id, kind, cash, bonus, order_id, order_number, payment_id, method, actor, dedupe_key)
  values (v_order.customer_id, 'spend', -(v_amount - v_from_bonus), -v_from_bonus, v_order.id, v_order.order_number, v_payment,
          'balance', left(btrim(p_actor), 120), p_dedupe);
  select * into v_order from public.orders where id = v_order.id;
  return jsonb_build_object('ok', true, 'paid', v_amount, 'fromBonus', v_from_bonus,
    'orderDue', v_order.due, 'orderStatus', v_order.payment_status, 'balance', public.website_balance_of(v_order.customer_id));
end;
$$;

-- Undo a spend (wrong order): remove the Ops payment it made and give the money back.
-- Or undo a top-up (money didn't arrive): only while that money is still in the balance.
create or replace function public.website_balance_reverse(p_line uuid, p_reason text, p_actor text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_line public.website_balance_ledger;
  v_bonus public.website_balance_ledger;
  v_bal jsonb;
begin
  if p_actor is null or btrim(p_actor) = '' or nullif(btrim(coalesce(p_reason, '')), '') is null then
    return jsonb_build_object('ok', false, 'error', 'reason');
  end if;
  select * into v_line from public.website_balance_ledger where id = p_line;
  if v_line.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if v_line.kind not in ('spend', 'topup') then return jsonb_build_object('ok', false, 'error', 'invalid'); end if;
  v_bal := public.website_balance_lock(v_line.customer_id, p_actor);
  if exists (select 1 from public.website_balance_ledger where reverses = v_line.id) then
    return jsonb_build_object('ok', false, 'error', 'already');
  end if;

  if v_line.kind = 'spend' then
    delete from public.payments where id = v_line.payment_id and method = 'Velto Balance';
    insert into public.website_balance_ledger (customer_id, kind, cash, bonus, order_id, order_number, reverses, note, actor)
    values (v_line.customer_id, 'reverse', -v_line.cash, -v_line.bonus, v_line.order_id, v_line.order_number, v_line.id,
            left(btrim(p_reason), 300), left(btrim(p_actor), 120));
  else
    -- The bonus written with this top-up (same transaction, so the same created_at).
    select b.* into v_bonus from public.website_balance_ledger b
     where b.kind = 'bonus' and b.customer_id = v_line.customer_id and b.created_at = v_line.created_at
       and not exists (select 1 from public.website_balance_ledger r where r.reverses = b.id)
     limit 1;
    if (v_bal ->> 'cash')::numeric < v_line.cash or (v_bal ->> 'bonus')::numeric < coalesce(v_bonus.bonus, 0) then
      return jsonb_build_object('ok', false, 'error', 'spent');
    end if;
    insert into public.website_balance_ledger (customer_id, kind, cash, reverses, note, actor)
    values (v_line.customer_id, 'reverse', -v_line.cash, v_line.id, left(btrim(p_reason), 300), left(btrim(p_actor), 120));
    if v_bonus.id is not null then
      insert into public.website_balance_ledger (customer_id, kind, bonus, reverses, note, actor)
      values (v_line.customer_id, 'reverse', -v_bonus.bonus, v_bonus.id, left(btrim(p_reason), 300), left(btrim(p_actor), 120));
    end if;
  end if;
  return jsonb_build_object('ok', true, 'balance', public.website_balance_of(v_line.customer_id));
end;
$$;

-- Give paid money back to the customer (bonus is never refunded).
create or replace function public.website_balance_refund(p_customer uuid, p_amount numeric, p_method text, p_reference text, p_actor text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bal jsonb;
begin
  if p_customer is null or p_amount is null or p_amount <= 0 or p_method is null or p_method not in ('bkash', 'nagad', 'cash', 'bank')
     or p_actor is null or btrim(p_actor) = '' then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  v_bal := public.website_balance_lock(p_customer, p_actor);
  if p_amount > (v_bal ->> 'cash')::numeric then return jsonb_build_object('ok', false, 'error', 'too_much', 'cash', v_bal -> 'cash'); end if;
  insert into public.website_balance_ledger (customer_id, kind, cash, method, reference, actor)
  values (p_customer, 'refund', -p_amount, p_method, left(nullif(btrim(coalesce(p_reference, '')), ''), 80), left(btrim(p_actor), 120));
  return jsonb_build_object('ok', true, 'balance', public.website_balance_of(p_customer));
end;
$$;

-- A correction by an admin (goodwill credit, a mistake): bonus money only, with a reason.
create or replace function public.website_balance_adjust(p_customer uuid, p_amount numeric, p_reason text, p_actor text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bal jsonb;
begin
  if p_customer is null or p_amount is null or p_amount = 0 or abs(p_amount) > 5000 or p_amount <> round(p_amount)
     or nullif(btrim(coalesce(p_reason, '')), '') is null or p_actor is null or btrim(p_actor) = ''
     or not exists (select 1 from public.customers where id = p_customer) then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  v_bal := public.website_balance_lock(p_customer, p_actor);
  if p_amount < 0 and -p_amount > (v_bal ->> 'bonus')::numeric then return jsonb_build_object('ok', false, 'error', 'too_much'); end if;
  insert into public.website_balance_ledger (customer_id, kind, bonus, note, actor)
  values (p_customer, 'adjust', p_amount, left(btrim(p_reason), 300), left(btrim(p_actor), 120));
  return jsonb_build_object('ok', true, 'balance', public.website_balance_of(p_customer));
end;
$$;

-------------------------------------------------------------------------------
-- Grants
-------------------------------------------------------------------------------

revoke all on function public.website_balance_settings() from public, anon, authenticated;
revoke all on function public.website_balance_bonus_for(numeric) from public, anon, authenticated;
revoke all on function public.website_balance_of(uuid) from public, anon, authenticated;
revoke all on function public.website_balance_delivered(uuid) from public, anon, authenticated;
revoke all on function public.website_balance_lock(uuid, text) from public, anon, authenticated;
revoke all on function public.website_balance_line_json(public.website_balance_ledger) from public, anon, authenticated;
revoke all on function public.portal_balance() from public, anon;
revoke all on function public.portal_balance_request(integer, text) from public, anon;
revoke all on function public.portal_balance_cancel() from public, anon;
revoke all on function public.website_balance_overview() from public, anon, authenticated;
revoke all on function public.website_balance_for_phones(text[]) from public, anon, authenticated;
revoke all on function public.website_balance_customer(uuid, text) from public, anon, authenticated;
revoke all on function public.website_balance_topup(uuid, uuid, numeric, text, text, text, text) from public, anon, authenticated;
revoke all on function public.website_balance_reject(uuid, text, text) from public, anon, authenticated;
revoke all on function public.website_balance_spend(text, numeric, text, text) from public, anon, authenticated;
revoke all on function public.website_balance_reverse(uuid, text, text) from public, anon, authenticated;
revoke all on function public.website_balance_refund(uuid, numeric, text, text, text) from public, anon, authenticated;
revoke all on function public.website_balance_adjust(uuid, numeric, text, text) from public, anon, authenticated;

grant execute on function public.portal_balance() to authenticated;
grant execute on function public.portal_balance_request(integer, text) to authenticated;
grant execute on function public.portal_balance_cancel() to authenticated;
grant execute on function public.website_balance_overview() to service_role;
grant execute on function public.website_balance_for_phones(text[]) to service_role;
grant execute on function public.website_balance_customer(uuid, text) to service_role;
grant execute on function public.website_balance_topup(uuid, uuid, numeric, text, text, text, text) to service_role;
grant execute on function public.website_balance_reject(uuid, text, text) to service_role;
grant execute on function public.website_balance_spend(text, numeric, text, text) to service_role;
grant execute on function public.website_balance_reverse(uuid, text, text) to service_role;
grant execute on function public.website_balance_refund(uuid, numeric, text, text, text) to service_role;
grant execute on function public.website_balance_adjust(uuid, numeric, text, text) to service_role;

commit;
