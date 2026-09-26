-- Synthetic test for docs/technical/sql/website_retention.sql.
-- STAGING ONLY. Creates three fake customers, checks every rule, then raises
-- so the whole block rolls back. Expected result: an error reading
-- "ALL_TESTS_PASSED (rolled back)". Ops assigns its own order numbers, so the
-- test never relies on them.
do $$
declare
  today date := (now() at time zone 'Asia/Dhaka')::date;
  a uuid; b uuid; c uuid;
  q jsonb;
  r text := lpad((floor(random()*1000000))::int::text, 6, '0');
begin
  insert into customers(name, phone, status) values ('ZZ Retention Test A', '017' || r || '91', 'Active') returning id into a;
  insert into customers(name, phone, status) values ('ZZ Retention Test B', '017' || r || '92', 'Active') returning id into b;
  insert into customers(name, phone, status) values ('ZZ Retention Test C', '017' || r || '93', 'Active') returning id into c;
  -- A: one order 10 days ago → second. B: every 10 days, last 12 days ago → due. C: 90 days ago → winback.
  insert into orders(customer_id, order_number, order_date, order_status, service_category) values (a, 'ZZT-1', today - 10, 'Delivered', array['Dry Cleaning']);
  insert into orders(customer_id, order_number, order_date, order_status, service_category) values (b, 'ZZT-2', today - 32, 'Delivered', array['Ironing']);
  insert into orders(customer_id, order_number, order_date, order_status, service_category) values (b, 'ZZT-3', today - 22, 'Delivered', array['Ironing']);
  insert into orders(customer_id, order_number, order_date, order_status, service_category) values (b, 'ZZT-4', today - 12, 'Delivered', array['Ironing']);
  insert into orders(customer_id, order_number, order_date, order_status, service_category) values (c, 'ZZT-5', today - 90, 'Delivered', array['Wash + Iron']);

  q := website_retention_queue('second', 200);
  assert exists (select 1 from jsonb_array_elements(q) e where e->>'customerId' = a::text and (e->>'daysSince')::int = 10 and e->'lastServices' ? 'Dry Cleaning'), 'A should be in second';
  q := website_retention_queue('due', 200);
  assert exists (select 1 from jsonb_array_elements(q) e where e->>'customerId' = b::text and (e->>'everyDays')::int = 10 and (e->>'dueOn')::date = today - 2), 'B should be due every 10';
  assert not exists (select 1 from jsonb_array_elements(q) e where e->>'customerId' = a::text), 'A not in due';
  q := website_retention_queue('winback', 200);
  assert exists (select 1 from jsonb_array_elements(q) e where e->>'customerId' = c::text), 'C should be winback';

  -- Messaged: hidden for 7 days, then back with the last contact shown.
  perform website_retention_log(a, 'second', 'messaged', 'Test staff');
  q := website_retention_queue('second', 200);
  assert not exists (select 1 from jsonb_array_elements(q) e where e->>'customerId' = a::text), 'A hidden after message';
  update website_retention_contacts set created_at = now() - interval '8 days' where customer_id = a;
  q := website_retention_queue('second', 200);
  assert exists (select 1 from jsonb_array_elements(q) e where e->>'customerId' = a::text and e->'lastContact'->>'outcome' = 'messaged'), 'A back after 7 days';

  -- Opt-out: never again.
  perform website_retention_log(c, 'winback', 'opt_out', 'Test staff');
  update website_retention_contacts set created_at = now() - interval '60 days' where customer_id = c;
  q := website_retention_queue('winback', 200);
  assert not exists (select 1 from jsonb_array_elements(q) e where e->>'customerId' = c::text), 'C opted out';

  -- Messaged then ordered: leaves the list, counted as came back.
  perform website_retention_log(b, 'due', 'messaged', 'Test staff');
  update website_retention_contacts set created_at = now() - interval '2 days' where customer_id = b;
  insert into orders(customer_id, order_number, order_date, order_status, service_category) values (b, 'ZZT-6', today, 'Picked', array['Ironing']);
  q := website_retention_queue('due', 200);
  assert not exists (select 1 from jsonb_array_elements(q) e where e->>'customerId' = b::text), 'B in progress';
  assert (website_retention_summary()->>'cameBack30d')::int >= 1, 'came back counted';

  begin
    perform website_retention_log(a, 'second', 'spam', 'Test staff');
    raise exception 'bad outcome accepted';
  exception when check_violation then null;
  end;
  begin
    perform website_retention_log(gen_random_uuid(), 'second', 'messaged', 'x');
    raise exception 'unknown customer accepted';
  exception when sqlstate 'P0002' then null;
  end;
  begin
    perform website_retention_log(a, 'second', 'messaged', '   ');
    raise exception 'blank staff accepted';
  exception when check_violation then null;
  end;

  assert not has_function_privilege('anon', 'public.website_retention_queue(text, integer)', 'execute'), 'anon exec';
  assert not has_function_privilege('authenticated', 'public.website_retention_log(uuid, text, text, text)', 'execute'), 'auth exec';
  assert has_function_privilege('service_role', 'public.website_retention_summary()', 'execute'), 'service exec';
  assert not has_table_privilege('anon', 'public.website_retention_contacts', 'select'), 'anon select';
  assert not has_table_privilege('authenticated', 'public.website_retention_contacts', 'insert'), 'auth insert';

  raise exception 'ALL_TESTS_PASSED (rolled back)';
end;
$$;
