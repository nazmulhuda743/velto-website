-- Synthetic test for docs/technical/sql/website_routines.sql. STAGING ONLY.
-- Expected: an error reading "ALL ROUTINE TESTS PASSED (rolled back)". Nothing is kept.
-- Plays a signed-in customer (auth.uid() via request.jwt.claims), a second customer and the
-- Command Center (service_role), and runs Ops' own daily job to see the tasks it makes
-- (needs ops_weekly_pickup_tasks_fix.sql).
do $$
declare
  u uuid := gen_random_uuid();
  u2 uuid := gen_random_uuid();
  r text := lpad((floor(random() * 100000))::int::text, 5, '0');
  phone text := '017' || r || '111';
  cust uuid;
  j jsonb;
  rid uuid;
  sub uuid;
  s record;
  v_dow int := extract(dow from (now() at time zone 'Asia/Dhaka'))::int;
  v_today date := (now() at time zone 'Asia/Dhaka')::date;
begin
  insert into public.customers (name, phone, status) values ('ZZ Routine Test', phone, 'Active') returning id into cust;
  insert into auth.users (id, email, aud, role, instance_id) values (u, 'zz-routine-' || left(u::text, 8) || '@example.invalid', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
  insert into auth.users (id, email, aud, role, instance_id) values (u2, 'zz-routine-' || left(u2::text, 8) || '@example.invalid', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
  insert into public.customer_accounts (auth_user_id, customer_id, full_name, phone, verified_phone, address, area, link_status, terms_version, terms_accepted_at)
  values (u, cust, 'ZZ Routine Test', phone, phone, 'House 9, Road 4', '7', 'linked', 1, now());
  insert into public.customer_accounts (auth_user_id, full_name, phone, terms_version, terms_accepted_at)
  values (u2, 'ZZ No Address', '018' || r || '222', 1, now());

  -- ---------- the customer asks ----------
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  assert public.portal_routine_get() is null, 'no routine yet';
  j := public.portal_routine_request(9, 'afternoon', null, null);
  assert j->>'error' = 'invalid', 'bad weekday refused';
  j := public.portal_routine_request(v_dow, 'noon', null, null);
  assert j->>'error' = 'invalid', 'bad window refused';
  j := public.portal_routine_request(v_dow, 'afternoon', 'curtain-cleaning', null);
  assert j->>'error' = 'invalid', 'household service refused';
  j := public.portal_routine_request(v_dow, 'morning', 'ironing', 'Ring the bell twice');
  assert (j->>'ok')::boolean and (j->>'new')::boolean, 'request: ' || j::text;
  rid := (j->'routine'->>'id')::uuid;
  j := public.portal_routine_get();
  assert j->>'status' = 'requested' and (j->>'weekday')::int = v_dow and j->>'window' = 'morning' and not (j->>'change')::boolean, 'requested: ' || j::text;
  -- Asking again edits the same open request.
  j := public.portal_routine_request(v_dow, 'afternoon', 'ironing', 'Ring the bell twice');
  assert (j->>'ok')::boolean and not (j->>'new')::boolean and (j->'routine'->>'id')::uuid = rid, 'edit same request';
  begin
    execute 'select count(*) from public.website_routines';
    assert false, 'table must not be readable by customers';
  exception when insufficient_privilege then null;
  end;

  -- ---------- someone without an address ----------
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  j := public.portal_routine_request(1, 'morning', null, null);
  assert j->>'error' = 'address', 'address needed: ' || j::text;
  assert public.portal_routine_get() is null, 'cannot see someone else''s routine';
  j := public.portal_routine_pause();
  assert j->>'error' = 'not_found', 'cannot pause someone else''s routine';
  begin
    j := public.website_routine_list();
    assert false, 'customers cannot list routines';
  exception when insufficient_privilege then null;
  end;

  -- ---------- the manager activates ----------
  execute 'reset role';
  execute 'set local role service_role';
  j := public.website_routine_list();
  assert exists (select 1 from jsonb_array_elements(j) x where (x->>'id')::uuid = rid and x->>'status' = 'requested' and x->>'name' = 'ZZ Routine Test'), 'listed';
  j := public.website_routine_decline(rid, '  ', 'QA');
  assert j->>'error' = 'reason', 'decline needs a reason';
  j := public.website_routine_activate(rid, -5, 'QA');
  assert j->>'error' = 'invalid', 'negative price refused';
  j := public.website_routine_activate(rid, 150, 'QA Manager');
  assert (j->>'ok')::boolean, 'activate: ' || j::text;
  sub := (j->>'subscriptionId')::uuid;
  select * into s from public.weekly_subscriptions where id = sub;
  assert s.status = 'active' and s.days = array[v_dow] and s.customer_id = cust and s.phone = phone and s.address = 'House 9, Road 4'
     and s.sector = 'Uttara Sector 7' and s.outlet_code = 'S11' and s.time_window = 'Afternoon (12–4 PM)' and s.service_category = 'Ironing'
     and s.price_per_run = 150 and s.created_by_name = 'QA Manager', 'Ops subscription written: ' || row_to_json(s)::text;
  j := public.website_routine_activate(rid, 150, 'QA');
  assert j->>'error' = 'closed', 'activating twice refused';

  -- Ops' own daily job now makes today's pickup and delivery for it.
  execute 'reset role';
  perform public.create_weekly_pickup_tasks();
  assert exists (select 1 from public.tasks where dedupe_key = 'wk:' || sub::text || ':' || v_today::text || ':pickup'), 'Ops made the pickup task';
  assert exists (select 1 from public.tasks where dedupe_key = 'wk:' || sub::text || ':' || v_today::text || ':delivery'), 'Ops made the delivery task';
  perform public.create_weekly_pickup_tasks();
  assert (select count(*) from public.tasks where source_ref = sub::text) = 2, 'running the job twice makes no duplicates';

  -- ---------- the customer changes, pauses, resumes, stops ----------
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  j := public.portal_routine_get();
  assert j->>'status' = 'active' and (j->>'nextOn')::date = v_today, 'active, next today: ' || j::text;
  j := public.portal_routine_request((v_dow + 1) % 7, 'evening', 'ironing', null);
  assert (j->'routine'->>'change')::boolean, 'a change to a running routine';
  execute 'reset role';
  assert (select status from public.weekly_subscriptions where id = sub) = 'active' and (select days from public.weekly_subscriptions where id = sub) = array[v_dow],
    'the running routine is untouched until the change is confirmed';
  execute 'set local role service_role';
  j := public.website_routine_decline(rid, 'Evening is full on that day', 'QA');
  execute 'reset role';
  assert (select status from public.website_routines where id = rid) = 'active', 'declined change keeps it active';
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  j := public.portal_routine_request((v_dow + 1) % 7, 'morning', 'ironing', null);
  execute 'set local role service_role';
  j := public.website_routine_activate(rid, null, 'QA');
  execute 'reset role';
  select * into s from public.weekly_subscriptions where id = sub;
  assert s.days = array[(v_dow + 1) % 7] and s.time_window = 'Morning (9 AM–12 PM)' and s.price_per_run = 150, 'change applied, price kept';
  assert (select count(*) from public.weekly_subscriptions where customer_id = cust) = 1, 'still one Ops subscription';
  perform public.create_weekly_pickup_tasks();
  assert exists (select 1 from public.tasks where dedupe_key = 'wk:' || sub::text || ':' || (v_today + 1)::text || ':followup'), 'Ops made the day-before confirm call';

  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  j := public.portal_routine_pause();
  assert (j->>'ok')::boolean and j->'routine'->>'status' = 'paused', 'paused';
  execute 'reset role';
  assert (select status from public.weekly_subscriptions where id = sub) = 'paused', 'Ops paused';
  execute 'set local role authenticated';
  j := public.portal_routine_resume();
  assert j->'routine'->>'status' = 'active', 'resumed';
  j := public.portal_routine_stop();
  assert (j->>'ok')::boolean, 'stopped';
  assert public.portal_routine_get() is null, 'nothing open after stopping';
  execute 'reset role';
  select * into s from public.weekly_subscriptions where id = sub;
  assert s.status = 'paused' and s.note like '%Stopped by the customer on the website%', 'Ops kept, paused, noted';

  -- A new request after stopping starts a fresh routine (and a fresh Ops subscription on activation).
  execute 'set local role authenticated';
  j := public.portal_routine_request(2, 'evening', null, null);
  assert (j->>'new')::boolean, 'fresh request after stop';
  execute 'set local role service_role';
  j := public.website_routine_decline((j->'routine'->>'id')::uuid, 'Outside our evening route', 'QA');
  execute 'reset role';
  execute 'set local role authenticated';
  j := public.portal_routine_get();
  assert j->>'status' = 'declined' and j->>'reason' = 'Outside our evening route', 'decline is shown to the customer';

  -- Browser roles.
  execute 'reset role';
  assert not has_function_privilege('anon', 'public.portal_routine_request(integer, text, text, text)', 'execute'), 'anon blocked';
  assert not has_function_privilege('authenticated', 'public.website_routine_activate(uuid, numeric, text)', 'execute'), 'customers cannot activate';
  assert not has_function_privilege('authenticated', 'public.website_routine_json(public.website_routines)', 'execute'), 'helper private';

  raise exception 'ALL ROUTINE TESTS PASSED (rolled back)';
end $$;
