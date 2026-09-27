-- Synthetic test for docs/technical/sql/website_customer_extras.sql. STAGING ONLY.
-- Creates a fake signed-in customer with fake orders, calls every function as that customer
-- (auth.uid() via request.jwt.claims) and as service_role, then raises so everything rolls back.
-- Expected: an error reading "ALL_TESTS_PASSED (rolled back)". Ops assigns its own order
-- numbers, so the test reads them back instead of relying on the ones it inserts.
do $$
declare
  today date := (now() at time zone 'Asia/Dhaka')::date;
  u uuid := gen_random_uuid();
  u2 uuid := gen_random_uuid();
  cust uuid;
  r text := lpad((floor(random() * 1000000))::int::text, 6, '0');
  phone text;
  delivered text; active text; old text;
  j jsonb;
  t_id uuid;
  n_comments int;
begin
  phone := '017' || r || '77';
  insert into customers (name, phone, status) values ('ZZ Extras Test', phone, 'Active') returning id into cust;
  insert into orders (customer_id, order_number, order_date, order_status, service_category) values (cust, 'ZZX-1', today - 3, 'Delivered', array['Ironing']);
  insert into orders (customer_id, order_number, order_date, order_status, service_category) values (cust, 'ZZX-2', today - 1, 'Picked', array['Ironing']);
  insert into orders (customer_id, order_number, order_date, order_status, service_category) values (cust, 'ZZX-3', today - 400, 'Delivered', array['Dry Cleaning']);
  insert into orders (customer_id, order_number, order_date, order_status, service_category) values (cust, 'ZZX-4', today - 20, 'Cancelled', array['Ironing']);
  select order_number into delivered from orders where customer_id = cust and order_date = today - 3;
  select order_number into active from orders where customer_id = cust and order_date = today - 1;
  select order_number into old from orders where customer_id = cust and order_date = today - 400;

  insert into auth.users (id, email, aud, role, instance_id) values (u, 'zz-extras-' || left(u::text, 8) || '@example.invalid', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
  insert into auth.users (id, email, aud, role, instance_id) values (u2, 'zz-extras-' || left(u2::text, 8) || '@example.invalid', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
  insert into customer_accounts (auth_user_id, customer_id, full_name, phone, verified_phone, link_status, terms_version, terms_accepted_at)
  values (u, cust, 'ZZ Extras Test', phone, phone, 'linked', 1, now());
  insert into customer_accounts (auth_user_id, full_name, phone, terms_version, terms_accepted_at)
  values (u2, 'ZZ Unlinked', '018' || r || '78', 1, now());

  -- ---------- as the linked customer ----------
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  j := portal_loyalty(12);
  assert (j ->> 'linked')::boolean and (j ->> 'recent')::int = 2 and (j ->> 'total')::int = 3, format('loyalty counts: %s', j);

  -- Rating an order that isn't delivered, or someone else's, is refused.
  begin perform portal_feedback_save(active, 5); raise exception 'active order rated'; exception when invalid_parameter_value then null; end;
  begin perform portal_feedback_save('VEL-99999', 5); raise exception 'unknown order rated'; exception when no_data_found then null; end;
  begin perform portal_feedback_save(delivered, 9); raise exception 'rating 9 accepted'; exception when invalid_parameter_value then null; end;

  -- Happy: saved, no task.
  j := portal_feedback_save(delivered, 5, array['junk'], '  Great  ');
  assert (j ->> 'rating')::int = 5 and j ->> 'comment' = 'Great' and jsonb_array_length(j -> 'issues') = 0, format('happy save: %s', j);
  execute 'reset role';
  assert (select task_id from customer_order_feedback where customer_id = cust and order_number = delivered) is null, 'no task for 5';

  -- Changed to unhappy: one urgent task, no name or phone in it.
  execute 'set local role authenticated';
  j := portal_feedback_save(delivered, 2, array['stain', 'late', 'stain'], 'Collar still dirty');
  assert j -> 'issues' = '["late", "stain"]'::jsonb, format('issues cleaned: %s', j);
  execute 'reset role';
  select task_id into t_id from customer_order_feedback where customer_id = cust and order_number = delivered;
  assert t_id is not null, 'task created';
  assert (select priority from website_board_tasks where id = t_id) = 'urgent', 'urgent for 2';
  assert (select labels from website_board_tasks where id = t_id) = array['feedback'], 'feedback label';
  assert (select description from website_board_tasks where id = t_id) like '%Collar still dirty%', 'comment in task';
  assert (select description not like '%' || phone || '%' and title not like '%ZZ Extras%' from website_board_tasks where id = t_id), 'no customer identity on the board';

  -- Edits after that add comments, not new tasks.
  execute 'set local role authenticated';
  perform portal_feedback_save(delivered, 3, array['stain'], 'Still a mark');
  perform portal_feedback_save(delivered, 4);
  execute 'reset role';
  assert (select count(*) from website_board_tasks where title like '%' || delivered || '%' and created_by_name = 'Website (customer feedback)') = 1, 'one task only';
  select count(*) into n_comments from website_board_comments where task_id = t_id;
  assert n_comments = 2, format('two follow-up comments, got %s', n_comments);

  -- 14 days after the first rating it is closed.
  update customer_order_feedback set created_at = now() - interval '15 days' where customer_id = cust and order_number = delivered;
  execute 'set local role authenticated';
  begin perform portal_feedback_save(delivered, 1); raise exception 'closed feedback edited'; exception when insufficient_privilege then null; end;
  j := portal_feedback_list();
  assert jsonb_array_length(j) = 1 and not (j -> 0 ->> 'editable')::boolean, format('list: %s', j);

  -- Preferences: only known values are kept.
  j := portal_prefs_save(
    '{"shirts": "hanger", "starch": "extra", "fragrance": "none", "separate": "true", "note": " Silk: hand wash ", "hack": "x"}'::jsonb,
    '[{"label": "Home", "address": "House 1, Road 2", "area": "7"}, {"label": "", "address": "  "}, {"label": "Office", "address": "Level 3", "area": "outside", "x": 1}]'::jsonb
  );
  assert j -> 'care' = '{"shirts": "hanger", "fragrance": "none", "separate": true, "note": "Silk: hand wash"}'::jsonb, format('care: %s', j -> 'care');
  assert jsonb_array_length(j -> 'addresses') = 2 and j -> 'addresses' -> 1 = '{"label": "Office", "address": "Level 3", "area": "outside"}'::jsonb, format('addresses: %s', j -> 'addresses');
  assert portal_prefs_get() = j, 'get = saved';
  begin perform portal_prefs_save('{}', '[{"address": "x", "area": "19"}]'); raise exception 'bad area accepted'; exception when invalid_parameter_value then null; end;
  begin perform portal_prefs_save('{}', '[{"address":"a"},{"address":"b"},{"address":"c"},{"address":"d"}]'); raise exception '4 addresses accepted'; exception when invalid_parameter_value then null; end;

  -- Direct table access is closed.
  begin perform 1 from customer_order_feedback; raise exception 'feedback readable'; exception when insufficient_privilege then null; end;
  begin perform 1 from customer_preferences; raise exception 'prefs readable'; exception when insufficient_privilege then null; end;
  begin perform website_feedback_list(10); raise exception 'staff list open to customers'; exception when insufficient_privilege then null; end;
  execute 'reset role';

  -- ---------- an unlinked customer ----------
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  assert portal_loyalty() = '{"linked": false}'::jsonb, 'unlinked loyalty';
  assert portal_feedback_list() = '[]'::jsonb, 'unlinked list';
  begin perform portal_feedback_save(delivered, 5); raise exception 'unlinked rated'; exception when insufficient_privilege then null; end;
  assert portal_prefs_get() = '{"care": {}, "addresses": []}'::jsonb, 'nobody else sees the prefs';
  execute 'reset role';

  -- ---------- anonymous ----------
  execute 'set local role anon';
  begin perform portal_loyalty(); raise exception 'anon loyalty'; exception when insufficient_privilege then null; end;
  execute 'reset role';

  -- ---------- staff (service_role) ----------
  execute 'set local role service_role';
  j := website_feedback_list(500);
  assert exists (select 1 from jsonb_array_elements(j) e where e ->> 'orderNumber' = delivered and e ->> 'customerPhone' = phone and (e ->> 'rating')::int = 4), 'staff list shows who';
  assert website_feedback_handle((select id from customer_order_feedback where customer_id = cust), 'Tester'), 'handled';
  assert not website_feedback_handle((select id from customer_order_feedback where customer_id = cust), 'Tester'), 'handled only once';
  j := website_loyalty_distribution(12, array[1, 4, 8, 16]);
  assert (j ->> 'customers')::int >= 1 and jsonb_array_length(j -> 'tiers') >= 1, format('distribution: %s', j);
  begin update customer_order_feedback set rating = 5; raise exception 'staff changed a rating'; exception when insufficient_privilege then null; end;
  begin delete from customer_order_feedback; raise exception 'staff deleted feedback'; exception when insufficient_privilege then null; end;
  execute 'reset role';

  raise exception 'ALL_TESTS_PASSED (rolled back)';
end $$;
