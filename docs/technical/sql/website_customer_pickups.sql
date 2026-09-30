-- Customer self-service for website pickups, and loyalty counts for staff screens.
--
-- 1. A signed-in customer whose phone is proven (order history linked by staff/SMS, or signed in
--    with an SMS code) sees their open website pickup requests and can change the day/time or
--    cancel, until 3 hours before the end of a slot Velto has already planned (and at most 3
--    changes per pickup). Changes go through the dispatch functions (website_dispatch.sql), so
--    the dispatch board and the Ops task stay in step:
--      * change  → the job goes back to "new" with the customer's new preference (planned slot,
--                  trip and phone confirmation are cleared, so the team re-confirms). The rider is
--                  kept when still free in the new window (not off that day, below their stops per
--                  window, default 8; website_today.sql), otherwise removed. History: "customer
--                  changed time". The Ops task gets a note line and its due time moves to the new slot.
--      * cancel  → website_dispatch_close(..., 'cancelled'): the job is cancelled and the Ops task
--                  is closed with "Cancelled by Customer (website): …".
-- 2. website_customer_order_counts: order counts per phone for the dispatch board's tier badge.
--
-- Requires customer_portal.sql (portal_caller, portal_auth_phone), website_dispatch.sql and
-- website_dispatch_stages.sql (the 'confirmed' stage and confirmed_at), and website_today.sql
-- (website_riders, website_rider_days_off; apply it first). A customer change clears the
-- plan directly (not via website_dispatch_plan, whose staff rules may refuse some stages).
-- Idempotent. Orders are never written.

-- The caller's proven phone (01XXXXXXXXX): the verified Ops phone of a linked account, else the
-- phone Supabase Auth confirmed by SMS code. Null when neither.
create or replace function public.portal_verified_phone()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_acc public.customer_accounts;
begin
  v_acc := public.portal_caller();
  if v_acc.link_status = 'linked' and v_acc.verified_phone is not null then
    return v_acc.verified_phone;
  end if;
  return public.portal_auth_phone((select auth.uid()));
end;
$$;

-- Latest moment a customer may still change or cancel a pickup Velto has planned.
create or replace function public.portal_pickup_cutoff(p_date date, p_slot text)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select case when p_date is null then null else public.website_dispatch_slot_end(p_date, p_slot) - interval '3 hours' end
$$;

create or replace function public.portal_pickups()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_phone text := public.portal_verified_phone();
begin
  if v_phone is null then
    return jsonb_build_object('verified', false, 'pickups', '[]'::jsonb);
  end if;
  return jsonb_build_object('verified', true, 'pickups', coalesce((
    select jsonb_agg(p order by (p ->> 'createdAt') desc)
    from (
      select jsonb_build_object(
        'id', t.id,
        'reference', 'WEB-' || upper(substr(replace(t.id::text, '-', ''), 1, 8)),
        'createdAt', t.created_at,
        'requested', coalesce(j.requested, public.website_dispatch_line(t.description, 'Preferred pickup')),
        'plannedDate', j.slot_date,
        'plannedSlot', j.slot,
        'stage', coalesce(j.stage, 'new'),
        'cutoffAt', public.portal_pickup_cutoff(j.slot_date, j.slot),
        'changeable', coalesce(now() < public.portal_pickup_cutoff(j.slot_date, j.slot), true),
        'changesLeft', greatest(0, 3 - coalesce((
          select count(*) from jsonb_array_elements(j.history) e
           where e ->> 'by' = 'Customer (website)' and e ->> 'action' in ('rescheduled', 'customer changed time')), 0))
      ) as p
      from public.tasks t
      left join public.website_dispatch_jobs j on j.task_id = t.id
      where t.source = 'website_booking'
        and t.source_ref = v_phone
        and t.status <> 'done'
        and t.created_at > now() - interval '30 days'
        and (j.id is null or j.stage in ('new', 'confirmed', 'assigned', 'scheduled'))
      order by t.created_at desc
      limit 5
    ) x
  ), '[]'::jsonb));
