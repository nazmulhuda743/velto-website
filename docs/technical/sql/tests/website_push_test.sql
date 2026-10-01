-- Synthetic test for docs/technical/sql/website_push.sql. STAGING ONLY. Rolls back.
-- Expected: an error reading "ALL_TESTS_PASSED (rolled back)".
do $$
declare
  r text := lpad((floor(random() * 1000000))::int::text, 6, '0');
  ph text; uid uuid := gen_random_uuid(); cust uuid; ord uuid; j jsonb; n int; v_code text;
  ep text; k text := repeat('A', 87); a text := repeat('B', 22);
begin
  ph := '017' || r || '77';
  ep := 'https://fcm.googleapis.com/fcm/send/zz-' || r;
  insert into auth.users (id, phone, phone_confirmed_at, aud, role, instance_id)
  values (uid, '88' || ph, now(), 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
  insert into customers (name, phone, zone, status) values ('Md. Zz Push', ph, 'Uttara', 'Active') returning id into cust;
  insert into customer_accounts (auth_user_id, full_name, phone, customer_id, verified_phone, link_status, terms_version, terms_accepted_at)
  values (uid, 'Zz Push', ph, cust, ph, 'linked', 1, now());

  -- Keys: first caller wins.
  j := website_push_keys_init(repeat('P', 87), '{"k":1}');
  assert website_push_keys_init(repeat('Q', 87), '{"k":2}') ->> 'publicKey' = j ->> 'publicKey', 'keys kept';

  -- Subscribe from the account.
  j := website_push_save_for_user(uid, ep, k, a, 'bn', 'test');
  assert (j ->> 'devices')::int = 1 and (j ->> 'orderUpdates')::boolean, format('status %s', j);
  assert (select customer_id = cust and phone = ph from website_push_subs where endpoint = ep), 'tied to customer and phone';
  update website_push_subs set created_at = now() - interval '1 minute' where endpoint = ep;

  -- An order picked up after that: announced once.
  insert into orders (customer_id, order_number, order_date, order_status, service_category, total_amount, ironing_items)
  values (cust, 'ZZP-' || r, current_date, 'Picked', array['Ironing'], 250, 12) returning id into ord;
  select count(*) into n from website_push_order_events(100) e where e.order_id = ord and e.status = 'Picked' and e.first_name = 'Zz' and jsonb_array_length(e.targets) = 1 and e.items = 12;
  assert n = 1, 'picked announced';
  select count(*) into n from website_push_order_events(100) e where e.order_id = ord;
  assert n = 0, 'not twice';
  update orders set order_status = 'Ready' where id = ord;
  select count(*) into n from website_push_order_events(100) e where e.order_id = ord and e.status = 'Ready';
  assert n = 1, 'ready announced';
  -- Order updates switched off: nothing.
  perform website_push_prefs(uid, false, true);
  update orders set order_status = 'Delivered' where id = ord;
  select count(*) into n from website_push_order_events(100) e where e.order_id = ord;
  assert n = 0, 'order updates off';

  -- Reminders by push instead of SMS, unless switched off.
  assert (select count(*) from website_push_targets_for_customer(cust)) = 1, 'reminder target';
  perform website_push_prefs(uid, true, false);
  assert (select count(*) from website_push_targets_for_customer(cust)) = 0, 'reminders off';
  perform website_push_prefs(uid, true, true);

  -- From a reminder link (no login).
  perform website_rhythm_refresh();
  v_code := website_rhythm_record(cust, 'regular_due', 'push', 'bn');
  assert v_code ~ '^[A-Za-z0-9_-]{8}$', 'push touch has a code';
  assert website_push_save_for_code(v_code, ep || '-2', k, a, 'bn', 'test'), 'saved by code';
  assert (select customer_id = cust and auth_user_id is null from website_push_subs where endpoint = ep || '-2'), 'code sub tied to customer';
  assert not website_push_save_for_code('nopenope', ep || '-3', k, a, 'bn', 'test'), 'bad code refused';
  assert (website_rhythm_booking_data(v_code) ->> 'ok')::boolean, 'push code books';

  -- A push service says gone: stops. Five failures: stops.
  perform website_push_result(ep || '-2', false, true);
  assert not (select active from website_push_subs where endpoint = ep || '-2'), 'gone stops';
  for n in 1..4 loop perform website_push_result(ep, false, false); end loop;
  assert (select active from website_push_subs where endpoint = ep), 'four failures keep it';
  perform website_push_result(ep, false, false);
  assert not (select active from website_push_subs where endpoint = ep), 'fifth failure stops';
  update website_push_subs set active = true, failures = 0 where endpoint = ep;
  j := website_push_remove(uid, ep);
  assert (j ->> 'devices')::int = 0, 'turned off';

  -- Nobody but the server.
  execute 'set local role authenticated';
  begin perform website_push_public_key(); raise exception 'customers call push functions'; exception when insufficient_privilege then null; end;
  begin perform 1 from website_push_subs; raise exception 'subs readable'; exception when insufficient_privilege then null; end;
  execute 'reset role';
  execute 'set local role service_role';
  begin perform 1 from website_push_keys; raise exception 'key table readable directly'; exception when insufficient_privilege then null; end;
  execute 'reset role';

  raise exception 'ALL_TESTS_PASSED (rolled back)';
end $$;
