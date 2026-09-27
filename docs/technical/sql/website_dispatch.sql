-- Pickup & delivery dispatch for the Website Command Center.
--
-- Every customer request (website booking or household quote) becomes a pickup JOB, and every
-- order that is Ready in Velto Ops becomes a delivery JOB. A manager assigns each job to a person
-- and a slot (a day + Morning / Afternoon / Evening), cancels it with a reason, merges a duplicate
-- into the job it repeats, or combines two stops into one trip.
--
-- Velto Ops stays in charge of the work itself. Jobs are website-owned; the Ops `tasks` list is
-- kept in step, in the same transaction, only in the ways the live Ops app already understands
-- (velto-ops-pwa, audited 2026-09-27):
--   * pickup  → the website's own open task: assigned_to / assignee_ids / names, due_at = the
--     end of the slot (so the Ops 5-minute reminder fires), reminded reset; done → status 'done'
--     with done_at / done_by_name.
--   * delivery → one `delivery` task per order (source 'website_dispatch', dedupe_key
--     'website-dispatch:delivery:<order>'), so the rider sees it under "Assigned to me".
-- Orders are never written. Their status is only read (Ready → Delivered / Cancelled).
--
-- Service role only (the admin server checks who may do what and logs it). No deletes.
-- Status: applied on staging and on production (owner-approved, 2026-09-27).

begin;

create table if not exists public.website_dispatch_jobs (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('pickup', 'delivery')),
  -- Pickup: the website booking/quote task. Delivery: the delivery task this module created.
  task_id uuid unique,
  -- Delivery: the Ops order. Pickup: set if staff link one later.
  order_number text check (order_number is null or order_number ~ '^VELR?-[0-9]{3,6}$'),
  source text not null check (source in ('website_booking', 'website_quote', 'ops_order')),
  customer_name text check (customer_name is null or length(customer_name) <= 120),
  phone text check (phone is null or length(phone) <= 32),
  -- 01XXXXXXXXX, for spotting the same customer twice.
  phone_key text check (phone_key is null or length(phone_key) <= 20),
  address text check (address is null or length(address) <= 500),
  area text check (area is null or length(area) <= 120),
  outlet_code text check (outlet_code is null or length(outlet_code) <= 20),
  -- What the customer asked for ("Tomorrow Mon 28 Sep, Afternoon"), or the order's delivery date.
  requested text check (requested is null or length(requested) <= 160),
  stage text not null default 'new' check (stage in ('new', 'assigned', 'scheduled', 'done', 'cancelled', 'merged')),
  slot_date date,
  slot text check (slot is null or slot in ('morning', 'afternoon', 'evening')),
  assignee_id uuid,
  assignee_name text check (assignee_name is null or length(assignee_name) <= 120),
  -- Stops combined into one trip share a key (same place, same person, same slot).
  trip_key uuid,
  merged_into uuid references public.website_dispatch_jobs(id),
  reason text check (reason is null or length(reason) <= 300),
  history jsonb not null default '[]'::jsonb check (jsonb_typeof(history) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((slot_date is null) = (slot is null))
);

-- One live delivery job per order.
create unique index if not exists website_dispatch_delivery_order_uidx
  on public.website_dispatch_jobs (order_number)
  where kind = 'delivery' and stage not in ('cancelled', 'merged');
create index if not exists website_dispatch_board_idx on public.website_dispatch_jobs (kind, stage, slot_date);
create index if not exists website_dispatch_phone_idx on public.website_dispatch_jobs (phone_key) where stage in ('new', 'assigned', 'scheduled');

alter table public.website_dispatch_jobs enable row level security;
revoke all on public.website_dispatch_jobs from anon, authenticated;

/* ---------- helpers ---------- */

-- "Label: value" line from a website task description.
create or replace function public.website_dispatch_line(p_text text, p_label text)
returns text language sql immutable set search_path = pg_catalog as $$
  select nullif(btrim(substring(coalesce(p_text, '') from '(?n)^' || p_label || ':\s*(.*)$')), '')
