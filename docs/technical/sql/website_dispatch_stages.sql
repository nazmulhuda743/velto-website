-- Booking request stages for the Website Command Center (one card per request, /admin/requests).
--
-- Adds two stages to website_dispatch_jobs (website_dispatch.sql) so a pickup can be followed
-- from the first call to the delivered order without leaving the card:
--   new → confirmed (customer called, day + slot agreed) → assigned (person + slot: 'scheduled')
--       → picked (collected; the Ops order number is linked when known)
-- After "picked" the card follows the linked Velto Ops order (Picked → Ready → Delivered) and
-- its delivery job. Orders are only read, never written.
--
-- Also: call attempts ("No answer"), staff notes and WhatsApp sends in the history, a
-- customer lookup (orders by phone) and the linked orders' status for the card.
-- Pickup tasks finished in Velto Ops now mean "picked" (the rider collected it).
-- Delivery jobs are only created for orders that became Ready recently or are due soon, so
-- orders left at Ready for weeks don't fill the delivery board.
--
-- Requires website_dispatch.sql and website_dispatch_portal.sql. Service role only. Idempotent.
-- Status: applied and tested on staging; applied on production 2026-09-28 (owner asked for the flow).

begin;

/* ---------- table ---------- */

do $$
declare c text;
begin
  select conname into c from pg_constraint
   where conrelid = 'public.website_dispatch_jobs'::regclass and contype = 'c'
     and pg_get_constraintdef(oid) like '%stage%' and pg_get_constraintdef(oid) like '%scheduled%';
  if c is not null then execute format('alter table public.website_dispatch_jobs drop constraint %I', c); end if;
end;
$$;

alter table public.website_dispatch_jobs
  add constraint website_dispatch_jobs_stage_check
  check (stage in ('new', 'confirmed', 'assigned', 'scheduled', 'picked', 'done', 'cancelled', 'merged'));

alter table public.website_dispatch_jobs add column if not exists contact_attempts smallint not null default 0;
alter table public.website_dispatch_jobs add column if not exists last_contact_at timestamptz;
alter table public.website_dispatch_jobs add column if not exists confirmed_at timestamptz;
alter table public.website_dispatch_jobs add column if not exists confirmed_by text check (confirmed_by is null or length(confirmed_by) <= 120);
alter table public.website_dispatch_jobs add column if not exists picked_at timestamptz;

drop index if exists public.website_dispatch_phone_idx;
create index if not exists website_dispatch_phone_idx on public.website_dispatch_jobs (phone_key) where stage in ('new', 'confirmed', 'assigned', 'scheduled');
create index if not exists website_dispatch_order_idx on public.website_dispatch_jobs (order_number) where order_number is not null;

/* ---------- sync: Ops-finished pickups are "picked"; only recent Ready orders ---------- */

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
  v_today date := (now() at time zone 'Asia/Dhaka')::date;
begin
  -- Website bookings and quotes from the last 30 days that aren't on the board yet.
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
     and not exists (select 1 from public.website_dispatch_jobs j where j.task_id = t.id);
  get diagnostics v_new_pickups = row_count;

  -- Orders that are Ready (or already out) with no live delivery job: only those that became
  -- Ready in the last 7 days or are due from yesterday on. Older ones are left to Ops.
  insert into public.website_dispatch_jobs (kind, order_number, source, customer_name, phone, phone_key, address, area, outlet_code, requested, stage)
  select 'delivery', o.order_number, 'ops_order',
         left(o.name_snapshot, 120), left(o.phone_snapshot, 32), public.website_dispatch_phone_key(o.phone_snapshot),
         left(o.address_snapshot, 500), left(o.zone_snapshot, 120), o.outlet_code,
         case when o.delivery_date is not null then 'Delivery date ' || to_char(o.delivery_date, 'Dy DD Mon') end,
         'new'
    from public.orders o
   where o.order_status in ('Ready', 'Out for Delivery')
     and o.order_number ~ '^VELR?-[0-9]{3,6}$'
     and (o.updated_at > now() - interval '7 days' or o.delivery_date >= v_today - 1)
     and not exists (
       select 1 from public.website_dispatch_jobs j
        where j.kind = 'delivery' and j.order_number = o.order_number and j.stage not in ('cancelled', 'merged'));
  get diagnostics v_new_deliveries = row_count;

  -- Close jobs that Ops finished: order delivered or cancelled; pickup task done in Ops = picked.
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

  -- A delivery that was done or cancelled closes its delivery task too.
  update public.tasks t
     set status = 'done', done_at = coalesce(t.done_at, now()), done_by_name = coalesce(t.done_by_name, 'Velto Ops')
    from public.website_dispatch_jobs j
   where j.kind = 'delivery' and j.task_id = t.id and j.stage in ('done', 'cancelled') and t.status <> 'done';

  return jsonb_build_object('pickups', v_new_pickups, 'deliveries', v_new_deliveries, 'closed', v_closed);
