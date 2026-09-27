-- Monthly goal → next-month coupon ("spend ৳X this month, get Y next month").
--
-- The ladder (spend thresholds and rewards) is the owner's decision, set in the admin (Loyalty →
-- Monthly goal) and stored in website_content.loyalty.goal; nothing here decides amounts. This
-- file only counts, issues and records:
--   * portal_goal(): the signed-in customer's spend this Dhaka month, from their own Velto orders
--     (cancelled ones excluded), and their coupons that are still valid.
--   * website_goal_settle(month, ladder, double_first): once a month is over, one coupon per
--     customer who reached a rung, valid the whole of the following month. Idempotent: running it
--     again issues nothing twice. Past-due open coupons become 'expired'.
--   * website_goal_coupons() / website_goal_coupon_mark(): the admin's list and "used / void"
--     (Velto staff apply the coupon on the order; the website never touches order totals).
--
-- Same rules as customer_portal.sql: customers reach their own rows only through the
-- security-definer functions (caller = auth.uid(), via portal_caller()); the table has RLS on and
-- no API grants. Requires customer_portal.sql. Idempotent: safe to run again.
-- Status: STAGING only until the owner approves production.

begin;

create table if not exists public.customer_goal_coupons (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references public.customers (id) on delete cascade,
  -- The month the goal was reached, YYYY-MM (Dhaka).
  month         text not null check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  spend         numeric(12,2) not null check (spend >= 0),
  -- 'taka': an amount off one order. 'delivery': free pickup & delivery on every order in the month.
  kind          text not null check (kind in ('taka', 'delivery')),
  amount        integer not null default 0 check (amount between 0 and 100000),
  label         text not null check (char_length(label) between 1 and 120),
  label_bn      text not null default '' check (char_length(label_bn) <= 120),
  code          text not null unique check (code ~ '^VG-[A-Z0-9]{6}$'),
  valid_from    date not null,
  valid_to      date not null,
  status        text not null default 'open' check (status in ('open', 'used', 'void', 'expired')),
  order_number  text check (order_number is null or order_number ~ '^VELR?-[0-9]{3,6}$'),
  used_by       text check (used_by is null or char_length(used_by) <= 120),
  used_at       timestamptz,
  created_at    timestamptz not null default now(),
  check (valid_to >= valid_from),
  unique (customer_id, month)
);

comment on table public.customer_goal_coupons is
  'One coupon per customer per month in which they reached a monthly-goal rung (website_content.loyalty.goal). Velto staff apply it to the order and mark it used.';

create index if not exists customer_goal_coupons_open_idx on public.customer_goal_coupons (status, valid_to);

alter table public.customer_goal_coupons enable row level security;
revoke all on table public.customer_goal_coupons from public, anon, authenticated, service_role;
-- The admin server reads the list through website_goal_coupons(); plain select is for checks and tests.
grant select on table public.customer_goal_coupons to service_role;

-- Dhaka calendar helpers.
create or replace function public.website_goal_month(p_date date)
returns text language sql immutable set search_path = pg_catalog as $$
  select to_char(p_date, 'YYYY-MM')
$$;

-- Spend in one month for a set of customers: every non-cancelled order with a date in the month,
-- the first order counted twice when p_double (the "head start" the account shows).
create or replace function public.website_goal_spend(p_month text, p_double boolean, p_customer uuid default null)
returns table (customer_id uuid, spend numeric, orders integer, first_doubled numeric)
language sql
stable
security definer
set search_path = ''
as $$
  with m as (
    select to_date(p_month || '-01', 'YYYY-MM-DD') as start
  ),
  o as (
    select o.customer_id, o.total_amount, o.order_date, o.created_at
    from public.orders o, m
    where o.customer_id is not null
      and (p_customer is null or o.customer_id = p_customer)
      and o.order_status is distinct from 'Cancelled'
      and o.order_date >= m.start and o.order_date < (m.start + interval '1 month')::date
      and coalesce(o.total_amount, 0) > 0
  ),
  f as (
    select distinct on (customer_id) customer_id, total_amount as first_amount
    from o order by customer_id, order_date, created_at
  )
  select o.customer_id,
         sum(o.total_amount) + case when p_double then coalesce(max(f.first_amount), 0) else 0 end as spend,
         count(*)::integer as orders,
         case when p_double then coalesce(max(f.first_amount), 0) else 0 end as first_doubled
  from o left join f on f.customer_id = o.customer_id
  group by o.customer_id
