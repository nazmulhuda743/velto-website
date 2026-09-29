-- Synthetic test for docs/technical/sql/website_customer_pickups.sql. STAGING ONLY.
-- Fake customers (one signed in by SMS code, one with a different phone, one with no proven
-- phone), fake website pickup tasks; every rule checked as those customers; then a raise rolls
-- everything back. Expected: an error reading "ALL_TESTS_PASSED (rolled back)".
do $$
declare
  today date := (now() at time zone 'Asia/Dhaka')::date;
  r text := lpad((floor(random() * 1000000))::int::text, 6, '0');
  pa text; pb text;
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); uc uuid := gen_random_uuid();
  t1 uuid; t2 uuid; tb uuid;
  job uuid;
  j jsonb;
  cust uuid;
begin
  pa := '017' || r || '51';
  pb := '018' || r || '52';
  insert into auth.users (id, email, phone, phone_confirmed_at, aud, role, instance_id)
  values (ua, null, '88' || pa, now(), 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
         (ub, null, '88' || pb, now(), 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
         (uc, 'zz-pickups-' || left(uc::text, 8) || '@example.invalid', null, null, 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
  insert into customer_accounts (auth_user_id, full_name, phone, terms_version, terms_accepted_at)
  values (ua, 'ZZ Pickup A', pa, 1, now()), (ub, 'ZZ Pickup B', pb, 1, now()), (uc, 'ZZ Pickup C', '019' || r || '53', 1, now());

  insert into tasks (title, type, priority, status, due_at, description, assigned_by_name, source, source_ref, dedupe_key)
  values ('ZZ pickup 1', 'pickup', 'high', 'open', now() + interval '1 hour',
          E'Pickup request from Velto website.\nName: ZZ Pickup A\nPhone: ' || pa || E'\nArea: Uttara Sector 7\nAddress: Road 1\nPreferred pickup: Tomorrow, Morning',
          'Velto website', 'website_booking', pa, 'zz-pickups-1-' || r)
  returning id into t1;
  insert into tasks (title, type, priority, status, due_at, description, assigned_by_name, source, source_ref, dedupe_key)
  values ('ZZ pickup 2', 'pickup', 'high', 'open', now() + interval '1 hour',
          E'Name: ZZ Pickup A\nPhone: ' || pa || E'\nPreferred pickup: Today, Evening',
          'Velto website', 'website_booking', pa, 'zz-pickups-2-' || r)
  returning id into t2;
  insert into tasks (title, type, priority, status, due_at, description, assigned_by_name, source, source_ref, dedupe_key)
  values ('ZZ pickup B', 'pickup', 'high', 'open', now() + interval '1 hour',
          E'Name: ZZ Pickup B\nPhone: ' || pb || E'\nPreferred pickup: Tomorrow, Evening',
          'Velto website', 'website_booking', pb, 'zz-pickups-b-' || r)
  returning id into tb;

  -- ---------- customer A (SMS-verified phone) ----------
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  j := portal_pickups();
  assert (j ->> 'verified')::boolean and jsonb_array_length(j -> 'pickups') = 2, format('A sees two pickups: %s', j);
  assert exists (select 1 from jsonb_array_elements(j -> 'pickups') p where p ->> 'id' = t1::text and p ->> 'requested' = 'Tomorrow, Morning' and (p ->> 'changeable')::boolean), 'preferred time shown, changeable';
  -- Not theirs.
  begin perform portal_pickup_cancel(tb); raise exception 'A cancelled B''s pickup'; exception when no_data_found then null; end;
  -- Bad times.
  begin perform portal_pickup_change(t1, today - 1, 'morning'); raise exception 'past day accepted'; exception when invalid_parameter_value then null; end;
  begin perform portal_pickup_change(t1, today + 15, 'morning'); raise exception '15 days ahead accepted'; exception when invalid_parameter_value then null; end;
  begin perform portal_pickup_change(t1, today + 1, 'night'); raise exception 'bad slot accepted'; exception when invalid_parameter_value then null; end;
  -- A good change: the board job appears (sync), goes to "new", the Ops task moves.
  j := portal_pickup_change(t1, today + 2, 'afternoon');
  execute 'reset role';
  select id into job from website_dispatch_jobs where task_id = t1;
  assert job is not null, 'job created by sync';
  assert (select stage from website_dispatch_jobs where id = job) = 'new', 'back to new';
  assert (select requested from website_dispatch_jobs where id = job) like '%Afternoon (changed by the customer)', 'wish recorded';
  assert (select due_at from tasks where id = t1) = website_dispatch_slot_end(today + 2, 'afternoon'), 'Ops task due at the new slot end';
  assert (select description from tasks where id = t1) like '%Customer changed the pickup on the website%', 'note line on the Ops task';

  -- Staff plan it; the customer can still change well before the slot; the plan is cleared.
  perform website_dispatch_plan(job, null, null, today + 3, 'evening', 'ZZ Staff');
  assert (select stage from website_dispatch_jobs where id = job) = 'assigned', 'planned by staff';
  execute 'set local role authenticated';
  perform portal_pickup_change(t1, today + 4, 'morning');
  execute 'reset role';
  assert (select slot_date is null and stage = 'new' from website_dispatch_jobs where id = job), 'staff plan cleared after a customer change';

  -- Staff called and confirmed a time; the customer changes it: back to new, confirmation cleared.
  -- (Set directly, as website_dispatch_contact would, so this test doesn't depend on its version.)
  update website_dispatch_jobs set stage = 'confirmed', confirmed_at = now(), confirmed_by = 'ZZ Staff', slot_date = today + 3, slot = 'evening' where id = job;
  execute 'set local role authenticated';
  j := portal_pickups();
  assert (select p ->> 'stage' = 'confirmed' and (p ->> 'changeable')::boolean from jsonb_array_elements(j -> 'pickups') p where p ->> 'id' = t1::text), 'confirmed pickup listed and changeable';
  perform portal_pickup_change(t1, today + 5, 'afternoon');
  execute 'reset role';
  assert (select stage = 'new' and confirmed_at is null and slot_date is null from website_dispatch_jobs where id = job), 'confirmation cleared after a customer change';

  -- Past the cutoff (3 hours before a planned slot ends): refused.
  update website_dispatch_jobs set slot_date = today - 1, slot = 'morning', stage = 'assigned' where id = job;
  execute 'set local role authenticated';
  j := portal_pickups();
  assert not (select (p ->> 'changeable')::boolean from jsonb_array_elements(j -> 'pickups') p where p ->> 'id' = t1::text), 'shown as not changeable';
  begin perform portal_pickup_change(t1, today + 5, 'morning'); raise exception 'change after cutoff'; exception when insufficient_privilege then null; end;
  begin perform portal_pickup_cancel(t1); raise exception 'cancel after cutoff'; exception when insufficient_privilege then null; end;
  execute 'reset role';

  -- Three changes per pickup, then WhatsApp.
  update website_dispatch_jobs set slot_date = null, slot = null, stage = 'new' where id = job;
  execute 'set local role authenticated';
  j := portal_pickups();
  assert (select (p ->> 'changesLeft')::int from jsonb_array_elements(j -> 'pickups') p where p ->> 'id' = t1::text) = 0, 'no changes left';
  begin perform portal_pickup_change(t1, today + 7, 'morning'); raise exception 'fourth change accepted'; exception when insufficient_privilege then null; end;

  -- Cancel the other pickup: job cancelled, Ops task closed, gone from the list.
  j := portal_pickup_cancel(t2, 'Travelling');
  assert not exists (select 1 from jsonb_array_elements(j -> 'pickups') p where p ->> 'id' = t2::text), 'cancelled pickup leaves the list';
  execute 'reset role';
  assert (select stage from website_dispatch_jobs where task_id = t2) = 'cancelled', 'job cancelled';
  assert (select status = 'done' and done_by_name like 'Cancelled by Customer (website)%Travelling%' from tasks where id = t2), 'Ops task closed with the reason';

  -- ---------- customer B sees only their own ----------
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  j := portal_pickups();
  assert jsonb_array_length(j -> 'pickups') = 1 and j -> 'pickups' -> 0 ->> 'id' = tb::text, 'B sees only theirs';
  execute 'reset role';

  -- ---------- customer C: no proven phone ----------
  perform set_config('request.jwt.claims', json_build_object('sub', uc, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  assert portal_pickups() = '{"verified": false, "pickups": []}'::jsonb, 'unverified sees nothing';
  begin perform portal_pickup_cancel(tb); raise exception 'unverified cancelled'; exception when insufficient_privilege then null; end;
  begin perform portal_verified_phone(); raise exception 'helper callable'; exception when insufficient_privilege then null; end;
  begin perform website_customer_order_counts(array[pa]); raise exception 'staff counts open to customers'; exception when insufficient_privilege then null; end;
  execute 'reset role';

  execute 'set local role anon';
  begin perform portal_pickups(); raise exception 'anon pickups'; exception when insufficient_privilege then null; end;
  execute 'reset role';

  -- ---------- staff: order counts per phone ----------
  insert into customers (name, phone, status) values ('ZZ Pickup A', pa, 'Active') returning id into cust;
  insert into orders (customer_id, order_number, order_date, order_status, service_category) values
    (cust, 'ZZP-1', today - 10, 'Delivered', array['Ironing']),
    (cust, 'ZZP-2', today - 400, 'Delivered', array['Ironing']),
    (cust, 'ZZP-3', today - 5, 'Cancelled', array['Ironing']);
  execute 'set local role service_role';
  j := website_customer_order_counts(array[pa, '0000'], 12);
  assert j -> pa = '{"recent": 1, "total": 2}'::jsonb, format('counts: %s', j);
  execute 'reset role';

  raise exception 'ALL_TESTS_PASSED (rolled back)';
end $$;
