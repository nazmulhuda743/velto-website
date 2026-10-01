-- Today (/admin/today): rider settings, days off, automatic order linking and a 5-minute sync.
-- Design: docs/superpowers/specs/2026-10-01-today-scheduling-design.md (§4 steps, §5 riders, §6 automation).
--
-- Apply to staging, run tests/website_today_test.sql, then production by a human.
-- (Order: this file first, then website_customer_pickups.sql, on staging; the test rolls back.
-- Production: the same two files, applied by a human after review (spec §10). Never run the test there.)
--
-- 1. website_riders: who rides and how many stops they can do per time window (default 8).
--    Until anyone has can_ride = true, every active staff member is offered (the admin's getStaff()).
-- 2. website_rider_days_off: a rider who is off that day is not offered for it.
-- 3. website_dispatch_sync() also brings Ops' weekly routine pickups (tasks.source = 'weekly',
--    type 'pickup', made by create_weekly_pickup_tasks) due today or later onto the board. The
--    customer already agreed to the routine, so they start at "confirmed" (To assign) on the day
--    the task is due, in the routine's window. Idempotent on task_id. New job source: 'weekly'.
--    Only active subscriptions, and not tasks already done or cancelled in Ops.
--    Otherwise the live definition (website_dispatch_deliveries.sql, staging = production by md5 on
--    2026-09-30), with three changes: one sync at a time (transaction advisory lock, so the cron and
--    a page-open sync never race), `on conflict do nothing` on every insert, and Ready orders from the
--    last 30 days (was 7) come onto the board; orders Ready for longer are left to Ops.
--    THIS FILE NOW OWNS website_dispatch_sync(): do not re-apply the older definitions in
--    website_dispatch.sql, website_dispatch_stages.sql or website_dispatch_deliveries.sql.
-- 4. website_dispatch_autolink(): a picked pickup with no order gets the Ops order made for the same
--    phone between 1 day before and 2 days after the pickup (never before the job reached the board),
--    when that order is the only candidate (and the job its only match). One run at a time: a second
--    concurrent run returns 0. Two or more: nothing is linked; the manager picks on Today.
--    Linking goes through website_dispatch_link_order(..., 'Auto-link'). Returns links made.
-- 5. pg_cron job "website-dispatch-sync", every 5 minutes: sync, then auto-link. cron.schedule with
--    a job name updates the existing job of that name (pg_cron >= 1.3), so re-running is safe.
--
-- Requires website_dispatch.sql, website_dispatch_stages.sql, website_dispatch_deliveries.sql and
-- website_routines.sql (Ops weekly_subscriptions). Tables and functions: service role only.
-- Orders are only read. Idempotent.
-- Status: applied and tested on staging 2026-09-30 (with the review fixes: sync lock, auto-link
-- lower bound and lock, 30-day Ready orders, active routines only). Production: not applied (a human applies it).

begin;

/* ---------- riders and days off ---------- */

create table if not exists public.website_riders (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  can_ride boolean not null default true,
  stops_per_window integer not null default 8 check (stops_per_window between 1 and 30),
  updated_at timestamptz not null default now(),
  updated_by text check (updated_by is null or length(updated_by) <= 120)
);

comment on table public.website_riders is
  'Today: staff who do pickups and deliveries and their stops per time window. Service role only.';

create table if not exists public.website_rider_days_off (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  primary key (profile_id, day)
);

comment on table public.website_rider_days_off is
  'Today: a rider is off on this Dhaka date and is not offered for it. Service role only.';

create index if not exists website_rider_days_off_day_idx on public.website_rider_days_off (day);

alter table public.website_riders enable row level security;
alter table public.website_rider_days_off enable row level security;
revoke all on table public.website_riders from public, anon, authenticated;
revoke all on table public.website_rider_days_off from public, anon, authenticated;
grant select, insert, update, delete on table public.website_riders to service_role;
grant select, insert, update, delete on table public.website_rider_days_off to service_role;

/* ---------- jobs: a new source for Ops weekly routine pickups ---------- */

alter table public.website_dispatch_jobs drop constraint if exists website_dispatch_jobs_source_check;
alter table public.website_dispatch_jobs
  add constraint website_dispatch_jobs_source_check
  check (source in ('website_booking', 'website_quote', 'ops_order', 'weekly'));

/* ---------- sync: the live definition plus weekly routine pickups ---------- */

create or replace function public.website_dispatch_sync()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_new_pickups integer;
  v_new_weekly integer;
  v_new_deliveries integer;
  v_closed integer;
  v_today date := (now() at time zone 'Asia/Dhaka')::date;
