-- Synthetic test for docs/technical/sql/website_second_service.sql. STAGING ONLY. Rolls back.
-- Expected: an error reading "ALL_TESTS_PASSED (rolled back)".
do $$
declare
  r text := lpad((floor(random() * 1000000))::int::text, 6, '0');
  ph text; ph2 text; cust uuid; cust2 uuid; o1 uuid; o2 uuid; o3 uuid; j jsonb; c1 text; c2 text; c3 text; n int; t1 uuid;
begin
  ph := '019' || r || '33';
  ph2 := '015' || r || '44';
  -- A: first order dry cleaning only, delivered.
  insert into customers (name, phone, address, zone, status) values ('Md. Zz Second', ph, 'House 1, Road 2', 'Uttara', 'Active') returning id into cust;
  insert into orders (customer_id, order_number, order_date, order_status, service_category, total_amount, amount_paid, dry_clean_items)
  values (cust, 'ZZS-' || r, current_date - 2, 'Delivered', array['Dry Cleaning'], 680, 680, 2) returning id into o1;
  -- B: an ironing regular (3 orders, never dry cleaning).
  insert into customers (name, phone, zone, status) values ('Zz Iron', ph2, 'Uttara', 'Active') returning id into cust2;
  insert into orders (customer_id, order_number, order_date, order_status, service_category, total_amount, amount_paid, ironing_items, created_at)
  values (cust2, 'ZZA-' || r, current_date - 30, 'Delivered', array['Ironing'], 150, 150, 10, now() - interval '30 days'),
         (cust2, 'ZZB-' || r, current_date - 15, 'Delivered', array['Ironing'], 150, 150, 10, now() - interval '15 days');
  insert into orders (customer_id, order_number, order_date, order_status, service_category, total_amount, amount_paid, ironing_items)
  values (cust2, 'ZZC-' || r, current_date - 1, 'Delivered', array['Ironing'], 150, 150, 10) returning id into o2;
  insert into orders (customer_id, order_number, order_date, order_status, service_category, total_amount, amount_paid, ironing_items)
  values (cust2, 'ZZD-' || r, current_date, 'Picked', array['Ironing'], 150, 0, 10) returning id into o3;
  c1 := website_invoice_code(o1); c2 := website_invoice_code(o2); c3 := website_invoice_code(o3);

  -- Flags on the invoice.
  j := website_invoice_get(c1);
  assert (j ->> 'isFirst')::boolean and (j -> 'servicesEver' ->> 'dryCleaning')::boolean and not (j -> 'servicesEver' ->> 'ironing')::boolean, format('A flags %s', j);
  assert j -> 'rating' = 'null'::jsonb and jsonb_array_length(j -> 'asked') = 0, 'nothing yet';
  j := website_invoice_get(c2);
  assert not (j ->> 'isFirst')::boolean and (j -> 'servicesEver' ->> 'orders')::int = 4 and not (j -> 'servicesEver' ->> 'dryCleaning')::boolean, format('B flags %s', j);
  assert position(ph in website_invoice_get(c1)::text) = 0 and position('Road 2' in website_invoice_get(c1)::text) = 0, 'no private data';

  -- Rating by link: happy, no task; unhappy, exactly one board task; change, a comment, still one task.
  j := website_invoice_rate(c2, 5, '{}', null);
  assert (j ->> 'ok')::boolean and (select task_id is null and auth_user_id is null and via_link = c2 from customer_order_feedback where customer_id = cust2 and order_number = (select order_number from orders where id = o2)), 'happy saved';
  j := website_invoice_rate(c1, 2, array['stain', 'bogus'], 'Spot on the blazer');
  assert (j ->> 'ok')::boolean, format('rate %s', j);
  select count(*) into n from website_board_tasks where id = (select task_id from customer_order_feedback where customer_id = cust);
  assert n = 1, 'one board task';
  assert (select issues = array['stain'] from customer_order_feedback where customer_id = cust), 'unknown issue dropped';
  perform website_invoice_rate(c1, 3, array['stain'], null);
  assert (select count(*) from customer_order_feedback where customer_id = cust) = 1, 'one feedback row';
  assert (select count(*) from website_board_comments where task_id = (select task_id from customer_order_feedback where customer_id = cust)) = 1, 'change noted';
  assert (website_invoice_get(c1) ->> 'rating')::int = 3, 'rating shown';
  assert website_invoice_rate(c1, 9, '{}', null) ->> 'error' = 'invalid', 'bad rating';
  assert website_invoice_rate(c3, 5, '{}', null) ->> 'error' = 'closed', 'not delivered: closed';

  -- A: pick your day → one Ops call task; asking again keeps one task and notes the change.
  j := website_link_request(c1, 'routine', 'ironing', 6, 'evening');
  assert (j ->> 'ok')::boolean and not (j ->> 'again')::boolean, format('routine %s', j);
  select task_id into t1 from website_link_requests where order_id = o1 and kind = 'routine';
  assert (select type = 'call' and status = 'open' and description like '%every Saturday evening%' and description like '%' || ph || '%' from tasks where id = t1), 'task for staff (with phone)';
  j := website_link_request(c1, 'routine', 'ironing', 5, 'morning');
  assert (j ->> 'again')::boolean and (select count(*) from tasks where dedupe_key = 'second-routine-ironing-' || o1) = 1, 'deduped';
  assert (select description like '%Changed on the website: Friday morning%' from tasks where id = t1), 'change noted on task';
  assert (website_invoice_get(c1) -> 'asked' -> 0 ->> 'weekday')::int = 5, 'asked shown';
  -- B: add dry cleaning to the next pickup.
  j := website_link_request(c2, 'addon', 'dry-cleaning', null, null);
  assert (j ->> 'ok')::boolean and (select count(*) from tasks where dedupe_key = 'second-addon-dry-cleaning-' || o2) = 1, 'addon task';
  assert website_link_request(c2, 'routine', 'ironing', 9, 'evening') ->> 'error' = 'invalid', 'bad day';
  assert website_link_request(c2, 'addon', 'carpet', null, null) ->> 'error' = 'invalid', 'bad service';
  assert website_link_request(c3, 'addon', 'dry-cleaning', null, null) ->> 'error' = 'closed', 'open order: closed';
  assert website_link_request('AAAAAAAA', 'addon', 'dry-cleaning', null, null) ->> 'error' = 'closed', 'unknown code';

  -- Today: the service mix by phone, in any format.
  j := website_service_mix(array['+88 ' || ph2, ph, '0123']);
  assert jsonb_array_length(j) = 2, format('mix %s', j);
  assert exists (select 1 from jsonb_array_elements(j) e where e ->> 'phone' = ph2 and (e ->> 'ironing')::boolean and not (e ->> 'dryCleaning')::boolean and (e ->> 'orders')::int = 4), 'B mix';

  -- Stats run.
  j := website_second_service_stats(60);
  assert (j ->> 'routineAsks')::int >= 1 and (j ->> 'addonAsks')::int >= 1 and (j ->> 'linkRatings')::int >= 2, format('stats %s', j);

  -- Grants.
  assert not has_function_privilege('anon', 'website_invoice_rate(text,integer,text[],text)', 'execute'), 'anon rate';
  assert not has_function_privilege('authenticated', 'website_link_request(text,text,text,integer,text)', 'execute'), 'auth request';
  assert not has_function_privilege('service_role', 'website_link_order(text)', 'execute'), 'internal';
  assert not has_function_privilege('service_role', 'website_customer_mix(uuid)', 'execute'), 'internal mix';
  assert has_function_privilege('service_role', 'website_service_mix(text[])', 'execute'), 'svc mix';
  assert not has_table_privilege('service_role', 'website_link_requests', 'select'), 'table closed';

  raise exception 'ALL_TESTS_PASSED (rolled back)';
end $$;
