-- Customer self-service for website pickups, and loyalty counts for staff screens.
--
-- 1. A signed-in customer whose phone is proven (order history linked by staff/SMS, or signed in
--    with an SMS code) sees their open website pickup requests and can change the day/time or
--    cancel, until 3 hours before the end of a slot Velto has already planned (and at most 3
--    changes per pickup). Changes go through the dispatch functions (website_dispatch.sql), so
--    the dispatch board and the Ops task stay in step:
--      * change  → the job goes back to "new" with the customer's new preference (any planned
--                  person/slot is cleared, so the team re-plans it); the Ops task gets a note line
--                  and its due time moves to the new slot.
--      * cancel  → website_dispatch_close(..., 'cancelled'): the job is cancelled and the Ops task
--                  is closed with "Cancelled by Customer (website): …".
-- 2. website_customer_order_counts: order counts per phone for the dispatch board's tier badge.
--
-- Requires customer_portal.sql (portal_caller, portal_auth_phone) and website_dispatch.sql.
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
           where e ->> 'by' = 'Customer (website)' and e ->> 'action' = 'rescheduled'), 0))
      ) as p
      from public.tasks t
      left join public.website_dispatch_jobs j on j.task_id = t.id
      where t.source = 'website_booking'
        and t.source_ref = v_phone
        and t.status <> 'done'
        and t.created_at > now() - interval '30 days'
        and (j.id is null or j.stage in ('new', 'assigned', 'scheduled'))
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
  if j.id is null or j.stage not in ('new', 'assigned', 'scheduled') then
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
       where e ->> 'by' = 'Customer (website)' and e ->> 'action' = 'rescheduled') >= 3 then
    raise exception 'too many changes' using errcode = '42501';
  end if;

  v_label := to_char(p_date, 'Dy DD Mon') || ', ' || initcap(p_slot);
  -- Back to "new": whatever the team planned no longer fits; they re-plan from the new wish.
  perform public.website_dispatch_plan(j.id, null, null, null, null, 'Customer (website)');
  update public.website_dispatch_jobs
     set requested = left(v_label || ' (changed by the customer)', 160), updated_at = now()
   where id = j.id;
  perform public.website_dispatch_log(j.id, 'Customer (website)', 'rescheduled', v_label);
  update public.tasks
     set description = concat_ws(E'\n', description,
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
