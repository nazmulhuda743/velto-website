-- Synthetic test for docs/technical/sql/website_dispatch_portal.sql. STAGING ONLY. Rolls back.
-- Expected: an error reading "ALL_PLAN_TESTS_PASSED (rolled back)".
do $$
declare
  today date := (now() at time zone 'Asia/Dhaka')::date;
  u uuid := gen_random_uuid(); cust uuid; r text := lpad((floor(random()*1000000))::int::text, 6, '0'); v_phone text; j jsonb; onum text;
begin
  v_phone := '017' || r || '55';
  insert into customers (name, phone, status) values ('ZZ Plan Test', v_phone, 'Active') returning id into cust;
  insert into orders (customer_id, order_number, order_date, order_status, service_category, total_amount) values (cust, 'ZZP-1', today - 2, 'Ready', array['Ironing'], 300);
  select o.order_number into onum from orders o where o.customer_id = cust;
  insert into auth.users (id, email, aud, role, instance_id) values (u, 'zz-plan-' || left(u::text, 8) || '@example.invalid', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
  insert into customer_accounts (auth_user_id, customer_id, full_name, phone, verified_phone, link_status, terms_version, terms_accepted_at) values (u, cust, 'ZZ Plan Test', v_phone, v_phone, 'linked', 1, now());
  -- A planned delivery for their order, a planned pickup for their phone, and someone else's delivery.
  insert into website_dispatch_jobs (kind, order_number, source, phone_key, stage, slot_date, slot, assignee_name) values ('delivery', onum, 'ops_order', v_phone, 'scheduled', today + 1, 'evening', 'Rakib');
  insert into website_dispatch_jobs (kind, source, phone_key, stage, slot_date, slot, assignee_name) values ('pickup', 'website_booking', v_phone, 'scheduled', today, 'morning', 'Bappy');
  insert into website_dispatch_jobs (kind, order_number, source, phone_key, stage, slot_date, slot) values ('delivery', 'VELR-00002', 'ops_order', '01999999999', 'scheduled', today, 'evening');
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  j := portal_dispatch_plans();
  assert jsonb_array_length(j) = 2, 'two plans, not others: ' || j::text;
  assert j->0->>'kind' = 'pickup' and j->0->>'slot' = 'morning' and j->0->>'assigneeName' = 'Bappy', 'pickup first (today): ' || j::text;
  assert j->1->>'kind' = 'delivery' and j->1->>'orderNumber' = onum and j->1->>'slot' = 'evening', 'delivery for own order: ' || j::text;
  reset role;
  raise exception 'ALL_PLAN_TESTS_PASSED (rolled back)';
end; $$;
