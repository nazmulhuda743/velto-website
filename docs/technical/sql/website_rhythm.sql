-- Velto Rhythm, step 1 (docs/technical/RHYTHM.md): every customer's laundry rhythm, and the
-- reminders it triggers.
--
--   website_rhythm           one row per Ops customer, rebuilt by website_rhythm_refresh():
--                            group (segment), usual gap, usual service, open order, hold-out
--   website_rhythm_touches   every reminder decided: SMS sent, staff task made, or hold-out (nothing
--                            sent, kept to measure the difference). SMS rows carry the one-tap code.
--   website_rhythm_optouts   phones that asked for no more reminders (never reminded again)
--   website_rhythm_keys      the key the daily pg_cron job sends to /api/rhythm/run
--
-- The rules live here, not in the website, so a bug in the page can't break them:
--   * at most one reminder per 7 days and three per 30 days, per customer, any playbook
--   * nothing while an order is Picked/Ready or a website pickup is open; nothing within 3 days
--     of the last order; nothing to opted-out phones; one reminder per playbook per order cycle
--   * 1 in 10 customers (fixed by id) is a hold-out: recorded, never contacted
--
-- Reads Ops orders/customers/tasks; writes only website_rhythm* tables and, for slipping
-- regulars, one Ops 'call' task (source website_rhythm, deduplicated). Service role only.
-- Requires website_identity_claim.sql (portal_first_name) and customer_portal.sql
-- (portal_local_phone). Idempotent. The daily schedule is website_rhythm_schedule.sql (production only).

create table if not exists public.website_rhythm (
  customer_id   uuid primary key references public.customers (id) on delete cascade,
  phone         text,
  first_name    text,
  segment       text not null check (segment in ('new', 'onetimer_warm', 'onetimer_gone', 'regular_due', 'regular_on_track',
                                                  'slipping', 'occasional', 'lapsed')),
  orders        integer not null default 0,
  last_order    date,
  days_since    integer,
  cadence_days  integer,
  usual_service text,
  lifetime      numeric,
  open_order    boolean not null default false,
  holdout       boolean not null default false,
  computed_at   timestamptz not null default now()
);

create table if not exists public.website_rhythm_touches (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references public.customers (id) on delete cascade,
  phone         text,
  playbook      text not null check (playbook in ('regular_due', 'slipping')),
  channel       text not null check (channel in ('sms', 'staff', 'holdout')),
  status        text not null check (status in ('sending', 'sent', 'failed', 'holdout', 'task')),
  code          text unique check (code is null or code ~ '^[A-Za-z0-9_-]{8}$'),
  lang          text not null default 'bn' check (lang in ('bn', 'en')),
  segment       text,
  cadence_days  integer,
  days_since    integer,
  last_order    date,
  task_id       uuid,
  expires_at    timestamptz,
  clicked_at    timestamptz,
  booked_at     timestamptz,
  booking_ref   text check (booking_ref is null or char_length(booking_ref) <= 80),
  created_at    timestamptz not null default now()
);
create index if not exists website_rhythm_touches_customer_idx on public.website_rhythm_touches (customer_id, created_at desc);
create index if not exists website_rhythm_touches_created_idx on public.website_rhythm_touches (created_at desc);

create table if not exists public.website_rhythm_optouts (
  phone      text primary key check (phone ~ '^01[3-9][0-9]{8}$'),
  via        text not null default 'link' check (via in ('link', 'staff')),
  created_at timestamptz not null default now()
);

create table if not exists public.website_rhythm_keys (
  id      smallint primary key default 1 check (id = 1),
  run_key text not null check (char_length(run_key) >= 32)
);
insert into public.website_rhythm_keys (id, run_key)
values (1, encode(extensions.gen_random_bytes(32), 'hex'))
on conflict (id) do nothing;

alter table public.website_rhythm enable row level security;
alter table public.website_rhythm_touches enable row level security;
alter table public.website_rhythm_optouts enable row level security;
alter table public.website_rhythm_keys enable row level security;
revoke all on public.website_rhythm, public.website_rhythm_touches, public.website_rhythm_optouts, public.website_rhythm_keys
  from public, anon, authenticated, service_role;