end;
$$;

-- The caller's open pickup job for a task, created on the dispatch board if the board hasn't
-- picked it up yet. Raises when it isn't theirs, is closed, or is past the cutoff.
create or replace function public.portal_pickup_job(p_task uuid)
returns public.website_dispatch_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone text := public.portal_verified_phone();
  v_task uuid;
  j public.website_dispatch_jobs;
begin
  if v_phone is null then
    raise exception 'phone not verified' using errcode = '42501';
  end if;
  select t.id into v_task from public.tasks t
   where t.id = p_task and t.source = 'website_booking' and t.source_ref = v_phone
     and t.status <> 'done' and t.created_at > now() - interval '30 days'
   for update;
  if v_task is null then
    raise exception 'pickup not found' using errcode = 'P0002';
  end if;
  select * into j from public.website_dispatch_jobs where task_id = v_task;
  if j.id is null then
    perform public.website_dispatch_sync();
    select * into j from public.website_dispatch_jobs where task_id = v_task;
  end if;
  if j.id is null or j.stage not in ('new', 'confirmed', 'assigned', 'scheduled') then
    raise exception 'pickup closed' using errcode = 'P0002';
  end if;
  if j.slot_date is not null and now() >= public.portal_pickup_cutoff(j.slot_date, j.slot) then
    raise exception 'too late to change' using errcode = '42501';
  end if;
  return j;
end;
$$;