$$;

-------------------------------------------------------------------------------
-- Customer: this month so far, and the coupons they can use
-------------------------------------------------------------------------------

create or replace function public.portal_goal(p_double boolean default false)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_acc public.customer_accounts;
  v_today date := (now() at time zone 'Asia/Dhaka')::date;
  v_month text := to_char(v_today, 'YYYY-MM');
  v_spend numeric := 0;
  v_orders integer := 0;
  v_first numeric := 0;
begin
  v_acc := public.portal_caller();
  if v_acc.customer_id is null or v_acc.link_status <> 'linked' then
    return jsonb_build_object('linked', false);
  end if;
  select s.spend, s.orders, s.first_doubled into v_spend, v_orders, v_first
    from public.website_goal_spend(v_month, p_double, v_acc.customer_id) s;
  return jsonb_build_object(
    'linked', true,
    'month', v_month,
    'today', v_today,
    'spend', coalesce(v_spend, 0),
    'orders', coalesce(v_orders, 0),
    'firstDoubled', coalesce(v_first, 0),
    'coupons', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'code', c.code, 'kind', c.kind, 'amount', c.amount, 'label', c.label, 'labelBn', c.label_bn,
        'month', c.month, 'validFrom', c.valid_from, 'validTo', c.valid_to, 'status', c.status
      ) order by c.valid_to desc)
      from public.customer_goal_coupons c
      where c.customer_id = v_acc.customer_id
        and ((c.status = 'open' and c.valid_to >= v_today) or (c.status = 'used' and c.used_at > now() - interval '60 days'))
    ), '[]'::jsonb)
  );
end;
$$;

-------------------------------------------------------------------------------
-- Staff (service role): settle a month, list and mark coupons
-------------------------------------------------------------------------------

-- p_ladder: [{ "spend": 800, "kind": "delivery", "amount": 0, "label": "...", "labelBn": "..." }, ...]
-- ascending by spend. Only months that are over can be settled. Returns what happened.
create or replace function public.website_goal_settle(p_month text, p_ladder jsonb, p_double boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Dhaka')::date;
  v_issued integer := 0;
  v_reached integer := 0;
  v_expired integer := 0;
  v_from date;
  v_to date;
  r record;
  rung jsonb;
  v_code text;
begin
  if p_month is null or p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_month');
  end if;
  if p_month >= to_char(v_today, 'YYYY-MM') then
    return jsonb_build_object('ok', false, 'error', 'month_not_over');
  end if;
  if jsonb_typeof(p_ladder) <> 'array' or jsonb_array_length(p_ladder) = 0 then
    return jsonb_build_object('ok', false, 'error', 'no_ladder');
  end if;

  -- Coupons past their last day are closed (their month is over too).
  update public.customer_goal_coupons set status = 'expired' where status = 'open' and valid_to < v_today;
  get diagnostics v_expired = row_count;

  v_from := (to_date(p_month || '-01', 'YYYY-MM-DD') + interval '1 month')::date;
  v_to := (v_from + interval '1 month' - interval '1 day')::date;

  for r in select * from public.website_goal_spend(p_month, p_double) loop
    -- The highest rung this spend reaches.
    select x into rung from jsonb_array_elements(p_ladder) x
     where (x->>'spend')::numeric <= r.spend and (x->>'spend')::numeric > 0
     order by (x->>'spend')::numeric desc limit 1;
    if rung is null then continue; end if;
    v_reached := v_reached + 1;
    if exists (select 1 from public.customer_goal_coupons c where c.customer_id = r.customer_id and c.month = p_month) then
      continue;
    end if;
    -- A short code staff can read out; retried on the rare collision.
    loop
      v_code := 'VG-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
      exit when not exists (select 1 from public.customer_goal_coupons where code = v_code);
    end loop;
    insert into public.customer_goal_coupons (customer_id, month, spend, kind, amount, label, label_bn, code, valid_from, valid_to)
    values (
      r.customer_id, p_month, r.spend,
      case when rung->>'kind' = 'delivery' then 'delivery' else 'taka' end,
      least(100000, greatest(0, coalesce((rung->>'amount')::integer, 0))),
      left(coalesce(nullif(rung->>'label', ''), 'Monthly goal reward'), 120),
      left(coalesce(rung->>'labelBn', ''), 120),
      v_code, v_from, v_to
    );
    v_issued := v_issued + 1;
  end loop;

  return jsonb_build_object('ok', true, 'month', p_month, 'reached', v_reached, 'issued', v_issued, 'expired', v_expired,
                            'validFrom', v_from, 'validTo', v_to);
end;
$$;

-- The admin's list: newest first, with the customer's name and phone (admin server only).
create or replace function public.website_goal_coupons(p_limit integer default 300)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'code', c.code, 'kind', c.kind, 'amount', c.amount, 'label', c.label, 'month', c.month,
    'spend', c.spend, 'validFrom', c.valid_from, 'validTo', c.valid_to, 'status', c.status,
    'orderNumber', c.order_number, 'usedBy', c.used_by, 'usedAt', c.used_at, 'createdAt', c.created_at,
    'customerName', cu.name, 'customerPhone', cu.phone
  ) order by (c.status = 'open') desc, c.created_at desc), '[]'::jsonb)
  from (
    select * from public.customer_goal_coupons order by (status = 'open') desc, created_at desc
    limit least(greatest(coalesce(p_limit, 300), 1), 2000)
  ) c
  left join public.customers cu on cu.id = c.customer_id
