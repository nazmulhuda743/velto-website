-- Synthetic test for docs/technical/sql/website_dispatch_deliveries.sql. STAGING ONLY. Rolls back.
-- Expected: an error reading "ALL DELIVERY TESTS PASSED (rolled back)".
do $$
declare
  cust uuid; j uuid; r jsonb; n int; v_order text;
  v_phone text := '0171' || lpad((floor(random() * 10000000))::int::text, 7, '0');
begin
  insert into public.customers (name, phone, status) values ('ZZ Delivery Test', v_phone, 'Active') returning id into cust;
  insert into public.orders (customer_id, order_number, order_date, order_status, service_category, total_amount, phone_snapshot, name_snapshot, delivery_date)
  values (cust, 'VEL-999991', (now() at time zone 'Asia/Dhaka')::date - 2, 'Ready', array['Ironing'], 300, v_phone, 'ZZ Delivery Test', (now() at time zone 'Asia/Dhaka')::date)
  returning order_number into v_order;  -- Ops may number the order itself
  assert v_order ~ '^VELR?-[0-9]{3,6}$', 'order number shape: ' || coalesce(v_order, 'null');

  execute 'set local role service_role';
  r := public.website_dispatch_sync();
  select id into j from public.website_dispatch_jobs where kind = 'delivery' and order_number = v_order and stage = 'new';
  assert j is not null, 'Ready order due today is on the board';

  -- Taken off the board: the next sync leaves it off.
  r := public.website_dispatch_close(j, 'cancelled', 'Customer will collect from the outlet', 'QA');
  assert (r->>'ok')::boolean, 'closed: ' || r::text;
  r := public.website_dispatch_sync();
  select count(*) into n from public.website_dispatch_jobs where kind = 'delivery' and order_number = v_order and stage not in ('cancelled', 'merged');
  assert n = 0, 'stays off after sync';

  -- The order changes in Ops afterwards: it comes back for another look.
  -- (One transaction has one now(): date the close a minute back, as it would be in real use.)
  reset role;
  update public.website_dispatch_jobs set updated_at = now() - interval '1 minute' where id = j;
  update public.orders set delivery_date = delivery_date + 1 where order_number = v_order;
  execute 'set local role service_role';
  r := public.website_dispatch_sync();
  select count(*) into n from public.website_dispatch_jobs where kind = 'delivery' and order_number = v_order and stage = 'new';
  assert n = 1, 'back after the order changed: ' || n;

  reset role;
  raise exception 'ALL DELIVERY TESTS PASSED (rolled back)';
end;
$$;
