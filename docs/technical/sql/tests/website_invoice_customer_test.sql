-- Synthetic test for docs/technical/sql/website_invoice_customer.sql. STAGING ONLY. Rolls back.
-- Run after the file (or in the same rolled-back batch). Expected: an error reading "ALL_TESTS_PASSED (rolled back)".
do $$
declare
  r text := lpad((floor(random() * 1000000))::int::text, 6, '0');
  ph text; cust uuid; ord uuid; ord2 uuid; j jsonb; k jsonb;
begin
  ph := '017' || r || '42';
  insert into customers (name, phone, whatsapp, address, zone, status) values ('  Md.  Zz   Customer Person ', ph, '+88' || ph, 'House 9, Road 3, Sector 11', 'Uttara', 'Active') returning id into cust;
  insert into orders (customer_id, order_number, order_date, order_status, service_category, total_amount, amount_paid, ironing_items,
                      name_snapshot, phone_snapshot, zone_snapshot, address_snapshot)
  values (cust, 'ZZK-' || r, current_date, 'Ready', array['Ironing'], 60, 0, 4, 'Order Name', ph, 'Uttara', 'House 9, Road 3, sector-11, Uttara')
  returning id into ord;
  -- No customer row, a number that is not a mobile (010…), no zone, no sector in the address.
  insert into orders (customer_id, order_number, order_date, order_status, service_category, total_amount, amount_paid, ironing_items,
                      name_snapshot, phone_snapshot, zone_snapshot, address_snapshot)
  values (null, 'ZZL-' || r, current_date, 'Ready', array['Ironing'], 60, 0, 4, 'Walk In', '01012345678', null, 'Road 3')
  returning id into ord2;

  j := website_invoice_get(website_invoice_code(ord));
  k := j -> 'customer';
  assert k ->> 'name' = 'Md. Zz Customer Person', format('full name, spaces tidied: %s', k);
  assert k ->> 'phone' = '017•••••' || right(ph, 3), format('masked phone: %s', k);
  assert k ->> 'area' = 'Uttara Sector 11', format('area: %s', k);
  -- The full phone, the house and the road never leave the database.
  assert position(ph in j::text) = 0 and position(substr(ph, 4, 5) in (k ->> 'phone')) = 0, 'no full phone';
  assert position('House 9' in j::text) = 0 and position('Road 3' in j::text) = 0, 'no address';
  -- Everything else is still there.
  assert j ? 'condition' and j ? 'lines' and j ? 'firstName', 'old keys kept';

  k := website_invoice_get(website_invoice_code(ord2)) -> 'customer';
  assert k ->> 'name' = 'Walk In' and k -> 'phone' = 'null'::jsonb and k -> 'area' = 'null'::jsonb, format('fallbacks: %s', k);

  assert not has_function_privilege('anon', 'public.website_invoice_get(text)', 'EXECUTE'), 'anon';
  assert not has_function_privilege('authenticated', 'public.website_invoice_get(text)', 'EXECUTE'), 'authenticated';
  raise exception 'ALL_TESTS_PASSED (rolled back)';
end $$;
