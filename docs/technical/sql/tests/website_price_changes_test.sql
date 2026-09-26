-- Synthetic test for docs/technical/sql/website_price_changes.sql.
-- STAGING ONLY. Proposes, approves, rejects, conflicts, removes and restores
-- prices, then raises so everything rolls back. Expected: an error reading
-- "ALL_TESTS_PASSED (rolled back)".
do $$
declare
  a uuid; e uuid; r uuid; s uuid; x jsonb; pid bigint; newid bigint; old_price numeric; n_before int;
begin
  select count(*) into n_before from price_list;
  select id, price into pid, old_price from price_list where price_type = 'fixed' and active and is_active order by id limit 1;

  begin perform website_price_change_request('add', null, '{"item_name":"X","category":"Misc","service_category":"Ironing","price":10}', null, null, 'M', 'manager'); raise exception 'short name accepted'; exception when sqlstate '22023' then null; end;
  begin perform website_price_change_request('add', null, '{"item_name":"ZZ Test Item","category":"Misc","service_category":"Laundry","price":10}', null, null, 'M', 'manager'); raise exception 'bad service accepted'; exception when sqlstate '22023' then null; end;
  begin perform website_price_change_request('add', null, '{"item_name":"ZZ Test Item","category":"Misc","service_category":"Ironing","price":-5}', null, null, 'M', 'manager'); raise exception 'negative price accepted'; exception when sqlstate '22023' then null; end;

  -- Add: nothing changes until approved; then Ops and the website view both show it.
  a := website_price_change_request('add', null, '{"item_name":"ZZ Test Item","category":"Misc","service_category":"Ironing","price":"45.5","item_group":"Men"}', 'new item', null, 'Test Manager', 'manager');
  assert (select count(*) from price_list) = n_before, 'add applied before approval';
  x := website_price_change_decide(a, 'approve', 'Test Owner', null);
  newid := (x->>'priceId')::bigint;
  assert (select price from price_list where id = newid) = 45.5 and (select unit from price_list where id = newid) = 'item', 'add applied';
  assert exists (select 1 from website_pricing_public where item_name = 'ZZ Test Item' and price_amount_minor = 4550), 'visible on website view';
  begin perform website_price_change_decide(a, 'approve', 'Test Owner', null); raise exception 'double approve'; exception when sqlstate '55000' then null; end;
  begin perform website_price_change_request('add', null, '{"item_name":"zz test item","category":"Misc","service_category":"Ironing","price":10}', null, null, 'M', 'manager'); raise exception 'duplicate add'; exception when sqlstate '23505' then null; end;

  -- Edit: one open request per row; approval applies it.
  e := website_price_change_request('edit', pid, (select website_price_row(p) from price_list p where id = pid) || jsonb_build_object('price', old_price + 10), 'raise', null, 'Test Manager', 'manager');
  begin perform website_price_change_request('remove', pid, '{}', null, null, 'M', 'manager'); raise exception 'second open request'; exception when sqlstate '23505' then null; end;
  assert (select price from price_list where id = pid) = old_price, 'edit applied early';
  perform website_price_change_decide(e, 'approve', 'Test Owner', 'ok');
  assert (select price from price_list where id = pid) = old_price + 10, 'edit applied';

  -- Reject leaves Ops untouched.
  r := website_price_change_request('edit', pid, (select website_price_row(p) from price_list p where id = pid) || jsonb_build_object('price', 1), null, null, 'M', 'manager');
  perform website_price_change_decide(r, 'reject', 'Test Owner', 'too low');
  assert (select price from price_list where id = pid) = old_price + 10, 'reject changed price';
  assert (select status from website_price_changes where id = r) = 'rejected', 'status rejected';

  -- Conflict: the row changes in Ops after the request → approval refused.
  s := website_price_change_request('edit', pid, (select website_price_row(p) from price_list p where id = pid) || jsonb_build_object('price', 999), null, null, 'M', 'manager');
  update price_list set note = coalesce(note, '') || ' (ops edit)' where id = pid;
  begin perform website_price_change_decide(s, 'approve', 'Test Owner', null); raise exception 'stale approve'; exception when sqlstate '40001' then null; end;
  perform website_price_change_decide(s, 'cancel', 'M', null);

  -- Remove is soft and hides it from the website; restore brings it back.
  s := website_price_change_request('remove', newid, '{}', 'gone', null, 'M', 'manager');
  perform website_price_change_decide(s, 'approve', 'Test Owner', null);
  assert exists (select 1 from price_list where id = newid and not active and not is_active), 'soft removed';
  assert not exists (select 1 from website_pricing_public where item_name = 'ZZ Test Item'), 'hidden on website';
  begin perform website_price_change_request('remove', newid, '{}', null, null, 'M', 'manager'); raise exception 'remove twice'; exception when sqlstate '22023' then null; end;
  s := website_price_change_request('restore', newid, '{}', null, null, 'M', 'manager');
  perform website_price_change_decide(s, 'approve', 'Test Owner', null);
  assert exists (select 1 from price_list where id = newid and active and is_active), 'restored';

  assert jsonb_array_length(website_price_change_list('all', 50)) >= 5, 'list';
  assert (select count(*) from jsonb_array_elements(website_price_admin_list())) = n_before + 1, 'admin list';

  assert not has_table_privilege('service_role', 'public.website_price_changes', 'insert'), 'direct insert';
  assert not has_table_privilege('service_role', 'public.website_price_changes', 'update'), 'direct update';
  assert not has_table_privilege('authenticated', 'public.website_price_changes', 'select'), 'auth select';
  assert not has_function_privilege('authenticated', 'public.website_price_change_decide(uuid, text, text, text)', 'execute'), 'auth decide';
  assert not has_function_privilege('anon', 'public.website_price_change_request(text, bigint, jsonb, text, uuid, text, text)', 'execute'), 'anon request';
  assert has_function_privilege('service_role', 'public.website_price_change_decide(uuid, text, text, text)', 'execute'), 'service decide';

  raise exception 'ALL_TESTS_PASSED (rolled back)';
end;
$$;
