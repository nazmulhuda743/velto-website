-- Synthetic test for docs/technical/sql/website_invoices.sql. STAGING ONLY. Rolls back.
-- Expected: an error reading "ALL_TESTS_PASSED (rolled back)".
do $$
declare
  r text := lpad((floor(random() * 1000000))::int::text, 6, '0');
  ph text; cust uuid; ord uuid; old uuid; j jsonb; v_code text; v_old text; num text; old_num text;
begin
  ph := '018' || r || '55';
  insert into customers (name, phone, whatsapp, address, zone, status) values ('Md. Zz Invoice Person', ph, '+88' || ph, 'House 9, Road 3', 'Uttara', 'Active') returning id into cust;
  insert into orders (customer_id, order_number, order_date, order_status, service_category, total_amount, amount_paid, express, express_fee, ironing_items)
  values (cust, 'ZZI-' || r, current_date, 'Ready', array['Ironing'], 330, 100, true, 50, 4) returning id into ord;
  insert into order_items (order_id, service_category, item_name, quantity, reference_price, quoted_price)
  values (ord, 'Ironing', 'Shirt', 4, 15, null), (ord, 'Dry Cleaning', 'Blazer', 1, 250, 240);
  insert into payments (order_id, amount, method, paid_at) values (ord, 100, 'Bkash', current_date);
  insert into orders (customer_id, order_number, order_date, order_status, service_category, total_amount, amount_paid, ironing_items)
  values (cust, 'ZZO-' || r, current_date - 200, 'Delivered', array['Ironing'], 60, 60, 4) returning id into old;
  update orders set created_at = now() - interval '200 days' where id = old;
  -- Ops renumbers orders on insert (velto_dense_number): read the numbers back.
  select order_number into num from orders where id = ord;
  select order_number into old_num from orders where id = old;

  -- The list makes one code per order, finds by phone (any format) and by order number.
  j := website_invoice_list(3, '+88 ' || ph, 50);
  assert jsonb_array_length(j) = 2, format('by phone: %s', j);
  j := website_invoice_list(3, num, 50);
  assert jsonb_array_length(j) = 1 and j -> 0 ->> 'name' = 'Md. Zz Invoice Person' and j -> 0 ->> 'whatsapp' = '+88' || ph, format('by number: %s', j);
  v_code := j -> 0 ->> 'code';
  assert v_code ~ '^[A-Za-z0-9_-]{8}$', 'code shape';
  assert (website_invoice_list(3, num, 50) -> 0 ->> 'code') = v_code, 'same code every time';
  assert (select count(*) from website_invoice_links where order_id = ord) = 1, 'one link per order';
  assert exists (select 1 from jsonb_array_elements(website_invoice_list(3, null, 300)) e where e ->> 'code' = v_code), 'recent list';
  assert not exists (select 1 from jsonb_array_elements(website_invoice_list(3, null, 300)) e where e ->> 'orderNumber' = old_num), 'old order not in recent list';

  -- Sent.
  assert website_invoice_sent(v_code, 'Test staff'), 'sent';
  assert not website_invoice_sent('nope', 'x'), 'bad code';
  assert (select sent_count = 1 and sent_by = 'Test staff' from website_invoice_links where code = v_code), 'sent recorded';

  -- The invoice: first name only, no phone or address anywhere.
  j := website_invoice_get(v_code);
  assert (j ->> 'ok')::boolean and j ->> 'firstName' = 'Zz' and j ->> 'orderNumber' = num, format('invoice %s', j);
  assert (j ->> 'total')::numeric = 330 and (j ->> 'paid')::numeric = 100 and (j ->> 'due')::numeric = 230 and (j ->> 'expressFee')::int = 50, 'money';
  assert jsonb_array_length(j -> 'lines') = 2 and (j -> 'lines' -> 0 ->> 'price')::numeric = 15 and (j -> 'lines' -> 1 ->> 'price')::numeric = 240, 'quoted price wins, reference otherwise';
  assert jsonb_array_length(j -> 'payments') = 1 and j -> 'payments' -> 0 ->> 'method' = 'Bkash', 'payments';
  assert position(ph in j::text) = 0 and position(r || '55' in j::text) = 0 and position('Road 3' in j::text) = 0 and position('Invoice Person' in j::text) = 0, format('no private data: %s', j);
  assert (select open_count = 1 and opened_at is not null from website_invoice_links where code = v_code), 'open recorded';

  -- Old orders: the link says so, without the invoice.
  v_old := website_invoice_code(old);
  j := website_invoice_get(v_old);
  assert not (j ->> 'ok')::boolean and j ->> 'reason' = 'expired' and j -> 'lines' is null, format('expired %s', j);
  assert website_invoice_get('AAAAAAAA') ->> 'reason' = 'unknown' and website_invoice_get(null) ->> 'reason' = 'unknown', 'unknown';

  -- No API role but service_role can call anything or read the links.
  assert not has_function_privilege('anon', 'website_invoice_get(text)', 'execute'), 'anon get';
  assert not has_function_privilege('authenticated', 'website_invoice_list(integer,text,integer)', 'execute'), 'auth list';
  assert not has_function_privilege('service_role', 'website_invoice_code(uuid)', 'execute'), 'code internal';
  assert has_function_privilege('service_role', 'website_invoice_get(text)', 'execute'), 'svc get';
  assert not has_table_privilege('anon', 'website_invoice_links', 'select') and not has_table_privilege('service_role', 'website_invoice_links', 'select'), 'table closed';

  raise exception 'ALL_TESTS_PASSED (rolled back)';
end $$;