begin
  -- One sync at a time (cron and page opens): a second caller waits for the first to commit.
  perform pg_advisory_xact_lock(hashtext('website_dispatch_sync'));

  insert into public.website_dispatch_jobs (kind, task_id, source, customer_name, phone, phone_key, address, area, outlet_code, requested, stage, picked_at)
  select 'pickup', t.id, t.source,
         left(public.website_dispatch_line(t.description, 'Name'), 120),
         left(public.website_dispatch_line(t.description, 'Phone'), 32),
         coalesce(public.website_dispatch_phone_key(public.website_dispatch_line(t.description, 'Phone')), left(t.source_ref, 20)),
         left(public.website_dispatch_line(t.description, 'Address'), 500),
         left(public.website_dispatch_line(t.description, 'Area'), 120),
         t.outlet_code,
         left(public.website_dispatch_line(t.description, 'Preferred pickup'), 160),
         case when t.status = 'done' then 'picked' else 'new' end,
         case when t.status = 'done' then coalesce(t.done_at, now()) end
    from public.tasks t
   where t.source in ('website_booking', 'website_quote')
     and t.created_at > now() - interval '30 days'
     and not exists (select 1 from public.website_dispatch_jobs j where j.task_id = t.id)
  on conflict (task_id) do nothing;
  get diagnostics v_new_pickups = row_count;

  -- Ops weekly routine pickups due today or later, for active routines and still open in Ops: the
  -- customer already agreed, so they start at "confirmed" (To assign) on the due day, in the
  -- routine's window when it is one of ours.
  insert into public.website_dispatch_jobs (kind, task_id, source, customer_name, phone, phone_key, address, area, outlet_code,
                                            requested, stage, slot_date, slot, confirmed_at, confirmed_by)
  select 'pickup', t.id, 'weekly',
         left(coalesce(s.name, t.title), 120),
         left(s.phone, 32),
         left(public.website_dispatch_phone_key(s.phone), 20),
         left(s.address, 500),
         left(s.sector, 120),
         t.outlet_code,
         left('Weekly routine' || coalesce(', ' || initcap(nullif(btrim(s.time_window), '')), ''), 160),
         'confirmed',
         case when w.slot is not null then (t.due_at at time zone 'Asia/Dhaka')::date end,
         w.slot,
         now(), 'Weekly routine'
    from public.tasks t
    join public.weekly_subscriptions s on s.id::text = t.source_ref and s.status = 'active'
    cross join lateral (
      select case when lower(btrim(s.time_window)) in ('morning', 'afternoon', 'evening') then lower(btrim(s.time_window)) end as slot
    ) w
   where t.source = 'weekly' and t.type = 'pickup'
     and t.status not in ('done', 'cancelled')
     and (t.due_at at time zone 'Asia/Dhaka')::date >= v_today
     and not exists (select 1 from public.website_dispatch_jobs j where j.task_id = t.id)
  on conflict (task_id) do nothing;
  get diagnostics v_new_weekly = row_count;

  -- Orders that are Ready (or already out) with no live delivery job: those that became Ready in the
  -- last 30 days or are due from yesterday on. Orders Ready for longer than 30 days are left to Ops.
  insert into public.website_dispatch_jobs (kind, order_number, source, customer_name, phone, phone_key, address, area, outlet_code, requested, stage)
  select 'delivery', o.order_number, 'ops_order',
         left(o.name_snapshot, 120), left(o.phone_snapshot, 32), public.website_dispatch_phone_key(o.phone_snapshot),
         left(o.address_snapshot, 500), left(o.zone_snapshot, 120), o.outlet_code,
         case when o.delivery_date is not null then 'Delivery date ' || to_char(o.delivery_date, 'Dy DD Mon') end,
         'new'
    from public.orders o
   where o.order_status in ('Ready', 'Out for Delivery')
     and o.order_number ~ '^VELR?-[0-9]{3,6}$'
     and (o.updated_at > now() - interval '30 days' or o.delivery_date >= v_today - 1)
     and not exists (
       select 1 from public.website_dispatch_jobs j
        where j.kind = 'delivery' and j.order_number = o.order_number
          and (j.stage not in ('cancelled', 'merged') or (j.stage = 'cancelled' and j.updated_at >= o.updated_at)))
  on conflict do nothing;
  get diagnostics v_new_deliveries = row_count;

  with closed as (
    update public.website_dispatch_jobs j
       set stage = case when o.order_status = 'Cancelled' then 'cancelled' else 'done' end,
           reason = case when o.order_status = 'Cancelled' then 'Order cancelled in Velto Ops' else j.reason end,
           history = j.history || jsonb_build_array(jsonb_build_object('at', now(), 'by', 'Velto Ops',
             'action', case when o.order_status = 'Cancelled' then 'cancelled' else 'delivered' end)),
           updated_at = now()
      from public.orders o
     where j.kind = 'delivery' and j.stage in ('new', 'confirmed', 'assigned', 'scheduled')
       and o.order_number = j.order_number and o.order_status in ('Delivered', 'Cancelled')
    returning j.id
  ), pickups as (
    update public.website_dispatch_jobs j
       set stage = 'picked',
           picked_at = coalesce(t.done_at, now()),
           history = j.history || jsonb_build_array(jsonb_build_object('at', now(), 'by', coalesce(t.done_by_name, 'Velto Ops'), 'action', 'picked up (done in Ops)')),
           updated_at = now()
      from public.tasks t
     where j.kind = 'pickup' and j.stage in ('new', 'confirmed', 'assigned', 'scheduled')
       and t.id = j.task_id and t.status = 'done'
    returning j.id
  )
  select (select count(*) from closed) + (select count(*) from pickups) into v_closed;

  update public.tasks t
     set status = 'done', done_at = coalesce(t.done_at, now()), done_by_name = coalesce(t.done_by_name, 'Velto Ops')
    from public.website_dispatch_jobs j
   where j.kind = 'delivery' and j.task_id = t.id and j.stage in ('done', 'cancelled') and t.status <> 'done';

  return jsonb_build_object('pickups', v_new_pickups, 'weekly', v_new_weekly, 'deliveries', v_new_deliveries, 'closed', v_closed);
