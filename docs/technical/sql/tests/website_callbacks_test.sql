-- Synthetic test for docs/technical/sql/website_callbacks.sql. STAGING ONLY.
-- Expected: an error reading "ALL CALLBACK TESTS PASSED (rolled back)". Nothing is kept.
do $$
declare
  r text := lpad((floor(random() * 100000))::int::text, 5, '0');
  phone text := '019' || r || '333';
  j jsonb; id1 uuid; id2 uuid; l jsonb; x jsonb;
begin
  execute 'set local role service_role';
  j := public.website_callback_create('qa-callback-key-000000001', jsonb_build_object('name', 'QA Callback', 'phone', phone, 'area', 'Uttara Sector 7',
         'what', '5 shirts', 'services', 'Wash & Iron', 'preferred', 'Tomorrow, Afternoon', 'utm_source', 'facebook', 'utm_medium', 'paid_social', 'device', 'mobile'));
  assert (j->>'ok')::boolean and not (j->>'existing')::boolean, 'created: ' || j::text;
  id1 := (j->>'id')::uuid;
  j := public.website_callback_create('qa-callback-key-000000001', jsonb_build_object('name', 'QA Callback', 'phone', phone));
  assert (j->>'id')::uuid = id1 and (j->>'existing')::boolean, 'same key = same request';
  j := public.website_callback_create('qa-callback-key-000000002', jsonb_build_object('name', 'QA Callback', 'phone', phone));
  assert (j->>'id')::uuid = id1, 'an open request for the phone is reused';
  j := public.website_callback_create('qa-callback-key-000000003', jsonb_build_object('name', 'QA', 'phone', '12345'));
  assert j->>'error' = 'invalid', 'bad phone refused';
  j := public.website_callback_create('short', jsonb_build_object('name', 'QA Callback', 'phone', phone));
  assert j->>'error' = 'invalid', 'bad key refused';
  j := public.website_callback_create('qa-callback-key-000000004', jsonb_build_object('name', 'Q', 'phone', '018' || r || '444'));
  assert j->>'error' = 'invalid', 'one-letter name refused (check violation caught)';
  j := public.website_callback_create('qa-callback-key-000000005', jsonb_build_object('name', 'QA Callback', 'phone', phone, 'device', 'fridge'));
  assert (j->>'id')::uuid = id1, 'still the open one';

  l := public.website_callback_list();
  select e into x from jsonb_array_elements(l) e where (e->>'id')::uuid = id1;
  assert x->>'status' = 'open' and x->>'what' = '5 shirts' and x->>'utm_source' = 'facebook' and (x->>'orders')::int >= 0, 'listed: ' || coalesce(x::text, 'missing');

  j := public.website_callback_close(id1, 'maybe', null, 'QA');
  assert j->>'error' = 'invalid', 'unknown outcome refused';
  j := public.website_callback_close(id1, 'booked', 'Booked by phone for tomorrow', 'QA Manager');
  assert (j->>'ok')::boolean, 'closed';
  j := public.website_callback_close(id1, 'booked', null, 'QA');
  assert j->>'error' = 'closed', 'closing twice refused';
  assert (select outcome from public.website_callbacks where id = id1) = 'booked', 'outcome stored';

  -- After it's handled a new tap makes a new request, up to 3 a day per phone.
  j := public.website_callback_create('qa-callback-key-000000006', jsonb_build_object('name', 'QA Callback', 'phone', phone));
  id2 := (j->>'id')::uuid;
  assert id2 <> id1, 'new request after the first was handled';
  perform public.website_callback_close(id2, 'no_answer', null, 'QA');
  j := public.website_callback_create('qa-callback-key-000000007', jsonb_build_object('name', 'QA Callback', 'phone', phone));
  perform public.website_callback_close((j->>'id')::uuid, 'no_answer', null, 'QA');
  j := public.website_callback_create('qa-callback-key-000000008', jsonb_build_object('name', 'QA Callback', 'phone', phone));
  assert j->>'error' = 'rate_limited', 'fourth in a day refused: ' || j::text;

  execute 'reset role';
  assert not has_function_privilege('anon', 'public.website_callback_create(text, jsonb)', 'execute'), 'anon blocked';
  assert not has_function_privilege('authenticated', 'public.website_callback_list()', 'execute'), 'customers blocked';
  assert not has_table_privilege('authenticated', 'public.website_callbacks', 'select'), 'table private';

  raise exception 'ALL CALLBACK TESTS PASSED (rolled back)';
end $$;