-- The website reads and writes through the functions below; the admin page reads totals only.

/* ---------- rebuild ---------- */

create or replace function public.website_rhythm_refresh()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Dhaka')::date;
  v_n integer;
begin
  with o as (
    select customer_id, order_date d, total_amount amt, service_category sc, order_status st
      from public.orders
     where order_status is distinct from 'Cancelled' and order_date is not null and order_date <= v_today
  ),
  g as (select customer_id, d - lag(d) over (partition by customer_id order by d) gap from o),
  cad as (select customer_id, round(percentile_cont(0.5) within group (order by gap))::int med from g where gap > 0 group by 1),
  svc as (
    select customer_id, s, count(*) k, row_number() over (partition by customer_id order by count(*) desc, max(d) desc) rn
      from (select customer_id, d, unnest(sc) s, row_number() over (partition by customer_id order by d desc) r from o) x
     where r <= 5 group by customer_id, s
  ),
  c as (
    select customer_id, count(*)::int n, max(d) last_d, sum(amt) spend, bool_or(st in ('Picked', 'Ready')) open_o
      from o group by 1
  )
  insert into public.website_rhythm as r (customer_id, phone, first_name, segment, orders, last_order, days_since, cadence_days,
                                          usual_service, lifetime, open_order, holdout, computed_at)
  select c.customer_id,
         public.portal_local_phone(cu.phone),
         nullif(public.portal_first_name(cu.name), ''),
         case
           when c.n = 1 and v_today - c.last_d <= 7 then 'new'
           when c.n = 1 and v_today - c.last_d <= 45 then 'onetimer_warm'
           when c.n = 1 then 'onetimer_gone'
           when v_today - c.last_d > 120 then 'lapsed'
           when c.n >= 3 and cad.med <= 35 and v_today - c.last_d > 2 * cad.med + 7 then 'slipping'
           when c.n >= 3 and cad.med <= 35 and v_today - c.last_d >= cad.med - 1 then 'regular_due'
           when c.n >= 3 and cad.med <= 35 then 'regular_on_track'
           else 'occasional'
         end,
         c.n, c.last_d, v_today - c.last_d, cad.med,
         (select s from svc where svc.customer_id = c.customer_id and rn = 1),
         c.spend,
         coalesce(c.open_o, false) or exists (
           select 1 from public.tasks t
            where t.source = 'website_booking' and t.status <> 'done'
              and t.source_ref = public.portal_local_phone(cu.phone) and t.created_at > now() - interval '14 days'),
         (hashtext(c.customer_id::text || ':velto-rhythm-v1') & 2147483647) % 10 = 0,
         now()
    from c
    join public.customers cu on cu.id = c.customer_id
    left join cad on cad.customer_id = c.customer_id
  on conflict (customer_id) do update set
    phone = excluded.phone, first_name = excluded.first_name, segment = excluded.segment, orders = excluded.orders,
    last_order = excluded.last_order, days_since = excluded.days_since, cadence_days = excluded.cadence_days,
    usual_service = excluded.usual_service, lifetime = excluded.lifetime, open_order = excluded.open_order,
    holdout = excluded.holdout, computed_at = excluded.computed_at;
  get diagnostics v_n = row_count;
  delete from public.website_rhythm r where not exists (select 1 from public.customers cu where cu.id = r.customer_id);
  return v_n;
end;
$$;

/* ---------- who may be reminded today ---------- */

