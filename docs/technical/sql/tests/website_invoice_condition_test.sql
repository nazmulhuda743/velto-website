-- Synthetic test for docs/technical/sql/website_invoice_condition.sql. STAGING ONLY. Rolls back.
-- Run after the file (or in the same rolled-back batch). Expected: an error reading "ALL_TESTS_PASSED (rolled back)".
do $$
declare
  r text := lpad((floor(random() * 1000000))::int::text, 6, '0');
  ph text; cust uuid; ord uuid; clean uuid; j jsonb; v_code text; v_clean text; c jsonb;
begin
  ph := '018' || r || '66';
  insert into customers (name, phone, whatsapp, address, zone, status) values ('Zz Condition Person', ph, '+88' || ph, 'House 9', 'Uttara', 'Active') returning id into cust;
  insert into orders (customer_id, order_number, order_date, order_status, service_category, total_amount, amount_paid, ironing_items)
  values (cust, 'ZZC-' || r, current_date, 'Ready', array['Dry Cleaning'], 500, 0, 0) returning id into ord;
  insert into orders (customer_id, order_number, order_date, order_status, service_category, total_amount, amount_paid, ironing_items)
  values (cust, 'ZZD-' || r, current_date, 'Ready', array['Ironing'], 60, 0, 4) returning id into clean;
  -- Recorded in this order: a stain with 3 photos (one hostile path), one with none, one with an outside path.
  insert into order_stains (order_id, item_name, stain_type, photo_paths, created_at) values
    (ord, 'White shirt', 'Oil', array['stains/zz/a.jpg', '../secret.jpg', 'stains/zz/b.jpg'], now() - interval '3 minutes'),
    (ord, 'Blazer', 'Ink', '{}', now() - interval '2 minutes'),
    (ord, 'Sari', 'Unknown', array['receipts/x.jpg'], now() - interval '1 minute');

  v_code := website_invoice_code(ord);
  v_clean := website_invoice_code(clean);
  j := website_invoice_get(v_code);
  assert (j ->> 'ok')::boolean, format('ok: %s', j);
  c := j -> 'condition';
  assert jsonb_array_length(c) = 3, format('3 marks: %s', c);
  assert c -> 0 ->> 'item' = 'White shirt' and c -> 0 ->> 'type' = 'Oil', format('first mark, in recorded order: %s', c -> 0);
  -- At most 2 photos are listed, hostile paths dropped; "more" counts what was not listed.
  assert c -> 0 -> 'photos' = '["stains/zz/a.jpg"]'::jsonb, format('safe photos only: %s', c -> 0 -> 'photos');
  assert (c -> 0 ->> 'more')::int = 1, format('more: %s', c -> 0);
  assert c -> 1 -> 'photos' = '[]'::jsonb and (c -> 1 ->> 'more')::int = 0, format('no photo: %s', c -> 1);
  assert c -> 2 -> 'photos' = '[]'::jsonb, format('outside stains/ dropped: %s', c -> 2);
  -- Everything the page had before is still there; still no phone or address.
  assert j ? 'lines' and j ? 'payments' and j ? 'firstName' and j ? 'asked', 'old keys kept';
  assert position(ph in j::text) = 0 and position('House 9' in j::text) = 0, 'no phone or address';
  -- An order with no stains: an empty list, not null.
  assert website_invoice_get(v_clean) -> 'condition' = '[]'::jsonb, 'empty condition';
  -- Still the server's alone.
  assert not has_function_privilege('anon', 'public.website_invoice_get(text)', 'EXECUTE'), 'anon';
  assert not has_function_privilege('authenticated', 'public.website_invoice_get(text)', 'EXECUTE'), 'authenticated';
  assert has_function_privilege('service_role', 'public.website_invoice_get(text)', 'EXECUTE'), 'service_role';
  raise exception 'ALL_TESTS_PASSED (rolled back)';
end $$;