end;
$$;

/* ---------- plan: a confirmed request keeps "confirmed" until it has a person ---------- */

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
  if j.stage not in ('new', 'confirmed', 'assigned', 'scheduled') then return jsonb_build_object('ok', false, 'error', 'closed'); end if;
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
                      when j.confirmed_at is not null and p_slot_date is not null then 'confirmed'
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

/* ---------- open stages now include "confirmed" ---------- */

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
  if j.stage not in ('new', 'confirmed', 'assigned', 'scheduled') then return jsonb_build_object('ok', false, 'error', 'closed'); end if;

  -- A pickup marked done was collected: that is the "picked" stage.
  update public.website_dispatch_jobs
     set stage = case when p_outcome = 'done' and j.kind = 'pickup' then 'picked' else p_outcome end,
         picked_at = case when p_outcome = 'done' and j.kind = 'pickup' then now() else picked_at end,
         reason = case when p_outcome = 'cancelled' then left(btrim(p_reason), 300) else reason end, updated_at = now()
   where id = p_job;
  update public.tasks
     set status = 'done', done_at = now(),
         done_by_name = left(case when p_outcome = 'cancelled' then 'Cancelled by ' || p_actor || ': ' || btrim(p_reason) else p_actor end, 120)
   where id = j.task_id and status <> 'done';
  perform public.website_dispatch_log(p_job, p_actor, p_outcome, p_reason);
  return jsonb_build_object('ok', true);
end;
$$;

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
  if k.kind <> r.kind or k.stage not in ('new', 'confirmed', 'assigned', 'scheduled') or r.stage not in ('new', 'confirmed', 'assigned', 'scheduled') then
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
  if l.id is null or l.stage not in ('new', 'confirmed', 'assigned', 'scheduled') then return jsonb_build_object('ok', false, 'error', 'invalid'); end if;
  v_trip := coalesce(l.trip_key, gen_random_uuid());

  v_res := public.website_dispatch_plan(p_other, l.assignee_id, l.assignee_name, l.slot_date, l.slot, p_actor);
  if not (v_res->>'ok')::boolean then return v_res; end if;
  update public.website_dispatch_jobs set trip_key = v_trip, updated_at = now() where id in (p_lead, p_other);
  perform public.website_dispatch_log(p_other, p_actor, 'combined', 'Same trip as another stop');
  return jsonb_build_object('ok', true, 'trip', v_trip);
end;
$$;

/* ---------- new: call outcome, note / WhatsApp log, picked up, link order ---------- */