end;
$$;

/* ---------- auto-link: the Ops order made from a picked pickup ---------- */

create or replace function public.website_dispatch_autolink()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  c record;
  r jsonb;
  v_links integer := 0;
begin
  -- One run at a time; a run that finds another in progress does nothing (the next one catches up).
  if not pg_try_advisory_xact_lock(hashtext('website_dispatch_autolink')) then
    return 0;
  end if;
  for c in
    -- Candidate pairs: an order for the job's phone, created from 1 day before to 2 days after the
    -- pickup but not before the job itself (an order made before the booking reached the board is
    -- not that booking's order), not cancelled and not already linked to a pickup job.
    -- orders.phone_snapshot is constrained to 01XXXXXXXXX, the same form website_dispatch_phone_key
    -- gives phone_key, so the match is a plain (indexed) equality.
    with pairs as (
      select j.id as job_id, o.order_number
        from public.website_dispatch_jobs j
        join public.orders o
          on o.phone_snapshot = j.phone_key
         and o.created_at >= greatest(j.picked_at - interval '1 day', j.created_at)
         and o.created_at <= j.picked_at + interval '2 days'
       where j.kind = 'pickup' and j.stage = 'picked' and j.order_number is null
         and j.picked_at > now() - interval '7 days'
         and j.phone_key ~ '^01[0-9]{9}$'
         and o.order_number ~ '^VELR?-[0-9]{3,6}$'
         and o.order_status is distinct from 'Cancelled'
         and not exists (select 1 from public.website_dispatch_jobs x where x.kind = 'pickup' and x.order_number = o.order_number)
    )
    -- Exactly one order for the job, and that order is no other job's candidate.
    select p.job_id, p.order_number
      from (select p.*, count(*) over (partition by p.job_id) as per_job,
                   count(*) over (partition by p.order_number) as per_order
              from pairs p) p
     where p.per_job = 1 and p.per_order = 1
  loop
    -- Still unlinked and the order still free (a manager may have linked either meanwhile); a job
    -- locked elsewhere waits for the next run.
    perform 1 from public.website_dispatch_jobs
     where id = c.job_id and stage = 'picked' and order_number is null
     for update skip locked;
    if not found then continue; end if;
    if exists (select 1 from public.website_dispatch_jobs x where x.kind = 'pickup' and x.order_number = c.order_number) then
      continue;
    end if;
    r := public.website_dispatch_link_order(c.job_id, c.order_number, 'Auto-link');
    if coalesce((r ->> 'ok')::boolean, false) then v_links := v_links + 1; end if;
  end loop;
  return v_links;
end;
$$;

revoke all on function public.website_dispatch_sync() from public, anon, authenticated;
grant execute on function public.website_dispatch_sync() to service_role;
revoke all on function public.website_dispatch_autolink() from public, anon, authenticated;
grant execute on function public.website_dispatch_autolink() to service_role;

/* ---------- every 5 minutes (named job: re-running updates it, never duplicates) ---------- */

select cron.schedule(
  'website-dispatch-sync',
  '*/5 * * * *',
  $cron$select public.website_dispatch_sync(); select public.website_dispatch_autolink();$cron$
);

commit;
