-- Synthetic test for docs/technical/sql/website_balance.sql. STAGING ONLY.
-- Expected: an error reading "ALL BALANCE TESTS PASSED (rolled back)". Nothing is kept.
-- Plays a signed-in regular customer (auth.uid() via request.jwt.claims), a new customer and the
-- Command Center (service_role): request → top-up with bonus → pay an Ops order (Ops' own trigger
-- marks it Paid / Partial) → undo → refund paid money only → bonus expiry.
do $$
declare
  u uuid := gen_random_uuid();
  u2 uuid := gen_random_uuid();
  r text := lpad((floor(random() * 100000))::int::text, 5, '0');
  phone text := '017' || r || '333';
  phone2 text := '018' || r || '444';
  cust uuid;
  cust2 uuid;
  j jsonb;
  rid uuid;
  o_small text;
  o_big text;
  spend_line uuid;
  v_today date := (now() at time zone 'Asia/Dhaka')::date;
  n int;
begin
  insert into public.website_content (key, value) values ('balance', '{"enabled": true}')
  on conflict (key) do update set value = excluded.value;

  insert into public.customers (name, phone, status) values ('ZZ Balance Test', phone, 'Active') returning id into cust;
  insert into public.customers (name, phone, status) values ('ZZ Balance New', phone2, 'Active') returning id into cust2;
  insert into auth.users (id, email, aud, role, instance_id) values (u, 'zz-bal-' || left(u::text, 8) || '@example.invalid', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
  insert into auth.users (id, email, aud, role, instance_id) values (u2, 'zz-bal-' || left(u2::text, 8) || '@example.invalid', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
  insert into public.customer_accounts (auth_user_id, customer_id, full_name, phone, verified_phone, address, area, link_status, terms_version, terms_accepted_at)
  values (u, cust, 'ZZ Balance Test', phone, phone, 'House 9, Road 4', '7', 'linked', 1, now());
  insert into public.customer_accounts (auth_user_id, customer_id, full_name, phone, verified_phone, link_status, terms_version, terms_accepted_at)
  values (u2, cust2, 'ZZ Balance New', phone2, phone2, 'linked', 1, now());

  -- Three delivered orders make the first customer a regular.
  for n in 1..3 loop
    insert into public.orders (customer_id, order_date, order_status, service_category, total_amount, phone_snapshot, name_snapshot)
    values (cust, v_today - (10 * n), 'Delivered', array['Ironing'], 300 + n * 10, phone, 'ZZ Balance Test');
  end loop;
  insert into public.orders (customer_id, order_date, order_status, service_category, total_amount, phone_snapshot, name_snapshot)
  values (cust, v_today, 'Ready', array['Ironing'], 600, phone, 'ZZ Balance Test') returning order_number into o_small;
  insert into public.orders (customer_id, order_date, order_status, service_category, total_amount, phone_snapshot, name_snapshot)
  values (cust, v_today, 'Ready', array['Wash + Iron'], 1500, phone, 'ZZ Balance Test') returning order_number into o_big;

  -- ---------- customers ----------
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  j := public.portal_balance();
  assert (j ->> 'eligible')::boolean and (j ->> 'deliveredOrders')::int = 3, 'regular is eligible: ' || j::text;
  assert (j ->> 'available')::numeric = 0 and (j ->> 'usualOrder')::numeric = 320, 'empty balance, usual order is the median: ' || j::text;
  assert jsonb_array_length(j -> 'tiers') = 2, 'default tiers';
  j := public.portal_balance_request(1500, 'bkash');
  assert j ->> 'error' = 'invalid', 'only offer amounts';
  j := public.portal_balance_request(1000, 'bkash');
  assert (j ->> 'ok')::boolean, 'request: ' || j::text;
  rid := (j ->> 'id')::uuid;
  j := public.portal_balance_request(2000, 'nagad');
  assert (j ->> 'id')::uuid = rid, 'one open request, updated';
  j := public.portal_balance();
  assert (j -> 'request' ->> 'amount')::int = 2000 and j -> 'request' ->> 'method' = 'nagad', 'request shown';
  begin
    perform count(*) from public.website_balance_ledger;
    assert false, 'customers must not read the ledger table';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.website_balance_topup(rid, null, 2000, 'cash', null, 'me', null);
    assert false, 'customers must not top up';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  j := public.portal_balance();
  assert not (j ->> 'eligible')::boolean, 'new customer not eligible';
  j := public.portal_balance_request(1000, 'bkash');
  assert j ->> 'error' = 'not_eligible', 'new customer cannot request: ' || j::text;
  execute 'reset role';

  -- ---------- Command Center: top-up ----------
  execute 'set local role service_role';
  j := public.website_balance_topup(rid, null, 2000, 'nagad', null, 'ZZ Manager', 'zz-topup-' || r);
  assert j ->> 'error' = 'reference', 'mobile money needs the TrxID';
  j := public.website_balance_topup(rid, null, 2000, 'nagad', 'TRX123', 'ZZ Manager', 'zz-topup-' || r);
  assert (j ->> 'ok')::boolean and (j ->> 'bonus')::numeric = 150, 'top-up with bonus: ' || j::text;
  assert (j -> 'balance' ->> 'available')::numeric = 2150, '2000 + 150';
  j := public.website_balance_topup(rid, null, 2000, 'nagad', 'TRX123', 'ZZ Manager', 'zz-topup-' || r);
  assert (j ->> 'existing')::boolean, 'same click twice adds nothing';
  j := public.website_balance_topup(rid, null, 2000, 'nagad', 'TRX124', 'ZZ Manager', null);
  assert j ->> 'error' = 'closed', 'request already confirmed';
  assert (public.website_balance_of(cust) ->> 'available')::numeric = 2150, 'still 2150';
  j := public.website_balance_topup(null, cust, 1200, 'cash', null, 'ZZ Manager', null);
  assert (j ->> 'bonus')::numeric = 50 and (j -> 'balance' ->> 'available')::numeric = 3400, 'counter top-up: largest tier reached: ' || j::text;

  -- ---------- spend: Ops payment, Ops trigger marks the order ----------
  j := public.website_balance_spend(o_small, null, 'ZZ Manager', 'zz-spend-' || r);
  assert (j ->> 'ok')::boolean and (j ->> 'paid')::numeric = 600 and (j ->> 'fromBonus')::numeric = 200, 'bonus first: ' || j::text;
  assert j ->> 'orderStatus' = 'Paid' and (j ->> 'orderDue')::numeric = 0, 'Ops marks it Paid';
  assert exists (select 1 from public.payments p join public.orders o on o.id = p.order_id
                  where o.order_number = o_small and p.method = 'Velto Balance' and p.amount = 600), 'one Ops payment';
  j := public.website_balance_spend(o_small, null, 'ZZ Manager', 'zz-spend-' || r);
  assert (j ->> 'existing')::boolean, 'double click';
  j := public.website_balance_spend(o_small, null, 'ZZ Manager', null);
  assert j ->> 'error' = 'nothing_due', 'already paid';
  assert (public.website_balance_of(cust) ->> 'available')::numeric = 2800 and (public.website_balance_of(cust) ->> 'bonus')::numeric = 0, '3400 - 600, bonus gone first';

  -- Undo the spend: payment removed, order owes again, money back (cash and bonus as they were).
  select id into spend_line from public.website_balance_ledger where order_number = o_small and kind = 'spend';
  j := public.website_balance_reverse(spend_line, '', 'ZZ Manager');
  assert j ->> 'error' = 'reason', 'undo needs a reason';
  j := public.website_balance_reverse(spend_line, 'Wrong order', 'ZZ Manager');
  assert (j ->> 'ok')::boolean and (j -> 'balance' ->> 'available')::numeric = 3400 and (j -> 'balance' ->> 'bonus')::numeric = 200, 'undone: ' || j::text;
  assert (select payment_status from public.orders where order_number = o_small) = 'Unpaid', 'order owes again';
  j := public.website_balance_reverse(spend_line, 'Again', 'ZZ Manager');
  assert j ->> 'error' = 'already', 'once only';

  -- Bigger than the balance: pays what is there, Ops shows Partial.
  j := public.website_balance_spend(o_big, 400, 'ZZ Manager', null);
  assert (j ->> 'paid')::numeric = 400 and j ->> 'orderStatus' = 'Partial', 'part payment: ' || j::text;
  j := public.website_balance_spend(o_big, null, 'ZZ Manager', null);
  assert (j ->> 'paid')::numeric = 1100 and j ->> 'orderStatus' = 'Paid', 'rest of the order: ' || j::text;
  assert (public.website_balance_of(cust) ->> 'available')::numeric = 1900, '3400 - 1500';

  -- ---------- refund: paid money only ----------
  j := public.website_balance_refund(cust, 5000, 'bkash', 'TRX9', 'ZZ Manager');
  assert j ->> 'error' = 'too_much', 'not more than paid money';
  j := public.website_balance_refund(cust, 500, 'bkash', 'TRX9', 'ZZ Manager');
  assert (j ->> 'ok')::boolean and (j -> 'balance' ->> 'available')::numeric = 1400, 'refund';

  -- ---------- goodwill and expiry ----------
  j := public.website_balance_adjust(cust, 100, 'Late delivery', 'ZZ Admin');
  assert (j -> 'balance' ->> 'bonus')::numeric = 100, 'goodwill is bonus money';
  -- The second customer's goodwill is 13 months old: it no longer counts, and the next change writes it off.
  j := public.website_balance_adjust(cust2, 80, 'Old goodwill', 'ZZ Admin');
  update public.website_balance_ledger set created_at = now() - interval '13 months' where customer_id = cust2 and kind = 'adjust';
  assert (public.website_balance_of(cust2) ->> 'bonus')::numeric = 0 and (public.website_balance_of(cust2) ->> 'expired')::numeric = 80, 'old bonus expired';
  j := public.website_balance_adjust(cust2, 30, 'New goodwill', 'ZZ Admin');
  assert exists (select 1 from public.website_balance_ledger where customer_id = cust2 and kind = 'expire' and bonus = -80), 'expiry written off';
  assert (j -> 'balance' ->> 'bonus')::numeric = 30 and (j -> 'balance' ->> 'expired')::numeric = 0, 'only the new goodwill: ' || j::text;
  -- A spend given back is not new bonus: the clock of the bonus it came from still runs.
  assert (public.website_balance_of(cust) ->> 'bonus')::numeric = 100, 'regular keeps live goodwill';

  -- ---------- overview and phones ----------
  j := public.website_balance_overview();
  assert exists (select 1 from jsonb_array_elements(j -> 'customers') c where (c ->> 'customerId')::uuid = cust), 'listed: ' || (j -> 'totals')::text;
  assert (public.website_balance_for_phones(array[phone, phone2]) ->> phone)::numeric = 1500, 'by phone';
  assert public.website_balance_for_phones(array['01999999999']) = '{}'::jsonb, 'unknown phone, not listed';
  assert jsonb_array_length(public.website_balance_customer(null, phone) -> 'history') >= 10, 'history';
  execute 'reset role';

  -- ---------- grants ----------
  assert not has_function_privilege('anon', 'public.portal_balance()', 'execute'), 'anon cannot read';
  assert not has_function_privilege('authenticated', 'public.website_balance_spend(text, numeric, text, text)', 'execute'), 'customers cannot spend';
  assert not has_function_privilege('authenticated', 'public.website_balance_overview()', 'execute'), 'customers cannot list';
  assert not has_function_privilege('authenticated', 'public.website_balance_of(uuid)', 'execute'), 'helper private';
  assert not has_table_privilege('authenticated', 'public.website_balance_ledger', 'select'), 'ledger private';
  assert not has_table_privilege('anon', 'public.website_balance_requests', 'select'), 'requests private';

  raise exception 'ALL BALANCE TESTS PASSED (rolled back)';
end $$;
