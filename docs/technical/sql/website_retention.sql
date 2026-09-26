-- Velto Retention V1: bring customers back (first → second → regular).
--
-- Why: of 722 Ops customers, 47% placed a second order and 65% of those a
-- third; the median gap between orders is 12 days. The first → second step
-- loses the most customers, so staff get a daily list of who to message and
-- when, and the dashboard measures who came back afterwards.
--
-- Reads Ops customers, orders and weekly_subscriptions; never writes to them.
-- The only new table is the staff contact log. Everything is service_role only
-- (the website admin server); nothing is reachable with the anon or
-- authenticated keys.
--
-- Status: applied to STAGING (ekgdefcdqcsqvpbqponv) and tested with
-- docs/technical/sql/tests/website_retention_test.sql. Production only with
-- the owner's approval.

begin;

-- ---------------------------------------------------------------------------
-- 0. Schema contract: the Ops columns this file reads
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1
    from (values
      ('customers', 'id'), ('customers', 'name'), ('customers', 'phone'), ('customers', 'whatsapp'),
      ('customers', 'zone'), ('customers', 'status'),
      ('orders', 'customer_id'), ('orders', 'order_number'), ('orders', 'order_date'),
      ('orders', 'order_status'), ('orders', 'service_category'), ('orders', 'created_at'),
      ('weekly_subscriptions', 'customer_id'), ('weekly_subscriptions', 'status')
    ) as req(tbl, col)
    where not exists (
      select 1 from information_schema.columns c
      where c.table_schema = 'public' and c.table_name = req.tbl and c.column_name = req.col
    )
  ) then
    raise exception 'website_retention: Ops schema does not match the reviewed contract';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. Staff contact log
-- ---------------------------------------------------------------------------
create table if not exists public.website_retention_contacts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  bucket text not null check (bucket in ('second', 'due', 'winback')),
  outcome text not null check (outcome in ('messaged', 'not_now', 'wrong_number', 'opt_out')),
  staff_name text not null check (length(staff_name) between 1 and 80),
  created_at timestamptz not null default now()
);

create index if not exists website_retention_contacts_customer_idx
  on public.website_retention_contacts (customer_id, created_at desc);
create index if not exists website_retention_contacts_created_idx
  on public.website_retention_contacts (created_at desc);

alter table public.website_retention_contacts enable row level security;
revoke all on public.website_retention_contacts from anon, authenticated, public;
grant select, insert on public.website_retention_contacts to service_role;