$$;

-- Last moment of a slot, in Dhaka time: when the Ops reminder should fire.
create or replace function public.website_dispatch_slot_end(p_date date, p_slot text)
returns timestamptz language sql immutable set search_path = pg_catalog as $$
  select (p_date + case p_slot when 'morning' then time '12:00' when 'afternoon' then time '17:00' else time '21:00' end)
         at time zone 'Asia/Dhaka'
$$;

create or replace function public.website_dispatch_phone_key(p_phone text)
returns text language sql immutable set search_path = pg_catalog as $$
  select case
    when d ~ '^8801[0-9]{9}$' then substr(d, 3)
    when d ~ '^008801[0-9]{9}$' then substr(d, 5)
    when d ~ '^01[0-9]{9}$' then d
    else nullif(d, '')
  end
  from (select regexp_replace(coalesce(p_phone, ''), '\D', '', 'g') as d) x
$$;

create or replace function public.website_dispatch_log(p_job uuid, p_actor text, p_action text, p_detail text default null)
returns void language sql set search_path = pg_catalog, public as $$
  update public.website_dispatch_jobs
     set history = history || jsonb_build_array(jsonb_build_object('at', now(), 'by', left(p_actor, 120), 'action', p_action, 'detail', left(p_detail, 300))),
         updated_at = now()
   where id = p_job
$$;

/* ---------- sync: bring new requests and ready orders onto the boards ---------- */

create or replace function public.website_dispatch_sync()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_new_pickups integer;
  v_new_deliveries integer;
  v_closed integer;
begin
  -- Website bookings and quotes from the last 30 days that aren't on the board yet.
  insert into public.website_dispatch_jobs (kind, task_id, source, customer_name, phone, phone_key, address, area, outlet_code, requested, stage)
  select 'pickup', t.id, t.source,
         left(public.website_dispatch_line(t.description, 'Name'), 120),
         left(public.website_dispatch_line(t.description, 'Phone'), 32),
         coalesce(public.website_dispatch_phone_key(public.website_dispatch_line(t.description, 'Phone')), left(t.source_ref, 20)),
         left(public.website_dispatch_line(t.description, 'Address'), 500),
         left(public.website_dispatch_line(t.description, 'Area'), 120),
         t.outlet_code,
         left(public.website_dispatch_line(t.description, 'Preferred pickup'), 160),
         case when t.status = 'done' then 'done' else 'new' end
    from public.tasks t
   where t.source in ('website_booking', 'website_quote')
     and t.created_at > now() - interval '30 days'
     and not exists (select 1 from public.website_dispatch_jobs j where j.task_id = t.id);
  get diagnostics v_new_pickups = row_count;

  -- Orders that are Ready (or already out) with no live delivery job.
  insert into public.website_dispatch_jobs (kind, order_number, source, customer_name, phone, phone_key, address, area, outlet_code, requested, stage)
  select 'delivery', o.order_number, 'ops_order',
         left(o.name_snapshot, 120), left(o.phone_snapshot, 32), public.website_dispatch_phone_key(o.phone_snapshot),
         left(o.address_snapshot, 500), left(o.zone_snapshot, 120), o.outlet_code,
         case when o.delivery_date is not null then 'Delivery date ' || to_char(o.delivery_date, 'Dy DD Mon') end,
         'new'
    from public.orders o
   where o.order_status in ('Ready', 'Out for Delivery')
     and o.order_number ~ '^VELR?-[0-9]{3,6}$'
     -- Orders untouched for two months are stale, not today's deliveries.
     and o.updated_at > now() - interval '60 days'
     and not exists (
       select 1 from public.website_dispatch_jobs j
        where j.kind = 'delivery' and j.order_number = o.order_number and j.stage not in ('cancelled', 'merged'));
  get diagnostics v_new_deliveries = row_count;

  -- Close jobs that Ops finished: pickup task done in Ops, order delivered or cancelled.
  with closed as (
    update public.website_dispatch_jobs j
       set stage = case when o.order_status = 'Cancelled' then 'cancelled' else 'done' end,
           reason = case when o.order_status = 'Cancelled' then 'Order cancelled in Velto Ops' else j.reason end,
           history = j.history || jsonb_build_array(jsonb_build_object('at', now(), 'by', 'Velto Ops',
             'action', case when o.order_status = 'Cancelled' then 'cancelled' else 'delivered' end)),
           updated_at = now()
      from public.orders o
     where j.kind = 'delivery' and j.stage in ('new', 'assigned', 'scheduled')
       and o.order_number = j.order_number and o.order_status in ('Delivered', 'Cancelled')
    returning j.id
  ), pickups as (
    update public.website_dispatch_jobs j
       set stage = 'done',
           history = j.history || jsonb_build_array(jsonb_build_object('at', now(), 'by', coalesce(t.done_by_name, 'Velto Ops'), 'action', 'done in Ops')),
           updated_at = now()
      from public.tasks t
     where j.kind = 'pickup' and j.stage in ('new', 'assigned', 'scheduled')
       and t.id = j.task_id and t.status = 'done'
    returning j.id
  )
  select (select count(*) from closed) + (select count(*) from pickups) into v_closed;

  -- A delivery that was done or cancelled closes its delivery task too.
  update public.tasks t
     set status = 'done', done_at = coalesce(t.done_at, now()), done_by_name = coalesce(t.done_by_name, 'Velto Ops')
    from public.website_dispatch_jobs j
   where j.kind = 'delivery' and j.task_id = t.id and j.stage in ('done', 'cancelled') and t.status <> 'done';

  return jsonb_build_object('pickups', v_new_pickups, 'deliveries', v_new_deliveries, 'closed', v_closed);