create or replace function public.portal_pickup_change(p_task uuid, p_date date, p_slot text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  j public.website_dispatch_jobs;
  v_today date := (now() at time zone 'Asia/Dhaka')::date;
  v_label text;
  v_keep boolean := false;
begin
  if p_slot is null or p_slot not in ('morning', 'afternoon', 'evening') or p_date is null
     or p_date < v_today or p_date > v_today + 14 then
    raise exception 'invalid time' using errcode = '22023';
  end if;
  if public.website_dispatch_slot_end(p_date, p_slot) < now() + interval '1 hour' then
    raise exception 'slot too soon' using errcode = '22023';
  end if;
  j := public.portal_pickup_job(p_task);
  if (select count(*) from jsonb_array_elements(j.history) e
       where e ->> 'by' = 'Customer (website)' and e ->> 'action' in ('rescheduled', 'customer changed time')) >= 3 then
    raise exception 'too many changes' using errcode = '42501';
  end if;

  v_label := to_char(p_date, 'Dy DD Mon') || ', ' || initcap(p_slot);
  -- The rider stays when still free in the new window (website_today.sql): active, a rider (ticked,
  -- or nobody ticked yet), not off that day, and fewer scheduled stops there than their stops per
  -- window (default 8; a combined trip counts once, as in today-logic.ts riderLoad).
  if j.assignee_id is not null then
    v_keep := exists (select 1 from public.profiles p where p.id = j.assignee_id and p.active)
      and (exists (select 1 from public.website_riders r where r.profile_id = j.assignee_id and r.can_ride)
           or not exists (select 1 from public.website_riders r where r.can_ride))
      and not exists (select 1 from public.website_rider_days_off d where d.profile_id = j.assignee_id and d.day = p_date)
      and (select count(distinct coalesce(x.trip_key, x.id)) from public.website_dispatch_jobs x
            where x.assignee_id = j.assignee_id and x.stage = 'scheduled'
              and x.slot_date = p_date and x.slot = p_slot and x.id <> j.id)
          < coalesce((select r.stops_per_window from public.website_riders r where r.profile_id = j.assignee_id), 8);
  end if;

  -- Back to "new" either way (the manager re-confirms the call): slot, trip and confirmation are
  -- cleared directly (not through website_dispatch_plan, whose staff rules may refuse some stages).
  update public.website_dispatch_jobs
     set assignee_id = case when v_keep then j.assignee_id end,
         assignee_name = case when v_keep then j.assignee_name end,
         slot_date = null, slot = null, trip_key = null,
         stage = 'new', confirmed_at = null, confirmed_by = null,
         requested = left(v_label || ' (changed by the customer)', 160),
         updated_at = now()
   where id = j.id;
  perform public.website_dispatch_log(j.id, 'Customer (website)', 'customer changed time',
    v_label || case when v_keep then ' · rider kept: ' || coalesce(j.assignee_name, 'assigned rider')
                    when j.assignee_id is not null then ' · rider removed (not free then): ' || coalesce(j.assignee_name, 'assigned rider')
                    else '' end);
  -- The Ops task: a note line and the reminder at the new slot's end; off the rider's list unless kept.
  update public.tasks
     set assigned_to = case when v_keep then assigned_to end,
         assigned_to_name = case when v_keep then assigned_to_name end,
         assignee_ids = case when v_keep then assignee_ids else '{}'::uuid[] end,
         assignee_names = case when v_keep then assignee_names else '{}'::text[] end,
         assigned_by_name = case when v_keep then assigned_by_name else 'Customer (website)' end,
         description = concat_ws(E'\n', description,
           'Customer changed the pickup on the website (' || to_char(now() at time zone 'Asia/Dhaka', 'DD Mon HH24:MI') || '): ' || v_label),
         due_at = public.website_dispatch_slot_end(p_date, p_slot),
         reminded = false
   where id = j.task_id and status <> 'done';
  return public.portal_pickups();
end;
$$;

create or replace function public.portal_pickup_cancel(p_task uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  j public.website_dispatch_jobs;
  v_reason text := nullif(left(btrim(coalesce(p_reason, '')), 200), '');
  v_result jsonb;
begin
  j := public.portal_pickup_job(p_task);
  v_result := public.website_dispatch_close(j.id, 'cancelled',
    'Cancelled by the customer on the website' || coalesce(': ' || v_reason, ''), 'Customer (website)');
  if not coalesce((v_result ->> 'ok')::boolean, false) then
    raise exception 'cancel failed: %', v_result ->> 'error' using errcode = 'P0001';
  end if;
  return public.portal_pickups();
end;
$$;

-- Staff: orders per phone (last p_months and all time), for tier badges on the dispatch board.
create or replace function public.website_customer_order_counts(p_phones text[], p_months integer default 12)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(k.phone, jsonb_build_object('recent', k.recent, 'total', k.total)), '{}'::jsonb)
  from (
    select public.website_dispatch_phone_key(cu.phone) as phone,
           count(o.id) filter (where o.order_date >= (now() at time zone 'Asia/Dhaka')::date
                                 - make_interval(months => least(greatest(coalesce(p_months, 12), 1), 36))) as recent,
           count(o.id) as total
      from public.customers cu
      join public.orders o on o.customer_id = cu.id and o.order_status is distinct from 'Cancelled' and o.order_date is not null
     where public.website_dispatch_phone_key(cu.phone) = any (
             select public.website_dispatch_phone_key(x) from unnest(coalesce(p_phones, '{}')) x limit 500)
     group by 1
  ) k
  where k.phone is not null;
$$;

revoke all on function public.portal_verified_phone() from public, anon, authenticated;
revoke all on function public.portal_pickup_job(uuid) from public, anon, authenticated;
revoke all on function public.portal_pickups() from public, anon;
revoke all on function public.portal_pickup_change(uuid, date, text) from public, anon;
revoke all on function public.portal_pickup_cancel(uuid, text) from public, anon;
revoke all on function public.website_customer_order_counts(text[], integer) from public, anon, authenticated;

grant execute on function public.portal_pickups() to authenticated;
grant execute on function public.portal_pickup_change(uuid, date, text) to authenticated;
grant execute on function public.portal_pickup_cancel(uuid, text) to authenticated;
grant execute on function public.website_customer_order_counts(text[], integer) to service_role;