$$;

-- Staff applied it to an order (used), withdrew it (void) or reopened it by mistake (open).
create or replace function public.website_goal_coupon_mark(p_id uuid, p_status text, p_order text, p_staff text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer;
begin
  if p_status not in ('used', 'void', 'open') then return false; end if;
  update public.customer_goal_coupons
     set status = p_status,
         order_number = case when p_status = 'used' then nullif(upper(btrim(coalesce(p_order, ''))), '') else order_number end,
         used_by = case when p_status = 'open' then null else left(p_staff, 120) end,
         used_at = case when p_status = 'open' then null else now() end
   where id = p_id and status <> 'expired';
  get diagnostics v_n = row_count;
  return v_n = 1;
end;
$$;

-- Distribution for the admin: how many customers would reach each rung in a month (for setting the ladder).
create or replace function public.website_goal_preview(p_month text, p_ladder jsonb, p_double boolean default false)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with s as (select * from public.website_goal_spend(p_month, p_double)),
  l as (select (x->>'spend')::numeric as spend, ord from jsonb_array_elements(p_ladder) with ordinality as t(x, ord))
  select jsonb_build_object(
    'month', p_month,
    'customers', (select count(*) from s),
    'spend', (select coalesce(sum(spend), 0) from s),
    'rungs', coalesce((
      select jsonb_agg(jsonb_build_object('rung', l.ord, 'customers', (select count(*) from s where s.spend >= l.spend)) order by l.ord)
      from l where l.spend > 0
    ), '[]'::jsonb)
  )
$$;

revoke all on function public.website_goal_month(date) from public, anon, authenticated;
revoke all on function public.website_goal_spend(text, boolean, uuid) from public, anon, authenticated;
revoke all on function public.portal_goal(boolean) from public, anon;
revoke all on function public.website_goal_settle(text, jsonb, boolean) from public, anon, authenticated;
revoke all on function public.website_goal_coupons(integer) from public, anon, authenticated;
revoke all on function public.website_goal_coupon_mark(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.website_goal_preview(text, jsonb, boolean) from public, anon, authenticated;

grant execute on function public.portal_goal(boolean) to authenticated;
grant execute on function public.website_goal_settle(text, jsonb, boolean) to service_role;
grant execute on function public.website_goal_coupons(integer) to service_role;
grant execute on function public.website_goal_coupon_mark(uuid, text, text, text) to service_role;
grant execute on function public.website_goal_preview(text, jsonb, boolean) to service_role;

commit;