end;
$$;

/* ---------- plan: assign a person and/or a slot ---------- */

create or replace function public.website_dispatch_plan(
  p_job uuid,
  p_assignee_id uuid,
  p_assignee_name text,
  p_slot_date date,
  p_slot text,
  p_actor text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  j public.website_dispatch_jobs;
  v_due timestamptz;
  v_task uuid;
  v_name text := nullif(left(btrim(coalesce(p_assignee_name, '')), 120), '');
begin
  select * into j from public.website_dispatch_jobs where id = p_job for update;
  if j.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if j.stage not in ('new', 'assigned', 'scheduled') then return jsonb_build_object('ok', false, 'error', 'closed'); end if;
  if (p_slot_date is null) <> (p_slot is null) or (p_slot is not null and p_slot not in ('morning', 'afternoon', 'evening')) then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  if p_assignee_id is not null and not exists (select 1 from public.profiles where id = p_assignee_id and active) then
    return jsonb_build_object('ok', false, 'error', 'assignee');
  end if;
  if p_slot_date is not null and p_slot_date < (now() at time zone 'Asia/Dhaka')::date then
    return jsonb_build_object('ok', false, 'error', 'past');
  end if;

  v_due := case when p_slot_date is not null then public.website_dispatch_slot_end(p_slot_date, p_slot) end;

  update public.website_dispatch_jobs
     set assignee_id = p_assignee_id,
         assignee_name = case when p_assignee_id is null then null else v_name end,
         slot_date = p_slot_date,
         slot = p_slot,
         stage = case when p_assignee_id is not null and p_slot_date is not null then 'scheduled'
                      when p_assignee_id is not null or p_slot_date is not null then 'assigned'
                      else 'new' end,
         updated_at = now()
   where id = p_job;

  if j.kind = 'pickup' then
    -- The website's own task: the assignee sees it under "Assigned to me"; due_at drives the reminder.
    update public.tasks
       set assigned_to = p_assignee_id,
           assigned_to_name = case when p_assignee_id is null then null else v_name end,
           assignee_ids = case when p_assignee_id is null then '{}'::uuid[] else array[p_assignee_id] end,
           assignee_names = case when p_assignee_id is null then '{}'::text[] else array[v_name] end,
           assigned_by_name = left(p_actor, 120),
           due_at = coalesce(v_due, due_at),
           reminded = false
     where id = j.task_id and status <> 'done';
  elsif p_assignee_id is not null then
    -- Deliveries: one Ops delivery task per order, for the rider's list and reminder.
    insert into public.tasks (title, type, priority, status, due_at, outlet_code, description, order_number,
                              assigned_to, assigned_to_name, assignee_ids, assignee_names, assigned_by_name,
                              source, source_ref, dedupe_key)
    values (left('Deliver ' || j.order_number || coalesce(' - ' || j.customer_name, ''), 200), 'delivery', 'normal', 'open',
            coalesce(v_due, now() + interval '4 hours'), j.outlet_code,
            concat_ws(' · ', 'Delivery planned in the website Command Center', 'Phone: ' || j.phone, 'Address: ' || j.address, 'Area: ' || j.area),
            j.order_number, p_assignee_id, v_name, array[p_assignee_id], array[v_name], left(p_actor, 120),
            'website_dispatch', j.order_number, 'website-dispatch:delivery:' || j.order_number)
    on conflict (dedupe_key) where dedupe_key is not null do update
       set assigned_to = excluded.assigned_to, assigned_to_name = excluded.assigned_to_name,
           assignee_ids = excluded.assignee_ids, assignee_names = excluded.assignee_names,
           assigned_by_name = excluded.assigned_by_name, due_at = excluded.due_at,
           status = 'open', done_at = null, done_by_name = null, reminded = false
    returning id into v_task;
    update public.website_dispatch_jobs set task_id = v_task where id = p_job;
  elsif j.task_id is not null then
    -- Delivery unassigned: take it off the rider's list.
    update public.tasks set status = 'done', done_at = now(), done_by_name = 'Unassigned: ' || left(p_actor, 100)
     where id = j.task_id and status <> 'done';
  end if;

  perform public.website_dispatch_log(p_job, p_actor, 'planned',
    concat_ws(', ', coalesce(v_name, 'unassigned'), to_char(p_slot_date, 'Dy DD Mon') || ' ' || p_slot));
  return jsonb_build_object('ok', true);
end;
$$;

/* ---------- done / cancel ---------- */

create or replace function public.website_dispatch_close(p_job uuid, p_outcome text, p_reason text, p_actor text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  j public.website_dispatch_jobs;
begin
  if p_outcome not in ('done', 'cancelled') then return jsonb_build_object('ok', false, 'error', 'invalid'); end if;
  if p_outcome = 'cancelled' and nullif(btrim(coalesce(p_reason, '')), '') is null then
    return jsonb_build_object('ok', false, 'error', 'reason');
  end if;
  select * into j from public.website_dispatch_jobs where id = p_job for update;
  if j.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if j.stage not in ('new', 'assigned', 'scheduled') then return jsonb_build_object('ok', false, 'error', 'closed'); end if;

  update public.website_dispatch_jobs
     set stage = p_outcome, reason = case when p_outcome = 'cancelled' then left(btrim(p_reason), 300) else reason end, updated_at = now()
   where id = p_job;
  update public.tasks
     set status = 'done', done_at = now(),
         done_by_name = left(case when p_outcome = 'cancelled' then 'Cancelled by ' || p_actor || ': ' || btrim(p_reason) else p_actor end, 120)
   where id = j.task_id and status <> 'done';
  perform public.website_dispatch_log(p_job, p_actor, p_outcome, p_reason);
  return jsonb_build_object('ok', true);
end;
$$;

/* ---------- overlaps: merge a duplicate, combine two stops into one trip ---------- */

-- The same customer asked twice: keep one job, close the other as merged (its Ops task too).
create or replace function public.website_dispatch_merge(p_keep uuid, p_remove uuid, p_actor text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  k public.website_dispatch_jobs;
  r public.website_dispatch_jobs;
begin
  if p_keep = p_remove then return jsonb_build_object('ok', false, 'error', 'invalid'); end if;
  select * into k from public.website_dispatch_jobs where id = p_keep for update;
  select * into r from public.website_dispatch_jobs where id = p_remove for update;
  if k.id is null or r.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if k.kind <> r.kind or k.stage not in ('new', 'assigned', 'scheduled') or r.stage not in ('new', 'assigned', 'scheduled') then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;

  update public.website_dispatch_jobs
     set stage = 'merged', merged_into = p_keep, reason = 'Merged into another request', updated_at = now()
   where id = p_remove;
  update public.tasks
     set status = 'done', done_at = now(), done_by_name = left('Merged by ' || p_actor, 120)
   where id = r.task_id and status <> 'done';
  -- The kept task mentions the merge, so Ops staff know there were two requests (one line: the app collapses line breaks).
  update public.tasks
     set description = left(coalesce(description, '') || ' · Merged duplicate request (' || coalesce(r.requested, 'no preferred time') || ')', 4000)
   where id = k.task_id;

  perform public.website_dispatch_log(p_keep, p_actor, 'merged', 'Absorbed a duplicate request');
  perform public.website_dispatch_log(p_remove, p_actor, 'merged', 'Merged into another request');
  return jsonb_build_object('ok', true);
end;
$$;

-- Two stops at the same place (e.g. a pickup and a delivery for one customer): one trip, one
-- person, one slot. The second job takes the first's person and slot.
create or replace function public.website_dispatch_combine(p_lead uuid, p_other uuid, p_actor text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  l public.website_dispatch_jobs;
  v_trip uuid;
  v_res jsonb;
begin
  if p_lead = p_other then return jsonb_build_object('ok', false, 'error', 'invalid'); end if;
  select * into l from public.website_dispatch_jobs where id = p_lead for update;
  if l.id is null or l.stage not in ('new', 'assigned', 'scheduled') then return jsonb_build_object('ok', false, 'error', 'invalid'); end if;
  v_trip := coalesce(l.trip_key, gen_random_uuid());

  v_res := public.website_dispatch_plan(p_other, l.assignee_id, l.assignee_name, l.slot_date, l.slot, p_actor);
  if not (v_res->>'ok')::boolean then return v_res; end if;
  update public.website_dispatch_jobs set trip_key = v_trip, updated_at = now() where id in (p_lead, p_other);
  perform public.website_dispatch_log(p_other, p_actor, 'combined', 'Same trip as another stop');
  return jsonb_build_object('ok', true, 'trip', v_trip);
end;
$$;

create or replace function public.website_dispatch_split(p_job uuid, p_actor text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  update public.website_dispatch_jobs set trip_key = null, updated_at = now() where id = p_job;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  perform public.website_dispatch_log(p_job, p_actor, 'split', 'Taken out of the combined trip');
  return jsonb_build_object('ok', true);
end;
$$;

-- Service role only.
do $$
declare f text;
begin
  foreach f in array array[
    'public.website_dispatch_line(text,text)',
    'public.website_dispatch_slot_end(date,text)',
    'public.website_dispatch_phone_key(text)',
    'public.website_dispatch_log(uuid,text,text,text)',
    'public.website_dispatch_sync()',
    'public.website_dispatch_plan(uuid,uuid,text,date,text,text)',
    'public.website_dispatch_close(uuid,text,text,text)',
    'public.website_dispatch_merge(uuid,uuid,text)',
    'public.website_dispatch_combine(uuid,uuid,text)',
    'public.website_dispatch_split(uuid,text)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;

commit;
