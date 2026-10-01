-- Synthetic test for docs/technical/sql/website_dispatch_stages.sql. STAGING ONLY.
-- Expected: an error reading "ALL STAGE TESTS PASSED (rolled back): ...". Nothing is kept.
-- Uses one active profile and the newest order in Ops; creates one website booking task.
do $$
declare
  v_person uuid; v_name text; v_order text; v_phone text;
  t1 uuid; t2 uuid; j1 uuid; j2 uuid; r jsonb; tk record; jb record;
  v_tomorrow date := (now() at time zone 'Asia/Dhaka')::date + 1;
  v_log text := '';
begin
  select id, name into v_person, v_name from public.profiles where active order by name limit 1;
  select order_number, phone_snapshot into v_order, v_phone from public.orders
   where order_number ~ '^VELR?-[0-9]{3,6}$' and phone_snapshot ~ '^01[0-9]{9}$' order by created_at desc limit 1;

  insert into public.tasks (title, type, priority, status, due_at, description, assigned_by_name, source, source_ref, dedupe_key)
  values ('Website pickup - QA Stage (01712345699)', 'pickup', 'high', 'open', now() + interval '1 hour',
          E'Pickup request from Velto website.\nName: QA Stage\nPhone: 01712345699\nArea: Uttara Sector 7\nAddress: House 1, Road 1\nPreferred pickup: Tomorrow, Afternoon',
          'Velto website', 'website_booking', '01712345699', 'website:qa-stages-000000000001')
  returning id into t1;
  insert into public.tasks (title, type, priority, status, due_at, description, assigned_by_name, source, source_ref, dedupe_key)
  values ('Website pickup - QA Done (01712345698)', 'pickup', 'high', 'open', now() + interval '1 hour',
          E'Pickup request from Velto website.\nName: QA Done\nPhone: 01712345698\nArea: Uttara Sector 7\nAddress: House 2, Road 1',
          'Velto website', 'website_booking', '01712345698', 'website:qa-stages-000000000002')
  returning id into t2;

  execute 'set local role service_role';

  r := public.website_dispatch_sync();
  select id into j1 from public.website_dispatch_jobs where task_id = t1;
  select id into j2 from public.website_dispatch_jobs where task_id = t2;
  assert j1 is not null and j2 is not null, 'sync created the jobs';
  assert (select stage from public.website_dispatch_jobs where id = j1) = 'new', 'starts new';

  -- No answer twice: counted, still new.
  r := public.website_dispatch_contact(j1, 'no_answer', null, null, 'QA');
  assert (r->>'ok')::boolean and (r->>'attempts')::int = 1, 'first no answer: ' || r::text;
  r := public.website_dispatch_contact(j1, 'no_answer', null, null, 'QA');
  assert (select contact_attempts from public.website_dispatch_jobs where id = j1) = 2, 'two attempts';
  assert (select stage from public.website_dispatch_jobs where id = j1) = 'new', 'still new after no answer';

  -- A confirmation without a slot is refused and writes nothing.
  r := public.website_dispatch_contact(j1, 'confirmed', null, null, 'QA');
  assert r->>'error' = 'invalid', 'confirm needs a slot';
  assert (select contact_attempts from public.website_dispatch_jobs where id = j1) = 2, 'refused confirm writes nothing';
  r := public.website_dispatch_contact(j1, 'confirmed', v_tomorrow - 3, 'morning', 'QA');
  assert r->>'error' = 'past', 'past day refused';

  -- Confirmed tomorrow afternoon, no person yet: stage confirmed; the Ops task is due at 17:00 Dhaka.
  r := public.website_dispatch_contact(j1, 'confirmed', v_tomorrow, 'afternoon', 'QA');
  assert (r->>'ok')::boolean, 'confirm: ' || r::text;
  select * into jb from public.website_dispatch_jobs where id = j1;
  assert jb.stage = 'confirmed' and jb.slot_date = v_tomorrow and jb.slot = 'afternoon' and jb.confirmed_by = 'QA' and jb.contact_attempts = 3,
    'confirmed: ' || jb.stage || ' ' || coalesce(jb.slot, '-');
  select * into tk from public.tasks where id = t1;
  assert tk.due_at = public.website_dispatch_slot_end(v_tomorrow, 'afternoon'), 'task due at slot end';

  -- Give it a person: scheduled (Assigned). Take the person away again: back to confirmed.
  r := public.website_dispatch_plan(j1, v_person, v_name, v_tomorrow, 'afternoon', 'QA');
  assert (select stage from public.website_dispatch_jobs where id = j1) = 'scheduled', 'person + slot = scheduled';
  r := public.website_dispatch_plan(j1, null, null, v_tomorrow, 'afternoon', 'QA');
  assert (select stage from public.website_dispatch_jobs where id = j1) = 'confirmed', 'no person again = confirmed';
  r := public.website_dispatch_plan(j1, v_person, v_name, v_tomorrow, 'afternoon', 'QA');
  select * into tk from public.tasks where id = t1;
  assert tk.assigned_to = v_person and tk.status = 'open', 'Ops task assigned';

  -- Notes and WhatsApp sends go to the history.
  r := public.website_dispatch_note(j1, 'note', 'Gate code 1234', 'QA');
  assert (r->>'ok')::boolean, 'note';
  r := public.website_dispatch_note(j1, 'whatsapp', 'Confirmation (Bangla)', 'QA');
  assert (r->>'ok')::boolean, 'whatsapp log';
  r := public.website_dispatch_note(j1, 'other', 'x', 'QA');
  assert r->>'error' = 'invalid', 'unknown note kind refused';
  r := public.website_dispatch_note(j1, 'note', '   ', 'QA');
  assert r->>'error' = 'invalid', 'empty note refused';

  -- Picked up with an unknown order number is refused; without one it's picked and the Ops task is done.
  r := public.website_dispatch_pick(j1, 'VEL-999999', 'QA');
  assert r->>'error' = 'order', 'unknown order refused';
  assert (select stage from public.website_dispatch_jobs where id = j1) = 'scheduled', 'refused pick changes nothing';
  r := public.website_dispatch_pick(j1, null, 'QA');
  assert (r->>'ok')::boolean, 'pick: ' || r::text;
  select * into jb from public.website_dispatch_jobs where id = j1;
  assert jb.stage = 'picked' and jb.picked_at is not null, 'picked';
  assert (select status from public.tasks where id = t1) = 'done', 'Ops task done on pick';
  r := public.website_dispatch_pick(j1, null, 'QA');
  assert r->>'error' = 'closed', 'second pick refused';
  r := public.website_dispatch_plan(j1, v_person, v_name, v_tomorrow, 'morning', 'QA');
  assert r->>'error' = 'closed', 'picked job cannot be planned';

  -- Link the Ops order (and unlink): the task carries the number too.
  if v_order is not null then
    r := public.website_dispatch_link_order(j1, lower(v_order), 'QA');
    assert (r->>'ok')::boolean, 'link: ' || r::text;
    assert (select order_number from public.website_dispatch_jobs where id = j1) = v_order, 'order linked (upper-cased)';
    assert (select order_number from public.tasks where id = t1) = v_order, 'task has the order number';
    r := public.website_dispatch_context(array[v_phone, 'not-a-phone'], array[v_order]);
    assert (r->'orders'->v_order->>'status') is not null, 'context has the linked order';
    assert (r->'customers'->v_phone->>'orders')::int >= 1, 'context counts the phone''s orders';
    assert r->'customers'->'not-a-phone' is null, 'non-phones ignored';
    r := public.website_dispatch_link_order(j1, null, 'QA');
    assert (select order_number from public.website_dispatch_jobs where id = j1) is null, 'unlinked';
    v_log := v_log || ' order=' || v_order;
  end if;
  r := public.website_dispatch_link_order(j2, 'VEL-00001', 'QA');
  assert r->>'error' = 'invalid', 'cannot link an order before pickup';

  -- A pickup task finished in Ops becomes "picked" on the next sync.
  reset role;
  update public.tasks set status = 'done', done_at = now(), done_by_name = 'Rider QA' where id = t2;
  execute 'set local role service_role';
  r := public.website_dispatch_sync();
  select * into jb from public.website_dispatch_jobs where id = j2;
  assert jb.stage = 'picked' and jb.picked_at is not null, 'Ops done = picked: ' || jb.stage;

  -- Cancel still works from confirmed.
  reset role;
  insert into public.tasks (title, type, priority, status, due_at, description, assigned_by_name, source, source_ref, dedupe_key)
  values ('Website pickup - QA Cancel', 'pickup', 'high', 'open', now() + interval '1 hour',
          E'Name: QA Cancel\nPhone: 01712345697\nArea: Uttara Sector 7', 'Velto website', 'website_booking', '01712345697', 'website:qa-stages-000000000003')
  returning id into t1;
  execute 'set local role service_role';
  r := public.website_dispatch_sync();
  select id into j1 from public.website_dispatch_jobs where task_id = t1;
  r := public.website_dispatch_contact(j1, 'confirmed', v_tomorrow, 'evening', 'QA');
  r := public.website_dispatch_close(j1, 'cancelled', 'Customer cancelled', 'QA');
  assert (r->>'ok')::boolean and (select stage from public.website_dispatch_jobs where id = j1) = 'cancelled', 'cancel from confirmed';
  assert (select status from public.tasks where id = t1) = 'done', 'cancel closes the Ops task';

  -- Deliveries: no job for an order left at Ready for weeks with an old delivery date.
  assert not exists (
    select 1 from public.website_dispatch_jobs j join public.orders o on o.order_number = j.order_number
     where j.kind = 'delivery' and j.created_at > now() - interval '1 minute'
       and o.updated_at < now() - interval '30 days' and (o.delivery_date is null or o.delivery_date < (now() at time zone 'Asia/Dhaka')::date - 1)
  ), 'stale Ready orders are not imported';

  raise exception 'ALL STAGE TESTS PASSED (rolled back):%', v_log;
end;
$$;
