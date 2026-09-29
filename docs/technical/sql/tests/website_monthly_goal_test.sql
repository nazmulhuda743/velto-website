-- Synthetic test for docs/technical/sql/website_monthly_goal.sql. STAGING ONLY.
-- A fake linked customer with orders last month and this month; portal_goal as that customer,
-- settle / list / mark as service_role; then raises so everything rolls back.
-- Expected: an error reading "ALL_GOAL_TESTS_PASSED (rolled back)".
do $$
declare
  today date := (now() at time zone 'Asia/Dhaka')::date;
  this_month text := to_char(today, 'YYYY-MM');
  last_month text := to_char(today - interval '1 month', 'YYYY-MM');
  lm_start date := to_date(last_month || '-01', 'YYYY-MM-DD');
  u uuid := gen_random_uuid();
  cust uuid; cust2 uuid;
  r text := lpad((floor(random() * 1000000))::int::text, 6, '0');
  phone text;
  j jsonb; s jsonb;
  ladder jsonb := '[{"spend":800,"kind":"delivery","amount":0,"label":"Free pickup & delivery all month","labelBn":""},
                    {"spend":1500,"kind":"taka","amount":200,"label":"৳200 off","labelBn":""}]';
  cid uuid;
begin
  phone := '017' || r || '66';
  insert into customers (name, phone, status) values ('ZZ Goal Test', phone, 'Active') returning id into cust;
  insert into customers (name, phone, status) values ('ZZ Goal Small', '018' || r || '66', 'Active') returning id into cust2;
  -- Last month: 400 (first) + 300 + 900 = 1600 (double first → 2000). A cancelled 5000 must not count.
  insert into orders (customer_id, order_number, order_date, order_status, service_category, total_amount) values (cust, 'ZZG-1', lm_start + 2, 'Delivered', array['Ironing'], 400);
  insert into orders (customer_id, order_number, order_date, order_status, service_category, total_amount) values (cust, 'ZZG-2', lm_start + 10, 'Delivered', array['Ironing'], 300);
  insert into orders (customer_id, order_number, order_date, order_status, service_category, total_amount) values (cust, 'ZZG-3', lm_start + 20, 'Delivered', array['Ironing'], 900);
  insert into orders (customer_id, order_number, order_date, order_status, service_category, total_amount) values (cust, 'ZZG-4', lm_start + 21, 'Cancelled', array['Ironing'], 5000);
  -- This month: 250 so far.
  insert into orders (customer_id, order_number, order_date, order_status, service_category, total_amount) values (cust, 'ZZG-5', today, 'Picked', array['Ironing'], 250);
  -- A small customer: 500 last month, below every rung.
  insert into orders (customer_id, order_number, order_date, order_status, service_category, total_amount) values (cust2, 'ZZG-6', lm_start + 5, 'Delivered', array['Ironing'], 500);

  insert into auth.users (id, email, aud, role, instance_id) values (u, 'zz-goal-' || left(u::text, 8) || '@example.invalid', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
  insert into customer_accounts (auth_user_id, customer_id, full_name, phone, verified_phone, link_status, terms_version, terms_accepted_at)
  values (u, cust, 'ZZ Goal Test', phone, phone, 'linked', 1, now());

  -- ---------- settle last month as service_role ----------
  execute 'set local role service_role';
  s := website_goal_settle(this_month, ladder, false);
  assert (s->>'ok')::boolean = false and s->>'error' = 'month_not_over', 'the current month cannot be settled: ' || s::text;
  s := website_goal_settle(last_month, ladder, false);
  assert (s->>'ok')::boolean, 'settle ok: ' || s::text;
  assert (select count(*) from customer_goal_coupons where customer_id = cust and month = last_month) = 1, 'one coupon for the customer';
  assert (select count(*) from customer_goal_coupons where customer_id = cust2) = 0, 'no coupon below the first rung';
  assert (select kind from customer_goal_coupons where customer_id = cust) = 'taka', '1600 reaches the ৳200 rung (not the delivery one)';
  assert (select amount from customer_goal_coupons where customer_id = cust) = 200, 'amount 200';
  assert (select valid_from from customer_goal_coupons where customer_id = cust) = to_date(this_month || '-01', 'YYYY-MM-DD'), 'valid from the 1st of this month';
  assert (select code from customer_goal_coupons where customer_id = cust) ~ '^VG-[A-Z0-9]{6}$', 'code shape';
  -- Idempotent.
  s := website_goal_settle(last_month, ladder, false);
  assert (s->>'issued')::int = 0 and (s->>'reached')::int >= 1, 'second settle issues nothing: ' || s::text;
  -- Preview counts rungs.
  s := website_goal_preview(last_month, ladder, false);
  assert (s->'rungs'->0->>'customers')::int >= 1 and (s->'rungs'->1->>'customers')::int >= 1, 'preview counts: ' || s::text;
  -- Double first: 400 + 300 + 900 + 400 = 2000.
  s := website_goal_preview(last_month, ladder, true);
  assert (select spend from website_goal_spend(last_month, true, cust)) = 2000, 'double first order';

  -- ---------- as the customer ----------
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  j := portal_goal(false);
  assert (j->>'linked')::boolean, 'linked';
  assert j->>'month' = this_month, 'month';
  assert (j->>'spend')::numeric = 250, 'this month spend 250: ' || j::text;
  assert jsonb_array_length(j->'coupons') = 1, 'one usable coupon';
  assert j->'coupons'->0->>'status' = 'open' and (j->'coupons'->0->>'amount')::int = 200, 'coupon in the account';
  j := portal_goal(true);
  assert (j->>'spend')::numeric = 500 and (j->>'firstDoubled')::numeric = 250, 'head start doubles the first order: ' || j::text;
  -- No table access.
  begin
    perform count(*) from customer_goal_coupons;
    raise exception 'customer could read coupons';
  exception when insufficient_privilege then null;
  end;

  -- ---------- mark used as service_role ----------
  reset role;
  execute 'set local role service_role';
  select id into cid from customer_goal_coupons where customer_id = cust;
  assert website_goal_coupon_mark(cid, 'used', 'VEL-00001', 'QA staff'), 'mark used';
  assert (select status from customer_goal_coupons where id = cid) = 'used', 'status used';
  assert website_goal_coupon_mark(cid, 'bogus', null, 'QA') = false, 'bad status refused';
  j := website_goal_coupons(50);
  assert exists (select 1 from jsonb_array_elements(j) x where x->>'id' = cid::text and x->>'customerName' = 'ZZ Goal Test' and x->>'orderNumber' = 'VEL-00001'), 'admin list shows it used';
  reset role;

  raise exception 'ALL_GOAL_TESTS_PASSED (rolled back)';
end;
$$;
