-- Fix for Velto Ops' own daily job public.create_weekly_pickup_tasks() (pg_cron "velto-weekly-pickup-tasks").
--
-- Two bugs made it raise on the first active weekly subscription, so it made no tasks at all. It
-- never showed because weekly_subscriptions was empty until website routines (website_routines.sql).
--   1. It inserted into tasks.note, a column tasks doesn't have (it is tasks.description).
--   2. `on conflict (dedupe_key)` doesn't match the partial unique index tasks_dedupe_uidx
--      (… where dedupe_key is not null), which Postgres requires; website_create_request.sql
--      already uses `on conflict (dedupe_key) where dedupe_key is not null`.
-- The only changes: `note` → `description` in the three insert column lists, and that predicate on
-- the three `on conflict` clauses. Everything else is the function exactly as it was in production
-- on 2026-09-29 (same on staging).
-- Approved by the owner on 2026-09-29. Idempotent.
-- Status: applied to staging and production (2026-09-29).

CREATE OR REPLACE FUNCTION public.create_weekly_pickup_tasks()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  d_today  date := (now() at time zone 'Asia/Dhaka')::date;
  d_tom    date := d_today + 1;
  dow_tod  int  := extract(dow from (now() at time zone 'Asia/Dhaka'))::int;
  dow_tom  int  := extract(dow from ((now() at time zone 'Asia/Dhaka') + interval '1 day'))::int;
  s        record;
  ids      uuid[];
  nms      text[];
begin
  -- TODAY → a pickup task (AM) and a delivery task (PM) for the assigned rider
  for s in select * from public.weekly_subscriptions where status = 'active' and dow_tod = any(days) loop
    ids := case when s.assigned_staff_id is not null then array[s.assigned_staff_id] else '{}'::uuid[] end;
    nms := case when s.assigned_staff_name is not null then array[s.assigned_staff_name] else '{}'::text[] end;
    insert into public.tasks(title,type,assignee_ids,assignee_names,assigned_to,assigned_to_name,assigned_by_name,
                             due_at,outlet_code,priority,status,description,source,source_ref,dedupe_key)
    values('Weekly pickup · '||s.name||coalesce(' ('||s.time_window||')',''),'pickup',ids,nms,
           s.assigned_staff_id,s.assigned_staff_name,'Velto (auto)',
           ((d_today::timestamp) + interval '9 hour') at time zone 'Asia/Dhaka',
           coalesce(s.outlet_code,'S11'), case when s.is_vip then 'high' else 'normal' end,'open',
           coalesce(s.address,'')||coalesce(' · '||s.service_category,'')||' · ৳'||coalesce(s.price_per_run,0)||'/run',
           'weekly',s.id::text,'wk:'||s.id::text||':'||d_today::text||':pickup')
    on conflict (dedupe_key) where dedupe_key is not null do nothing;

    insert into public.tasks(title,type,assignee_ids,assignee_names,assigned_to,assigned_to_name,assigned_by_name,
                             due_at,outlet_code,priority,status,description,source,source_ref,dedupe_key)
    values('Weekly delivery · '||s.name,'delivery',ids,nms,
           s.assigned_staff_id,s.assigned_staff_name,'Velto (auto)',
           ((d_today::timestamp) + interval '17 hour') at time zone 'Asia/Dhaka',
           coalesce(s.outlet_code,'S11'),'normal','open',
           'Return the finished '||coalesce(s.service_category,'items')||' to '||coalesce(s.address,s.name),
           'weekly',s.id::text,'wk:'||s.id::text||':'||d_today::text||':delivery')
    on conflict (dedupe_key) where dedupe_key is not null do nothing;
  end loop;

  -- TOMORROW → a HIGH-priority confirm/follow-up the day before
  for s in select * from public.weekly_subscriptions where status = 'active' and dow_tom = any(days) loop
    ids := case when s.assigned_staff_id is not null then array[s.assigned_staff_id] else '{}'::uuid[] end;
    nms := case when s.assigned_staff_name is not null then array[s.assigned_staff_name] else '{}'::text[] end;
    insert into public.tasks(title,type,assignee_ids,assignee_names,assigned_to,assigned_to_name,assigned_by_name,
                             due_at,outlet_code,priority,status,description,source,source_ref,dedupe_key)
    values('Confirm tomorrow''s pickup · '||s.name||coalesce(' ('||s.time_window||')',''),'call',ids,nms,
           s.assigned_staff_id,s.assigned_staff_name,'Velto (auto)',
           ((d_today::timestamp) + interval '19 hour') at time zone 'Asia/Dhaka',
           coalesce(s.outlet_code,'S11'),'high','open',
           'Message '||s.name||' to confirm tomorrow''s '||coalesce(s.time_window,'pickup')||' — '||coalesce(s.address,''),
           'weekly',s.id::text,'wk:'||s.id::text||':'||d_tom::text||':followup')
    on conflict (dedupe_key) where dedupe_key is not null do nothing;
  end loop;
end $function$;
