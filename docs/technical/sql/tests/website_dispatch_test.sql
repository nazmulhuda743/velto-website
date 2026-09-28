-- Synthetic test for docs/technical/sql/website_dispatch.sql. STAGING ONLY.
-- Expected: an error reading "ALL DISPATCH TESTS PASSED (rolled back): ...". Nothing is kept.
-- Uses one active profile and (if there is one) the newest Ready order; creates two website
-- booking tasks from the same phone.
do $$
declare
  v_person uuid; v_name text;
  t1 uuid; t2 uuid; j1 uuid; j2 uuid; d uuid; r jsonb; tk record; v_order text; dj record;
  v_log text := '';
begin
  select id, name into v_person, v_name from public.profiles where active order by name limit 1;
  select order_number into v_order from public.orders
   where order_status = 'Ready' and order_number ~ '^VELR?-[0-9]{3,6}$'
     and (updated_at > now() - interval '7 days' or delivery_date >= (now() at time zone 'Asia/Dhaka')::date - 1)
   order by created_at desc limit 1;

  insert into public.tasks (title, type, priority, status, due_at, description, assigned_by_name, source, source_ref, dedupe_key)
  values ('Website pickup - QA One (01712345678)', 'pickup', 'high', 'open', now() + interval '1 hour',
          E'Pickup request from Velto website.\nName: QA One\nPhone: 01712345678\nArea: Uttara Sector 7\nAddress: House 12, Road 7\nPreferred pickup: Tomorrow, Afternoon',
          'Velto website', 'website_booking', '01712345678', 'website:qa-dispatch-0000000001')
  returning id into t1;
  insert into public.tasks (title, type, priority, status, due_at, description, assigned_by_name, source, source_ref, dedupe_key)
  values ('Website pickup - QA One (01712345678)', 'pickup', 'high', 'open', now() + interval '1 hour',
          E'Pickup request from Velto website.\nName: QA One\nPhone: +880 1712-345678\nArea: Uttara Sector 7\nAddress: House 12, Road 7\nPreferred pickup: Today, Evening',
          'Velto website', 'website_booking', '01712345678', 'website:qa-dispatch-0000000002')
  returning id into t2;

  execute 'set local role service_role';

  -- Sync: both requests become pickup jobs, parsed from the task description.
  r := public.website_dispatch_sync();
  v_log := v_log || ' sync=' || r::text;
  select id into j1 from public.website_dispatch_jobs where task_id = t1;
  select id into j2 from public.website_dispatch_jobs where task_id = t2;
  assert j1 is not null and j2 is not null, 'sync created both jobs';
  assert (select customer_name || '|' || phone_key || '|' || area || '|' || address || '|' || requested from public.website_dispatch_jobs where id = j1)
         = 'QA One|01712345678|Uttara Sector 7|House 12, Road 7|Tomorrow, Afternoon', 'description parsed';
  assert (select phone_key from public.website_dispatch_jobs where id = j2) = '01712345678', '+880 phone normalised';

  -- Plan: person + tomorrow afternoon → scheduled; the Ops task is assigned, due 17:00 Dhaka, reminder reset.
  reset role;
  update public.tasks set reminded = true where id = t1;
  execute 'set local role service_role';
  r := public.website_dispatch_plan(j1, v_person, v_name, (now() at time zone 'Asia/Dhaka')::date + 1, 'afternoon', 'QA Manager');
  assert (r->>'ok')::boolean, 'plan ok';
  select * into tk from public.tasks where id = t1;
  assert tk.assigned_to = v_person and tk.assignee_ids = array[v_person] and not tk.reminded
     and tk.assigned_by_name = 'QA Manager' and to_char(tk.due_at at time zone 'Asia/Dhaka', 'HH24:MI') = '17:00', 'pickup task mirrored';
  assert (select stage from public.website_dispatch_jobs where id = j1) = 'scheduled', 'stage scheduled';

  -- Guards.
  assert public.website_dispatch_plan(j1, v_person, v_name, (now() at time zone 'Asia/Dhaka')::date - 1, 'morning', 'QA')->>'error' = 'past', 'no past slots';
  assert public.website_dispatch_plan(j1, v_person, v_name, (now() at time zone 'Asia/Dhaka')::date + 1, 'night', 'QA')->>'error' = 'invalid', 'known slots only';
  assert public.website_dispatch_plan(j1, gen_random_uuid(), 'Nobody', null, null, 'QA')->>'error' = 'assignee', 'active staff only';

  -- Merge the duplicate into the first request.
  r := public.website_dispatch_merge(j1, j2, 'QA Manager');
  assert (r->>'ok')::boolean, 'merge ok';
  assert (select stage || merged_into::text from public.website_dispatch_jobs where id = j2) = 'merged' || j1::text, 'duplicate merged';
  assert (select status from public.tasks where id = t2) = 'done', 'duplicate task closed';
  assert (select description from public.tasks where id = t1) like '%Merged duplicate request (Today, Evening)%', 'kept task mentions the merge';
  assert public.website_dispatch_plan(j2, v_person, v_name, null, null, 'QA')->>'error' = 'closed', 'merged job is closed';

  -- Delivery: a Ready order has a job; planning creates exactly one Ops delivery task; replanning updates it.
  if v_order is not null then
    select id into d from public.website_dispatch_jobs where kind = 'delivery' and order_number = v_order and stage not in ('cancelled', 'merged');
    assert d is not null, 'delivery job for the Ready order';
    r := public.website_dispatch_plan(d, v_person, v_name, (now() at time zone 'Asia/Dhaka')::date + 1, 'evening', 'QA Manager');
    assert (r->>'ok')::boolean, 'plan delivery';
    r := public.website_dispatch_plan(d, v_person, v_name, (now() at time zone 'Asia/Dhaka')::date + 2, 'morning', 'QA Manager');
    assert (select count(*) from public.tasks where dedupe_key = 'website-dispatch:delivery:' || v_order) = 1, 'one delivery task';
    select t.* into tk from public.tasks t join public.website_dispatch_jobs j on j.task_id = t.id where j.id = d;
    assert tk.type = 'delivery' and tk.order_number = v_order and tk.status = 'open'
       and to_char(tk.due_at at time zone 'Asia/Dhaka', 'HH24:MI') = '12:00', 'delivery task mirrored';
    -- Combine: the pickup joins the delivery's trip (same person and slot).
    r := public.website_dispatch_combine(d, j1, 'QA Manager');
    assert (r->>'ok')::boolean, 'combine ok';
    select * into dj from public.website_dispatch_jobs where id = j1;
    assert dj.slot = 'morning' and dj.trip_key = (select trip_key from public.website_dispatch_jobs where id = d), 'same trip';
    -- Unassigning a delivery takes it off the rider's list.
    r := public.website_dispatch_plan(d, null, null, null, null, 'QA Manager');
    assert (select status from public.tasks where id = tk.id) = 'done', 'unassigned delivery task closed';
    v_log := v_log || ' delivery=' || v_order;
  end if;

  -- Cancel needs a reason, then closes the Ops task with it.
  assert public.website_dispatch_close(j1, 'cancelled', '  ', 'QA Manager')->>'error' = 'reason', 'reason required';
  r := public.website_dispatch_close(j1, 'cancelled', 'Customer cancelled', 'QA Manager');
  assert (select status || '|' || done_by_name from public.tasks where id = t1) = 'done|Cancelled by QA Manager: Customer cancelled', 'cancel mirrored';
  assert jsonb_array_length((select history from public.website_dispatch_jobs where id = j1)) >= 3, 'history kept';

  raise exception 'ALL DISPATCH TESTS PASSED (rolled back):%', v_log;
end $$;