create or replace function public.website_rhythm_candidates(p_playbook text, p_limit integer default 50)
returns table (customer_id uuid, phone text, first_name text, usual_service text, cadence_days integer, days_since integer,
               last_order date, lifetime numeric, holdout boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select r.customer_id, r.phone, r.first_name, r.usual_service, r.cadence_days, r.days_since, r.last_order, r.lifetime, r.holdout
    from public.website_rhythm r
   where r.segment = case p_playbook when 'regular_due' then 'regular_due' when 'slipping' then 'slipping' end
     and not r.open_order
     and r.phone ~ '^01[3-9][0-9]{8}$'
     and r.days_since >= 3
     and not exists (select 1 from public.website_rhythm_optouts x where x.phone = r.phone)
     -- one per playbook per order cycle
     and not exists (select 1 from public.website_rhythm_touches t
                      where t.customer_id = r.customer_id and t.playbook = p_playbook and t.status <> 'failed'
                        and t.created_at >= r.last_order::timestamp at time zone 'Asia/Dhaka')
     -- at most one a week and three a month, any playbook (hold-out rows count too, so both groups age alike)
     and not exists (select 1 from public.website_rhythm_touches t
                      where t.customer_id = r.customer_id and t.status <> 'failed' and t.created_at > now() - interval '7 days')
     and (select count(*) from public.website_rhythm_touches t
           where t.customer_id = r.customer_id and t.status <> 'failed' and t.created_at > now() - interval '30 days') < 3
   order by r.lifetime desc nulls last, r.customer_id
   limit least(greatest(coalesce(p_limit, 50), 0), 200)
$$;

/* ---------- recording decisions ---------- */

-- One reminder decided for a customer. SMS rows get an 8-character code for the one-tap link.
create or replace function public.website_rhythm_record(p_customer uuid, p_playbook text, p_channel text, p_lang text default 'bn')
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.website_rhythm;
  v_code text;
begin
  select * into r from public.website_rhythm where customer_id = p_customer;
  if r.customer_id is null then
    raise exception 'unknown customer' using errcode = 'P0002';
  end if;
  if p_channel = 'sms' then
    loop
      v_code := translate(encode(extensions.gen_random_bytes(6), 'base64'), '+/', '-_');
      exit when not exists (select 1 from public.website_rhythm_touches where code = v_code);
    end loop;
  end if;
  insert into public.website_rhythm_touches (customer_id, phone, playbook, channel, status, code, lang, segment, cadence_days,
                                              days_since, last_order, expires_at)
  values (r.customer_id, r.phone, p_playbook, p_channel,
          case p_channel when 'sms' then 'sending' when 'holdout' then 'holdout' else 'task' end,
          v_code, case when p_lang = 'en' then 'en' else 'bn' end, r.segment, r.cadence_days, r.days_since, r.last_order,
          case when p_channel = 'sms' then now() + interval '7 days' end);
  return v_code;
end;
$$;

create or replace function public.website_rhythm_mark(p_code text, p_sent boolean)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.website_rhythm_touches set status = case when p_sent then 'sent' else 'failed' end
   where code = p_code and status = 'sending'
$$;

-- Slipping regular: one Ops call task, due this evening, deduplicated per order cycle.
create or replace function public.website_rhythm_staff_task(p_customer uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.website_rhythm;
  cu public.customers;
  v_last record;
  v_task uuid;
  v_due timestamptz;
begin
  select * into r from public.website_rhythm where customer_id = p_customer;
  select * into cu from public.customers where id = p_customer;
  if r.customer_id is null or cu.id is null then
    raise exception 'unknown customer' using errcode = 'P0002';
  end if;
  select o.order_number, o.outlet_code into v_last from public.orders o
   where o.customer_id = p_customer and o.order_status is distinct from 'Cancelled' and o.order_date is not null
   order by o.order_date desc, o.created_at desc limit 1;
  v_due := greatest(((now() at time zone 'Asia/Dhaka')::date + time '18:00') at time zone 'Asia/Dhaka', now() + interval '2 hours');
  insert into public.tasks (title, type, priority, status, due_at, outlet_code, description, assigned_by_name, source, source_ref, dedupe_key)
  values (
    left('Call ' || coalesce(nullif(btrim(cu.name), ''), 'customer') || ' · regular who has gone quiet', 200),
    'call', 'high', 'open', v_due, v_last.outlet_code,
    concat_ws(E'\n',
      'Regular customer who has gone quiet (Velto website reminders).',
      'Name: ' || coalesce(cu.name, ''),
      'Phone: ' || coalesce(r.phone, cu.phone, ''),
      'Usually: ' || coalesce(r.usual_service, 'laundry') || ' every ' || coalesce(r.cadence_days::text, '?') || ' days',
      'Now: ' || r.days_since || ' days since the last order' || coalesce(' (' || v_last.order_number || ')', ''),
      'Orders so far: ' || r.orders,
      'Ask how the last order was. If something went wrong, note it. If all was fine, offer a pickup this week.'),
    'Velto website', 'website_rhythm', r.phone,
    'rhythm-slip-' || p_customer || '-' || r.last_order)
  on conflict do nothing
  returning id into v_task;
  if v_task is null then
    return null;
  end if;
  insert into public.website_rhythm_touches (customer_id, phone, playbook, channel, status, lang, segment, cadence_days, days_since, last_order, task_id)
  values (r.customer_id, r.phone, 'slipping', 'staff', 'task', 'bn', r.segment, r.cadence_days, r.days_since, r.last_order, v_task);
  return v_task;
end;
$$;

/* ---------- the one-tap link ---------- */

-- What the link page may show: first name, usual service, rhythm. Marks the first click.
create or replace function public.website_rhythm_link(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.website_rhythm_touches;
  r public.website_rhythm;
begin
  if p_code is null or p_code !~ '^[A-Za-z0-9_-]{8}$' then
    return jsonb_build_object('ok', false, 'reason', 'unknown');
  end if;
  select * into t from public.website_rhythm_touches where code = p_code;
  if t.id is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown');
  end if;
  select * into r from public.website_rhythm where customer_id = t.customer_id;
  if t.clicked_at is null then
    update public.website_rhythm_touches set clicked_at = now() where id = t.id;
  end if;
  return jsonb_strip_nulls(jsonb_build_object(
    'ok', true,
    'state', case when t.booked_at is not null then 'booked'
                  when exists (select 1 from public.website_rhythm_optouts x where x.phone = t.phone) then 'stopped'
                  when t.expires_at < now() then 'expired'
                  else 'open' end,
    'firstName', r.first_name,
    'service', r.usual_service,
    'cadenceDays', r.cadence_days,
    'daysSince', r.days_since,
    'lang', t.lang,
    'bookingRef', t.booking_ref));
end;
$$;

-- Server only, for the booking the link makes: the Ops name, phone and address. Never sent to the page.
create or replace function public.website_rhythm_booking_data(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.website_rhythm_touches;
  cu public.customers;
  v_last text;
begin
  select * into t from public.website_rhythm_touches where code = p_code and channel = 'sms';
  if t.id is null or t.booked_at is not null or t.expires_at < now()
     or exists (select 1 from public.website_rhythm_optouts x where x.phone = t.phone) then
    return jsonb_build_object('ok', false);
  end if;
  select * into cu from public.customers where id = t.customer_id;
  select o.order_number into v_last from public.orders o
   where o.customer_id = t.customer_id and o.order_status is distinct from 'Cancelled' and o.order_date is not null
   order by o.order_date desc, o.created_at desc limit 1;
  return jsonb_build_object('ok', true, 'name', cu.name, 'phone', t.phone, 'address', cu.address, 'zone', cu.zone,
    'service', (select usual_service from public.website_rhythm where customer_id = t.customer_id), 'lastOrder', v_last);
end;
$$;

create or replace function public.website_rhythm_booked(p_code text, p_ref text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  update public.website_rhythm_touches set booked_at = now(), booking_ref = left(nullif(btrim(coalesce(p_ref, '')), ''), 80)
   where code = p_code and booked_at is null
  returning true
$$;

create or replace function public.website_rhythm_optout(p_code text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone text;
begin
  select phone into v_phone from public.website_rhythm_touches where code = p_code;
  if v_phone is null or v_phone !~ '^01[3-9][0-9]{8}$' then
    return false;
  end if;
  insert into public.website_rhythm_optouts (phone, via) values (v_phone, 'link') on conflict (phone) do nothing;
  return true;
end;
$$;

/* ---------- the admin page ---------- */

-- Per playbook, last p_days: sent, clicked, booked by link, and who ordered within 7 days
-- (orders or website pickups), compared with the hold-out group.
create or replace function public.website_rhythm_stats(p_days integer default 30)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with t as (
    select t.*, exists (
      select 1 from public.orders o
       where o.customer_id = t.customer_id and o.order_status is distinct from 'Cancelled'
         and o.order_date between (t.created_at at time zone 'Asia/Dhaka')::date and (t.created_at at time zone 'Asia/Dhaka')::date + 7
         and o.created_at > t.created_at - interval '1 hour'
      union all
      select 1 from public.tasks k
       where k.source = 'website_booking' and k.source_ref = t.phone
         and k.created_at between t.created_at and t.created_at + interval '7 days'
    ) ordered
      from public.website_rhythm_touches t
     where t.created_at > now() - make_interval(days => least(greatest(coalesce(p_days, 30), 1), 365))
  )
  select jsonb_build_object(
    'segments', (select coalesce(jsonb_object_agg(segment, n), '{}') from (select segment, count(*) n from public.website_rhythm group by 1) s),
    'computedAt', (select max(computed_at) from public.website_rhythm),
    'optouts', (select count(*) from public.website_rhythm_optouts),
    'playbooks', coalesce((select jsonb_object_agg(playbook, x) from (
      select playbook, jsonb_build_object(
        'contacted', count(*) filter (where channel <> 'holdout' and status <> 'failed'),
        'failed', count(*) filter (where status = 'failed'),
        'clicked', count(*) filter (where clicked_at is not null),
        'bookedByLink', count(*) filter (where booked_at is not null),
        'orderedContacted', count(*) filter (where channel <> 'holdout' and status <> 'failed' and ordered),
        'holdout', count(*) filter (where channel = 'holdout'),
        'orderedHoldout', count(*) filter (where channel = 'holdout' and ordered)) x
        from t group by playbook) p), '{}'));
$$;

create or replace function public.website_rhythm_check_key(p_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(p_key is not null and char_length(p_key) >= 32
                  and p_key = (select run_key from public.website_rhythm_keys where id = 1), false)
$$;

/* ---------- grants ---------- */

revoke all on function public.website_rhythm_refresh() from public, anon, authenticated;
revoke all on function public.website_rhythm_candidates(text, integer) from public, anon, authenticated;
revoke all on function public.website_rhythm_record(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.website_rhythm_mark(text, boolean) from public, anon, authenticated;
revoke all on function public.website_rhythm_staff_task(uuid) from public, anon, authenticated;
revoke all on function public.website_rhythm_link(text) from public, anon, authenticated;
revoke all on function public.website_rhythm_booking_data(text) from public, anon, authenticated;
revoke all on function public.website_rhythm_booked(text, text) from public, anon, authenticated;
revoke all on function public.website_rhythm_optout(text) from public, anon, authenticated;
revoke all on function public.website_rhythm_stats(integer) from public, anon, authenticated;
revoke all on function public.website_rhythm_check_key(text) from public, anon, authenticated;

grant execute on function public.website_rhythm_refresh() to service_role;
grant execute on function public.website_rhythm_candidates(text, integer) to service_role;
grant execute on function public.website_rhythm_record(uuid, text, text, text) to service_role;
grant execute on function public.website_rhythm_mark(text, boolean) to service_role;
grant execute on function public.website_rhythm_staff_task(uuid) to service_role;
grant execute on function public.website_rhythm_link(text) to service_role;
grant execute on function public.website_rhythm_booking_data(text) to service_role;
grant execute on function public.website_rhythm_booked(text, text) to service_role;
grant execute on function public.website_rhythm_optout(text) to service_role;
grant execute on function public.website_rhythm_stats(integer) to service_role;
grant execute on function public.website_rhythm_check_key(text) to service_role;