-- The customer was called. "confirmed" agrees a day + slot (kept as the plan, with any person
-- already chosen); "no_answer" counts an attempt.
create or replace function public.website_dispatch_contact(p_job uuid, p_outcome text, p_slot_date date, p_slot text, p_actor text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  j public.website_dispatch_jobs;
  v_res jsonb;
begin
  select * into j from public.website_dispatch_jobs where id = p_job for update;
  if j.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if j.kind <> 'pickup' or p_outcome not in ('confirmed', 'no_answer') then return jsonb_build_object('ok', false, 'error', 'invalid'); end if;
  if j.stage not in ('new', 'confirmed', 'assigned', 'scheduled') then return jsonb_build_object('ok', false, 'error', 'closed'); end if;
  if p_outcome = 'confirmed' then
    -- Checked before anything is written: a confirmation needs a valid day and slot.
    if p_slot_date is null or p_slot is null or p_slot not in ('morning', 'afternoon', 'evening') then
      return jsonb_build_object('ok', false, 'error', 'invalid');
    end if;
    if p_slot_date < (now() at time zone 'Asia/Dhaka')::date then return jsonb_build_object('ok', false, 'error', 'past'); end if;
  end if;

  update public.website_dispatch_jobs
     set contact_attempts = least(contact_attempts + 1, 99), last_contact_at = now(),
         confirmed_at = case when p_outcome = 'confirmed' then now() else confirmed_at end,
         confirmed_by = case when p_outcome = 'confirmed' then left(p_actor, 120) else confirmed_by end,
         updated_at = now()
   where id = p_job;

  if p_outcome = 'no_answer' then
    perform public.website_dispatch_log(p_job, p_actor, 'no answer', 'Call attempt ' || (j.contact_attempts + 1));
    return jsonb_build_object('ok', true, 'attempts', j.contact_attempts + 1);
  end if;

  v_res := public.website_dispatch_plan(p_job, j.assignee_id, j.assignee_name, p_slot_date, p_slot, p_actor);
  if not (v_res->>'ok')::boolean then return v_res; end if;
  perform public.website_dispatch_log(p_job, p_actor, 'confirmed', to_char(p_slot_date, 'Dy DD Mon') || ' ' || p_slot);
  return jsonb_build_object('ok', true);
end;
$$;

-- A staff note, or a record that a WhatsApp message was opened for sending.
create or replace function public.website_dispatch_note(p_job uuid, p_kind text, p_text text, p_actor text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_text text := nullif(left(btrim(coalesce(p_text, '')), 300), '');
begin
  if p_kind not in ('note', 'whatsapp') or v_text is null then return jsonb_build_object('ok', false, 'error', 'invalid'); end if;
  if not exists (select 1 from public.website_dispatch_jobs where id = p_job) then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  perform public.website_dispatch_log(p_job, p_actor, p_kind, v_text);
  return jsonb_build_object('ok', true);
end;
$$;

-- Collected. The Ops task is done; the Ops order number is linked if staff know it already.
create or replace function public.website_dispatch_pick(p_job uuid, p_order_number text, p_actor text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  j public.website_dispatch_jobs;
  v_order text := nullif(upper(btrim(coalesce(p_order_number, ''))), '');
begin
  select * into j from public.website_dispatch_jobs where id = p_job for update;
  if j.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if j.kind <> 'pickup' then return jsonb_build_object('ok', false, 'error', 'invalid'); end if;
  if j.stage not in ('new', 'confirmed', 'assigned', 'scheduled') then return jsonb_build_object('ok', false, 'error', 'closed'); end if;
  if v_order is not null and not exists (select 1 from public.orders where order_number = v_order) then
    return jsonb_build_object('ok', false, 'error', 'order');
  end if;

  update public.website_dispatch_jobs
     set stage = 'picked', picked_at = now(), order_number = coalesce(v_order, order_number), updated_at = now()
   where id = p_job;
  update public.tasks
     set status = 'done', done_at = now(), done_by_name = left('Picked up · ' || p_actor, 120),
         order_number = coalesce(v_order, order_number)
   where id = j.task_id and status <> 'done';
  perform public.website_dispatch_log(p_job, p_actor, 'picked up', v_order);
  return jsonb_build_object('ok', true);
end;
$$;

-- Link (or clear, with null) the Ops order made from a collected request.
create or replace function public.website_dispatch_link_order(p_job uuid, p_order_number text, p_actor text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  j public.website_dispatch_jobs;
  v_order text := nullif(upper(btrim(coalesce(p_order_number, ''))), '');
begin
  select * into j from public.website_dispatch_jobs where id = p_job for update;
  if j.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if j.kind <> 'pickup' or j.stage not in ('picked', 'done') then return jsonb_build_object('ok', false, 'error', 'invalid'); end if;
  if v_order is not null and not exists (select 1 from public.orders where order_number = v_order) then
    return jsonb_build_object('ok', false, 'error', 'order');
  end if;
  update public.website_dispatch_jobs set order_number = v_order, updated_at = now() where id = p_job;
  update public.tasks set order_number = v_order where id = j.task_id;
  perform public.website_dispatch_log(p_job, p_actor, case when v_order is null then 'order unlinked' else 'order linked' end, coalesce(v_order, j.order_number));
  return jsonb_build_object('ok', true);
end;
$$;

-- For the cards: each phone's order history and recent orders, and the linked orders' status.
create or replace function public.website_dispatch_context(p_phone_keys text[], p_orders text[])
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'customers', coalesce((
      select jsonb_object_agg(k.key, jsonb_build_object(
        'orders', (select count(*) from public.orders o where o.phone_snapshot = k.key),
        'lastOrder', (select max(o.order_date) from public.orders o where o.phone_snapshot = k.key),
        'recent', coalesce((
          select jsonb_agg(jsonb_build_object('orderNumber', r.order_number, 'status', r.order_status, 'orderDate', r.order_date, 'createdAt', r.created_at) order by r.created_at desc)
            from (select * from public.orders o where o.phone_snapshot = k.key order by o.created_at desc limit 5) r
        ), '[]'::jsonb)
      ))
      from (select distinct x as key from unnest(coalesce(p_phone_keys, '{}')) x where x ~ '^01[0-9]{9}$' limit 200) k
    ), '{}'::jsonb),
    'orders', coalesce((
      select jsonb_object_agg(o.order_number, jsonb_build_object(
        'status', o.order_status, 'orderDate', o.order_date, 'deliveryDate', o.delivery_date,
        'total', o.total_amount, 'due', o.due, 'items', o.total_items, 'updatedAt', o.updated_at))
      from public.orders o
      where o.order_number = any (coalesce(p_orders, '{}')) and cardinality(coalesce(p_orders, '{}')) <= 500
    ), '{}'::jsonb)
  )
$$;

/* ---------- the customer's account shows confirmed slots too ---------- */

create or replace function public.portal_dispatch_plans()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_acc public.customer_accounts;
  v_today date := (now() at time zone 'Asia/Dhaka')::date;
  v_key text;
begin
  v_acc := public.portal_caller();
  if v_acc.customer_id is null or v_acc.link_status <> 'linked' then
    return '[]'::jsonb;
  end if;
  v_key := public.website_dispatch_phone_key(v_acc.verified_phone);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'kind', j.kind,
      'orderNumber', j.order_number,
      'slotDate', j.slot_date,
      'slot', j.slot,
      'assigneeName', j.assignee_name
    ) order by j.slot_date, j.kind)
    from public.website_dispatch_jobs j
    where j.stage in ('confirmed', 'assigned', 'scheduled')
      and j.slot_date is not null
      and j.slot_date >= v_today - 1
      and (
        (j.kind = 'delivery' and j.order_number is not null
          and exists (select 1 from public.orders o where o.order_number = j.order_number and o.customer_id = v_acc.customer_id))
        or (j.kind = 'pickup' and v_key is not null and j.phone_key = v_key)
      )
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.portal_dispatch_plans() from public, anon;
grant execute on function public.portal_dispatch_plans() to authenticated;

-- Service role only.
do $$
declare f text;
begin
  foreach f in array array[
    'public.website_dispatch_sync()',
    'public.website_dispatch_plan(uuid,uuid,text,date,text,text)',
    'public.website_dispatch_close(uuid,text,text,text)',
    'public.website_dispatch_merge(uuid,uuid,text)',
    'public.website_dispatch_combine(uuid,uuid,text)',
    'public.website_dispatch_contact(uuid,text,date,text,text)',
    'public.website_dispatch_note(uuid,text,text,text)',
    'public.website_dispatch_pick(uuid,text,text)',
    'public.website_dispatch_link_order(uuid,text,text)',
    'public.website_dispatch_context(text[],text[])'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;

commit;