-- ---------------------------------------------------------------------------
-- 2. Per-customer rhythm (shared by the queue and the summary)
-- ---------------------------------------------------------------------------
-- Same rules as src/lib/customer/rhythm.ts: cancelled orders ignored, same-day
-- orders are one visit, the pace is the median gap clamped to 4..45 days.
create or replace function public.website_retention_base()
returns table (
  customer_id uuid,
  orders integer,
  first_order date,
  last_order date,
  last_order_number text,
  last_services text[],
  every_days integer,
  in_progress boolean
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with o as (
    select o.customer_id, o.order_date::date as d, o.order_number, o.order_status, o.service_category, o.created_at
    from public.orders o
    where o.customer_id is not null and o.order_status is distinct from 'Cancelled' and o.order_date is not null
  ),
  days as (
    select distinct o.customer_id, o.d from o
  ),
  gaps as (
    select customer_id, d - lag(d) over (partition by customer_id order by d) as gap from days
  ),
  pace as (
    select customer_id,
           least(45, greatest(4, round(percentile_cont(0.5) within group (order by gap))))::integer as every_days
    from gaps where gap > 0
    group by customer_id
  ),
  latest as (
    select distinct on (customer_id) customer_id, order_number, service_category
    from o
    order by customer_id, d desc, created_at desc
  )
  select c.customer_id, c.orders, c.first_order, c.last_order, l.order_number, l.service_category, p.every_days, c.in_progress
  from (
    select customer_id, count(*)::integer as orders, min(d) as first_order, max(d) as last_order,
           bool_or(order_status is distinct from 'Delivered') as in_progress
    from o group by customer_id
  ) c
  join latest l using (customer_id)
  left join pace p using (customer_id);
$$;

-- ---------------------------------------------------------------------------
-- 3. Today's queue for one bucket
-- ---------------------------------------------------------------------------
--   second  : one order, 7–60 days ago — the step most customers never take.
--   due     : two or more orders, at or past their own pace, within 60 days.
--   winback : last order 61–180 days ago.
-- Left out: an order in progress, an active weekly subscription, an inactive
-- customer, anyone who asked not to be contacted or whose number was wrong,
-- and anyone contacted recently (messaged: 7 days, not now: 14 days), unless
-- they have ordered since.
create or replace function public.website_retention_queue(p_bucket text, p_limit integer default 50)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with today as (select (now() at time zone 'Asia/Dhaka')::date as d),
  last_contact as (
    select distinct on (customer_id) customer_id, outcome, staff_name, created_at
    from public.website_retention_contacts
    order by customer_id, created_at desc
  ),
  blocked as (
    select distinct customer_id from public.website_retention_contacts where outcome in ('opt_out', 'wrong_number')
  ),
  cand as (
    select b.*, t.d - b.last_order as days_since,
           case when b.every_days is not null then b.last_order + b.every_days end as due_on,
           lc.outcome as contact_outcome, lc.staff_name as contact_staff, lc.created_at as contact_at,
           cu.name, coalesce(nullif(cu.whatsapp, ''), cu.phone) as phone, cu.zone
    from public.website_retention_base() b
    cross join today t
    join public.customers cu on cu.id = b.customer_id
    left join last_contact lc on lc.customer_id = b.customer_id
    where not b.in_progress
      and coalesce(cu.status, 'Active') = 'Active'
      and not exists (select 1 from blocked x where x.customer_id = b.customer_id)
      and not exists (
        select 1 from public.weekly_subscriptions s
        where s.customer_id = b.customer_id and lower(coalesce(s.status, '')) in ('active', 'paused')
      )
      and (
        lc.created_at is null
        or (lc.created_at at time zone 'Asia/Dhaka')::date < b.last_order
        or (lc.outcome = 'messaged' and lc.created_at < now() - interval '7 days')
        or (lc.outcome = 'not_now' and lc.created_at < now() - interval '14 days')
      )
      and case p_bucket
        when 'second' then b.orders = 1 and t.d - b.last_order between 7 and 60
        when 'due' then b.orders >= 2 and t.d >= b.last_order + coalesce(b.every_days, 14) and t.d - b.last_order <= 60
        when 'winback' then t.d - b.last_order between 61 and 180
        else false
      end
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'customerId', r.customer_id,
    'name', r.name,
    'phone', r.phone,
    'zone', r.zone,
    'orders', r.orders,
    'firstOrder', r.first_order,
    'lastOrder', r.last_order,
    'lastOrderNumber', r.last_order_number,
    'lastServices', to_jsonb(coalesce(r.last_services, '{}'::text[])),
    'everyDays', r.every_days,
    'dueOn', r.due_on,
    'daysSince', r.days_since,
    'lastContact', case when r.contact_at is null then null
                        else jsonb_build_object('at', r.contact_at, 'outcome', r.contact_outcome, 'staff', r.contact_staff) end
  ) order by r.sort_key, r.customer_id), '[]'::jsonb)
  from (
    select q.*,
      case p_bucket
        -- Freshest first: the sooner after the first order, the likelier the second.
        when 'second' then q.days_since
        -- Just due first; long overdue drifts toward win-back.
        when 'due' then q.days_since - coalesce(q.every_days, 14)
        -- Most valuable relationships first.
        else q.days_since - q.orders * 1000
      end as sort_key
    from cand q
    order by sort_key, q.customer_id
    limit least(greatest(coalesce(p_limit, 50), 1), 200)
  ) r;
$$;

-- ---------------------------------------------------------------------------
-- 4. Summary: bucket sizes, repeat rates and whether messages bring people back
-- ---------------------------------------------------------------------------
create or replace function public.website_retention_summary()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with b as (select * from public.website_retention_base()),
  contacts as (
    select c.customer_id, c.created_at, c.outcome
    from public.website_retention_contacts c
    where c.outcome = 'messaged' and c.created_at >= now() - interval '30 days'
  ),
  came_back as (
    -- A messaged customer whose next order was placed within 14 days of the message.
    select distinct c.customer_id
    from contacts c
    join public.orders o on o.customer_id = c.customer_id
      and o.order_status is distinct from 'Cancelled'
      and o.created_at > c.created_at
      and o.created_at <= c.created_at + interval '14 days'
  )
  select jsonb_build_object(
    'customers', (select count(*) from b),
    'withSecond', (select count(*) from b where orders >= 2),
    'withThird', (select count(*) from b where orders >= 3),
    'medianEveryDays', (select percentile_cont(0.5) within group (order by every_days) from b where every_days is not null),
    'queue', jsonb_build_object(
      'second', jsonb_array_length(public.website_retention_queue('second', 200)),
      'due', jsonb_array_length(public.website_retention_queue('due', 200)),
      'winback', jsonb_array_length(public.website_retention_queue('winback', 200))
    ),
    'messaged7d', (select count(distinct customer_id) from contacts where created_at >= now() - interval '7 days'),
    'messaged30d', (select count(distinct customer_id) from contacts),
    'cameBack30d', (select count(*) from came_back)
  );
$$;

-- ---------------------------------------------------------------------------
-- 5. Record a staff contact
-- ---------------------------------------------------------------------------
create or replace function public.website_retention_log(
  p_customer_id uuid, p_bucket text, p_outcome text, p_staff_name text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not exists (select 1 from public.customers where id = p_customer_id) then
    raise exception 'Unknown customer' using errcode = 'P0002';
  end if;
  insert into public.website_retention_contacts (customer_id, bucket, outcome, staff_name)
  values (p_customer_id, p_bucket, p_outcome, left(btrim(coalesce(p_staff_name, '')), 80));
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'website_retention_base()',
    'website_retention_queue(text, integer)',
    'website_retention_summary()',
    'website_retention_log(uuid, text, text, text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end;
$$;

commit;
