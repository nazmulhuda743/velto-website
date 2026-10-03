-- Synthetic test for docs/technical/sql/website_care.sql. STAGING ONLY.
-- A fake linked customer with one flagged order, another customer, and a phone with
-- notifications on; every rule checked; then a raise rolls everything back.
-- Expected: an error reading "ALL_CARE_TESTS_PASSED (rolled back)".
do $$
declare
  r text := lpad((floor(random() * 1000000))::int::text, 6, '0');
  pa text; pb text;
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid();
  ca uuid; cb uuid;
  o1 uuid; n1 text; o2 uuid; n2 text; o3 uuid; n3 text;
  j jsonb;
  ev record;
  steps text[];
begin
  pa := '017' || r || '61';
  pb := '018' || r || '62';
  insert into customers (name, phone) values ('ZZ Care A', pa) returning id into ca;
  insert into customers (name, phone) values ('ZZ Care B', pb) returning id into cb;
  insert into auth.users (id, phone, phone_confirmed_at, aud, role, instance_id)
  values (ua, '88' || pa, now(), 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
         (ub, '88' || pb, now(), 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
  insert into customer_accounts (auth_user_id, full_name, phone, verified_phone, terms_version, terms_accepted_at, customer_id, link_status)
  values (ua, 'ZZ Care A', pa, pa, 1, now(), ca, 'linked'), (ub, 'ZZ Care B', pb, pb, 1, now(), cb, 'linked');

  -- Order 1: flagged at intake, waiting. Order 2: flagged, waiting (decided by staff later).
  -- Order 3: nothing flagged.
  insert into orders (customer_id, phone_snapshot, name_snapshot, service_category, order_status, advisory_status)
  values (ca, pa, 'ZZ Care A', array['Wash + Iron'], 'Picked', 'pending') returning id, order_number into o1, n1;
  insert into order_risks (order_id, item_name, risk_type, note, photo_paths)
  values (o1, 'Red kurta', 'Colour may bleed / run', 'Wash separately in cold water', array['risks/zz-1.jpg']);
  insert into orders (customer_id, phone_snapshot, name_snapshot, service_category, order_status, advisory_status)
  values (ca, pa, 'ZZ Care A', array['Dry Cleaning'], 'Picked', 'pending') returning id, order_number into o2, n2;
  insert into order_risks (order_id, item_name, risk_type) values (o2, 'Silk saree', 'Delicate — beads / sequins / zari work');
  insert into orders (customer_id, phone_snapshot, name_snapshot, service_category, order_status)
  values (ca, pa, 'ZZ Care A', array['Ironing'], 'Picked') returning id, order_number into o3, n3;

  -- A phone with notifications on for customer A, and one for B.
  insert into website_push_subs (endpoint, p256dh, auth, auth_user_id, customer_id, phone, lang)
  values ('https://fcm.googleapis.com/fcm/send/zz-care-a-' || r, repeat('A', 87), repeat('a', 22), ua, ca, pa, 'bn'),
         ('https://fcm.googleapis.com/fcm/send/zz-care-b-' || r, repeat('B', 87), repeat('b', 22), ub, cb, pb, 'en');

  -- ---------- customer A ----------
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  j := portal_care_get(n1);
  assert j ->> 'status' = 'pending' and jsonb_array_length(j -> 'risks') = 1, format('A sees the flagged garment: %s', j);
  assert j -> 'risks' -> 0 ->> 'item' = 'Red kurta' and j -> 'risks' -> 0 -> 'photos' ->> 0 = 'risks/zz-1.jpg', 'garment, photo path';
  assert portal_care_get(n3) is null, 'nothing to decide on an unflagged order';
  j := portal_care_pending();
  assert jsonb_array_length(j) = 2, format('two orders waiting: %s', j);
  begin perform portal_care_decide(n1, 'maybe'); raise exception 'bad decision accepted'; exception when invalid_parameter_value then null; end;
  j := portal_care_decide(n1, 'approved');
  assert (j ->> 'changed')::boolean and j ->> 'status' = 'approved', format('A approved: %s', j);
  j := portal_care_decide(n1, 'declined');
  assert not (j ->> 'changed')::boolean and j ->> 'status' = 'approved', 'a second press changes nothing';
  assert (portal_care_get(n1) ->> 'decidedOnWebsite')::boolean, 'recorded as a website decision';
  assert jsonb_array_length(portal_care_pending()) = 1, 'one order left waiting';
  execute 'reset role';
  assert (select advisory_status from orders where id = o1) = 'approved', 'Ops sees approved';
  assert (select count(*) from website_care_decisions where order_id = o1) = 1, 'one decision row';

  -- ---------- customer B can't see or decide A's order ----------
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  assert portal_care_get(n2) is null, 'B cannot read A''s order';
  begin perform portal_care_decide(n2, 'approved'); raise exception 'B decided A''s order'; exception when no_data_found then null; end;
  begin perform website_push_care_events(10); raise exception 'customer ran the push events'; exception when insufficient_privilege then null; end;
  execute 'reset role';
  assert (select advisory_status from orders where id = o2) = 'pending', 'A''s order untouched by B';

  -- ---------- pushes ----------
  -- Order 2 is waiting: the first push goes out once, to A's phone only.
  select array_agg(e.step || ':' || e.order_number) into steps from website_push_care_events(100) e where e.order_number in (n1, n2);
  assert steps = array['pending:' || n2], format('first push for the waiting order only: %s', steps);
  select * into ev from website_push_care_events(100) e where e.order_number = n2;
  assert ev is null, 'not sent twice';
  -- 4 hours later (in waking hours) a reminder; pretend the first push was 5 hours ago.
  update website_push_care_sent set sent_at = now() - interval '5 hours' where order_id = o2 and step = 'pending';
  select array_agg(e.step) into steps from website_push_care_events(100) e where e.order_number = n2;
  if extract(hour from (now() at time zone 'Asia/Dhaka')) between 9 and 20 then
    assert steps = array['reminder1'], format('reminder after 4 hours: %s', steps);
  else
    assert steps is null, 'no reminder at night';
  end if;
  -- Staff mark it declined in Ops (customer replied on WhatsApp): "Decision received" goes out.
  update orders set advisory_status = 'declined' where id = o2;
  select array_agg(e.step || ':' || coalesce(e.decision, '')) into steps from website_push_care_events(100) e where e.order_number = n2;
  assert steps = array['decided:declined'], format('decision recorded elsewhere is announced: %s', steps);
  -- A decision made on the website is not announced back (the customer saw it on screen).
  insert into website_push_care_sent (order_id, step) values (o1, 'pending');
  select array_agg(e.step) into steps from website_push_care_events(100) e where e.order_number = n1;
  assert steps is null, format('no push for a website decision: %s', steps);
  -- Targets carry the phone's language.
  update orders set advisory_status = 'pending', updated_at = now() where id = o3;
  insert into order_risks (order_id, item_name) values (o3, 'Jacket');
  select * into ev from website_push_care_events(100) e where e.order_number = n3;
  assert ev.targets -> 0 ->> 'lang' = 'bn' and jsonb_array_length(ev.targets) = 1, format('one target, Bangla: %s', ev.targets);

  raise exception 'ALL_CARE_TESTS_PASSED (rolled back)';
end;
$$;
