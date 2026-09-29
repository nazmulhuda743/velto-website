-- Synthetic test for docs/technical/sql/website_upsell.sql. STAGING ONLY.
-- Expected: an error reading "ALL UPSELL TESTS PASSED (rolled back)". Nothing is kept.
do $$
declare
  u uuid := gen_random_uuid();
  r text := lpad((floor(random() * 100000))::int::text, 5, '0');
  phone text := '016' || r || '555';
  cust uuid; o uuid; j jsonb; n int;
begin
  insert into public.customers (name, phone, status) values ('ZZ Upsell Test', phone, 'Active') returning id into cust;
  -- Four orders: ZZShirt+ZZPant (Ironing) three times, ZZShirt alone once; one cancelled order with ZZSari.
  for n in 1..4 loop
    insert into public.orders (customer_id, order_number, order_date, order_status, phone_snapshot, service_category)
    values (cust, 'ZZU-' || r || n, current_date - n, 'Delivered', phone, array['Ironing']) returning id into o;
    insert into public.order_items (order_id, service_category, item_name, quantity) values (o, 'Ironing', 'ZZShirt', 3);
    if n <= 3 then insert into public.order_items (order_id, service_category, item_name, quantity) values (o, 'Ironing', 'ZZPant', 2); end if;
  end loop;
  insert into public.orders (customer_id, order_number, order_date, order_status, phone_snapshot, service_category) values (cust, 'ZZU-' || r || '9', current_date, 'Cancelled', phone, array['Ironing']) returning id into o;
  insert into public.order_items (order_id, service_category, item_name, quantity) values (o, 'Ironing', 'ZZSari', 1), (o, 'Ironing', 'ZZShirt', 1);

  execute 'set local role service_role';
  -- Pairs: ZZPant → ZZShirt in 3 of 3 (100%); ZZShirt → ZZPant in 3 of 4 (75%). Cancelled and household ignored.
  select count(*) into n from public.website_item_affinity(180, 3, 0.15) a
   where a.item = 'ZZPant' and a.service = 'Ironing' and a.also_item = 'ZZShirt' and a.together = 3 and a.anchor_orders = 3 and a.share = 1.000;
  assert n = 1, 'ZZPant → ZZShirt pair';
  select count(*) into n from public.website_item_affinity(180, 3, 0.15) a where a.item = 'ZZShirt' and a.also_item = 'ZZPant' and a.share = 0.750;
  assert n = 1, 'ZZShirt → ZZPant pair';
  select count(*) into n from public.website_item_affinity(180, 3, 0.15) a where a.also_item = 'ZZSari' or a.item = 'ZZSari';
  assert n = 0, 'cancelled orders are left out';
  select count(*) into n from public.website_item_affinity(180, 4, 0.15) a where a.item like 'ZZ%';
  assert n = 0, 'below the minimum together count: nothing';

  j := public.website_usual_items(array[phone, 'not-a-phone']);
  assert jsonb_typeof(j -> phone) = 'array' and jsonb_array_length(j -> phone) = 2, 'usual items by phone: ' || j::text;
  assert (j -> phone -> 0 ->> 'item') = 'ZZShirt' and (j -> phone -> 0 ->> 'orders')::int = 4, 'most frequent first';
  assert not (j ? 'not-a-phone'), 'junk phones ignored';

  -- As the linked customer.
  execute 'reset role';
  insert into auth.users (id, email, aud, role, instance_id) values (u, 'zz-upsell-' || left(u::text, 8) || '@example.invalid', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
  insert into public.customer_accounts (auth_user_id, customer_id, full_name, phone, verified_phone, link_status, terms_version, terms_accepted_at)
  values (u, cust, 'ZZ Upsell Test', phone, phone, 'linked', 1, now());
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  j := public.portal_usual_items();
  assert jsonb_array_length(j) = 2 and (j -> 1 ->> 'item') = 'ZZPant', 'own usual items: ' || j::text;
  begin
    perform public.website_item_affinity();
    assert false, 'customers cannot read store-wide pairs directly';
  exception when insufficient_privilege then null;
  end;

  execute 'reset role';
  assert not has_function_privilege('anon', 'public.portal_usual_items()', 'execute'), 'anon blocked';
  assert not has_function_privilege('authenticated', 'public.website_usual_items(text[])', 'execute'), 'phone lookup is staff-only';
  assert not has_function_privilege('authenticated', 'public.website_usual_items_for(uuid, text)', 'execute'), 'helper private';

  raise exception 'ALL UPSELL TESTS PASSED (rolled back)';
end $$;
