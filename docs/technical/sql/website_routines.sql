-- Routine pickup (phase 4): a signed-in customer asks for "every Saturday, afternoon"; a manager
-- confirms it with them on WhatsApp and activates it on the Command Center, which writes it into
-- Velto Ops' own weekly_subscriptions. From then on Ops' existing daily job
-- (create_weekly_pickup_tasks) makes the pickup, delivery and day-before confirmation tasks.
--
-- website_routines is the website's side: the request, its state, and the Ops subscription it became.
--   requested  waiting for a manager (subscription_id set = a change to a running routine)
--   active     running in Ops
--   paused     paused by the customer (the Ops subscription is paused too)
--   declined   a manager said no (reason kept)
--   stopped    the customer stopped it (the Ops subscription is paused, never deleted)
-- The website only ever sets weekly_subscriptions.status to 'active' or 'paused'.
--
-- Customers: portal_routine_get / _request / _pause / _resume / _stop (their own routine only).
-- Command Center: website_routine_list / _activate / _decline (service role only).
-- Requires customer_portal.sql and Ops' weekly_subscriptions. Idempotent.
-- Status: applied to staging and production (2026-09-29).

begin;

create table if not exists public.website_routines (
  id              uuid primary key default gen_random_uuid(),
  auth_user_id    uuid not null references auth.users (id) on delete cascade,
  customer_id     uuid references public.customers (id) on delete set null,
  name            text not null check (char_length(btrim(name)) between 2 and 80),
  phone           text not null check (phone ~ '^01[3-9][0-9]{8}$'),
  address         text not null check (char_length(btrim(address)) between 5 and 300),
  area            text not null check (area ~ '^([1-9]|1[0-8]|outside)$'),
  weekday         smallint not null check (weekday between 0 and 6),
  time_window     text not null check (time_window in ('morning', 'afternoon', 'evening')),
  service         text check (service is null or service in ('dry-cleaning', 'wash-and-iron', 'ironing')),
  note            text check (note is null or char_length(note) <= 300),
  status          text not null default 'requested' check (status in ('requested', 'active', 'paused', 'declined', 'stopped')),
  subscription_id uuid references public.weekly_subscriptions (id) on delete set null,
  reason          text check (reason is null or char_length(reason) <= 300),
  decided_by      text,
  decided_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.website_routines is
  'Website routine pickup requests. A manager activates one into Ops weekly_subscriptions; Ops'' daily job then creates the tasks.';

-- One open routine per customer login.
create unique index if not exists website_routines_open_idx
  on public.website_routines (auth_user_id) where status in ('requested', 'active', 'paused');
create index if not exists website_routines_requested_idx on public.website_routines (created_at) where status = 'requested';

alter table public.website_routines enable row level security;
revoke all on table public.website_routines from public, anon, authenticated;

-------------------------------------------------------------------------------
-- Shared shape
-------------------------------------------------------------------------------

create or replace function public.website_routine_json(r public.website_routines)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when r.id is null then null else jsonb_build_object(
    'id', r.id, 'status', r.status, 'weekday', r.weekday, 'window', r.time_window, 'service', r.service,
    'note', r.note, 'reason', r.reason, 'address', r.address, 'area', r.area,
    'change', r.status = 'requested' and r.subscription_id is not null,
    'createdAt', r.created_at, 'decidedAt', r.decided_at,
    -- The day Ops' job will next make a pickup for it (Dhaka), while it runs.
    'nextOn', case when r.status = 'active' then
      ((now() at time zone 'Asia/Dhaka')::date + ((r.weekday - extract(dow from (now() at time zone 'Asia/Dhaka'))::int + 7) % 7)) end
  ) end;
$$;

-------------------------------------------------------------------------------
-- Customers (authenticated, own routine only)
-------------------------------------------------------------------------------

create or replace function public.portal_routine_get()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_acc public.customer_accounts;
  v_row public.website_routines;
begin
  v_acc := public.portal_caller();
  if v_acc.auth_user_id is null then return null; end if;
  -- The open one; else the latest decision from the last 30 days (so a decline is explained once).
  select * into v_row from public.website_routines
   where auth_user_id = v_acc.auth_user_id
     and (status in ('requested', 'active', 'paused') or (status = 'declined' and decided_at > now() - interval '30 days'))
   order by (status in ('requested', 'active', 'paused')) desc, created_at desc
   limit 1;
  return public.website_routine_json(v_row);
end;
$$;

-- Ask for a routine, or change the open one. Name, phone and address come from the profile.
-- A change to a running routine keeps it running until a manager confirms the change.
create or replace function public.portal_routine_request(p_weekday integer, p_window text, p_service text, p_note text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_acc public.customer_accounts;
  v_row public.website_routines;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_service text := nullif(btrim(coalesce(p_service, '')), '');
begin
  v_acc := public.portal_caller();
  if v_acc.auth_user_id is null then return jsonb_build_object('ok', false, 'error', 'profile'); end if;
  if nullif(btrim(coalesce(v_acc.address, '')), '') is null or coalesce(v_acc.area, '') !~ '^([1-9]|1[0-8]|outside)$' then
    return jsonb_build_object('ok', false, 'error', 'address');
  end if;
  if p_weekday is null or p_weekday not between 0 and 6 or p_window is null or p_window not in ('morning', 'afternoon', 'evening')
     or (v_service is not null and v_service not in ('dry-cleaning', 'wash-and-iron', 'ironing'))
     or char_length(coalesce(v_note, '')) > 300 then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;

  select * into v_row from public.website_routines
   where auth_user_id = v_acc.auth_user_id and status in ('requested', 'active', 'paused') for update;

  if v_row.id is null then
    insert into public.website_routines (auth_user_id, customer_id, name, phone, address, area, weekday, time_window, service, note)
    values (v_acc.auth_user_id, v_acc.customer_id, btrim(v_acc.full_name), coalesce(v_acc.verified_phone, v_acc.phone),
            btrim(v_acc.address), v_acc.area, p_weekday, p_window, v_service, v_note)
    returning * into v_row;
    return jsonb_build_object('ok', true, 'new', true, 'routine', public.website_routine_json(v_row));
  end if;

  update public.website_routines
     set weekday = p_weekday, time_window = p_window, service = v_service, note = v_note,
         name = btrim(v_acc.full_name), phone = coalesce(v_acc.verified_phone, v_acc.phone),
         address = btrim(v_acc.address), area = v_acc.area, customer_id = coalesce(v_acc.customer_id, customer_id),
         status = 'requested', updated_at = now()
   where id = v_row.id
   returning * into v_row;
  return jsonb_build_object('ok', true, 'new', false, 'routine', public.website_routine_json(v_row));
end;
$$;

-- Pause (active → paused, Ops paused too). A request not yet activated is simply withdrawn.
create or replace function public.portal_routine_pause()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_acc public.customer_accounts;
  v_row public.website_routines;
begin
  v_acc := public.portal_caller();
  select * into v_row from public.website_routines
   where auth_user_id = v_acc.auth_user_id and status in ('requested', 'active') for update;
  if v_row.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if v_row.subscription_id is null then
    update public.website_routines set status = 'stopped', updated_at = now() where id = v_row.id returning * into v_row;
  else
    update public.weekly_subscriptions set status = 'paused' where id = v_row.subscription_id;
    update public.website_routines set status = 'paused', updated_at = now() where id = v_row.id returning * into v_row;
  end if;
  return jsonb_build_object('ok', true, 'routine', public.website_routine_json(v_row));
end;
$$;

create or replace function public.portal_routine_resume()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_acc public.customer_accounts;
  v_row public.website_routines;
begin
  v_acc := public.portal_caller();
  select * into v_row from public.website_routines
   where auth_user_id = v_acc.auth_user_id and status = 'paused' for update;
  if v_row.id is null or v_row.subscription_id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  update public.weekly_subscriptions set status = 'active', resumes_on = null where id = v_row.subscription_id;
  update public.website_routines set status = 'active', updated_at = now() where id = v_row.id returning * into v_row;
  return jsonb_build_object('ok', true, 'routine', public.website_routine_json(v_row));
end;
$$;

-- Stop for good: the Ops subscription is paused (Ops keeps its record), the routine closes.
create or replace function public.portal_routine_stop()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_acc public.customer_accounts;
  v_row public.website_routines;
begin
  v_acc := public.portal_caller();
  select * into v_row from public.website_routines
   where auth_user_id = v_acc.auth_user_id and status in ('requested', 'active', 'paused') for update;
  if v_row.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if v_row.subscription_id is not null then
    update public.weekly_subscriptions
       set status = 'paused',
           note = left(concat_ws(E'\n', nullif(note, ''), 'Stopped by the customer on the website ' || to_char(now() at time zone 'Asia/Dhaka', 'DD Mon YYYY')), 1000)
     where id = v_row.subscription_id;
  end if;
  update public.website_routines set status = 'stopped', updated_at = now() where id = v_row.id;
  return jsonb_build_object('ok', true);
end;
$$;

-------------------------------------------------------------------------------
-- Command Center (service role)
-------------------------------------------------------------------------------

create or replace function public.website_routine_list()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(x order by x->>'sort', x->>'createdAt' desc), '[]'::jsonb)
    from (
      select public.website_routine_json(r) || jsonb_build_object(
               'name', r.name, 'phone', r.phone, 'customerId', r.customer_id, 'subscriptionId', r.subscription_id,
               'decidedBy', r.decided_by,
               'orders', (select count(*) from public.orders o where r.customer_id is not null and o.customer_id = r.customer_id and o.order_status <> 'Cancelled'),
               'opsStatus', (select s.status from public.weekly_subscriptions s where s.id = r.subscription_id),
               'sort', case r.status when 'requested' then 0 when 'active' then 1 when 'paused' then 2 else 3 end
             ) as x
        from public.website_routines r
       where r.status in ('requested', 'active', 'paused') or r.updated_at > now() - interval '14 days'
       limit 300
    ) t;
$$;

-- Activate (or apply a change): create/update the Ops weekly subscription and mark the routine active.
create or replace function public.website_routine_activate(p_id uuid, p_price numeric, p_actor text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.website_routines;
  v_sub uuid;
  v_window text;
  v_category text;
  v_sector text;
begin
  if p_price is not null and (p_price < 0 or p_price > 100000) then return jsonb_build_object('ok', false, 'error', 'invalid'); end if;
  select * into r from public.website_routines where id = p_id for update;
  if r.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if r.status <> 'requested' then return jsonb_build_object('ok', false, 'error', 'closed'); end if;

  v_window := case r.time_window when 'morning' then 'Morning (9 AM–12 PM)' when 'afternoon' then 'Afternoon (12–4 PM)' else 'Evening (4–8 PM)' end;
  v_category := case r.service when 'dry-cleaning' then 'Dry Cleaning' when 'wash-and-iron' then 'Wash + Iron' when 'ironing' then 'Ironing' end;
  v_sector := case when r.area = 'outside' then 'Outside Uttara' else 'Uttara Sector ' || r.area end;

  if r.subscription_id is not null and exists (select 1 from public.weekly_subscriptions where id = r.subscription_id) then
    update public.weekly_subscriptions
       set name = r.name, phone = r.phone, address = r.address, sector = v_sector,
           outlet_code = case when r.area = '18' then 'RUAP' else 'S11' end,
           days = array[r.weekday::int], time_window = v_window,
           service_category = coalesce(v_category, service_category),
           price_per_run = coalesce(p_price, price_per_run), status = 'active', resumes_on = null,
           customer_id = coalesce(r.customer_id, customer_id)
     where id = r.subscription_id;
    v_sub := r.subscription_id;
  else
    insert into public.weekly_subscriptions
      (customer_id, name, phone, address, sector, outlet_code, days, time_window, service_category, price_per_run, status, note, created_by_name)
    values
      (r.customer_id, r.name, r.phone, r.address, v_sector, case when r.area = '18' then 'RUAP' else 'S11' end,
       array[r.weekday::int], v_window, v_category, coalesce(p_price, 0), 'active',
       left(concat_ws(E'\n', 'Routine requested on the website.', r.note), 1000), left(coalesce(nullif(btrim(p_actor), ''), 'Velto website'), 120))
    returning id into v_sub;
  end if;

  update public.website_routines
     set status = 'active', subscription_id = v_sub, reason = null,
         decided_by = left(nullif(btrim(p_actor), ''), 120), decided_at = now(), updated_at = now()
   where id = r.id;
  return jsonb_build_object('ok', true, 'subscriptionId', v_sub);
end;
$$;

-- Decline a request. A declined change leaves the running routine as it was.
create or replace function public.website_routine_decline(p_id uuid, p_reason text, p_actor text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.website_routines;
  v_reason text := left(nullif(btrim(coalesce(p_reason, '')), ''), 300);
begin
  if v_reason is null then return jsonb_build_object('ok', false, 'error', 'reason'); end if;
  select * into r from public.website_routines where id = p_id for update;
  if r.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if r.status <> 'requested' then return jsonb_build_object('ok', false, 'error', 'closed'); end if;
  update public.website_routines
     set status = case when r.subscription_id is not null and exists (select 1 from public.weekly_subscriptions s where s.id = r.subscription_id and s.status = 'active')
                       then 'active' else 'declined' end,
         reason = v_reason, decided_by = left(nullif(btrim(p_actor), ''), 120), decided_at = now(), updated_at = now()
   where id = r.id;
  return jsonb_build_object('ok', true);
end;
$$;

-------------------------------------------------------------------------------
-- Grants
-------------------------------------------------------------------------------

revoke all on function public.website_routine_json(public.website_routines) from public, anon, authenticated;
revoke all on function public.portal_routine_get() from public, anon;
revoke all on function public.portal_routine_request(integer, text, text, text) from public, anon;
revoke all on function public.portal_routine_pause() from public, anon;
revoke all on function public.portal_routine_resume() from public, anon;
revoke all on function public.portal_routine_stop() from public, anon;
revoke all on function public.website_routine_list() from public, anon, authenticated;
revoke all on function public.website_routine_activate(uuid, numeric, text) from public, anon, authenticated;
revoke all on function public.website_routine_decline(uuid, text, text) from public, anon, authenticated;

grant execute on function public.portal_routine_get() to authenticated;
grant execute on function public.portal_routine_request(integer, text, text, text) to authenticated;
grant execute on function public.portal_routine_pause() to authenticated;
grant execute on function public.portal_routine_resume() to authenticated;
grant execute on function public.portal_routine_stop() to authenticated;
grant execute on function public.website_routine_list() to service_role;
grant execute on function public.website_routine_activate(uuid, numeric, text) to service_role;
grant execute on function public.website_routine_decline(uuid, text, text) to service_role;

commit;
