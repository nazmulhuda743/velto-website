-- Synthetic test for docs/technical/sql/website_identity_claim.sql. STAGING ONLY.
-- Fake Velto customers and fake logins; every state checked as those logins; a raise rolls all
-- of it back. Expected: an error reading "ALL_TESTS_PASSED (rolled back)".
do $$
declare
  today date := (now() at time zone 'Asia/Dhaka')::date;
  r text := lpad((floor(random() * 1000000))::int::text, 6, '0');
  p_recent text := '017' || r || '11'; p_old text := '017' || r || '12'; p_old2 text := '017' || r || '13';
  p_new text := '017' || r || '14'; p_rej text := '017' || r || '15'; p_goog text := '017' || r || '16';
  c_recent uuid; c_old uuid; c_old2 uuid; c_rej uuid; c_goog uuid;
  u_a uuid := gen_random_uuid(); u_b uuid := gen_random_uuid(); u_b2 uuid := gen_random_uuid(); u_c uuid := gen_random_uuid();
  u_new uuid := gen_random_uuid(); u_rej uuid := gen_random_uuid(); u_goog uuid := gen_random_uuid();
  j jsonb;
  who uuid;
begin
  -- Name rules.
  assert portal_name_matches('nazmul', 'Md. Nazmul Huda'), 'prefix ignored';
  assert portal_name_matches('NAZMUL HUDA', 'Md Nazmul Huda'), 'case and prefix';
  assert not portal_name_matches('Rahim', 'Md Nazmul Huda'), 'other name';
  assert not portal_name_matches('Md', 'Md Nazmul'), 'a prefix alone is not a name';
  assert portal_name_matches('নাজমুল', 'নাজমুল হুদা'), 'Bangla';
  assert portal_first_name('Md. Nazmul Huda') = 'Nazmul', 'first name skips the prefix';

  -- Velto customers (Ops).
  insert into customers (name, phone, address, status) values ('Md. Nazmul Huda', p_recent, 'House 1, Road 2', 'Active') returning id into c_recent;
  insert into customers (name, phone, address, status) values ('Karim Uddin', p_old, 'House 9', 'Active') returning id into c_old;
  insert into customers (name, phone, address, status) values ('Salma Akter', p_old2, 'House 7', 'Active') returning id into c_old2;
  insert into customers (name, phone, address, status) values ('Rafiq Islam', p_rej, 'House 5', 'Active') returning id into c_rej;
  insert into customers (name, phone, address, status) values ('Tania Rahman', p_goog, 'House 3', 'Active') returning id into c_goog;
  insert into orders (customer_id, order_number, order_date, order_status, service_category) values
    (c_recent, 'ZZI-1', today - 20, 'Delivered', array['Ironing']), (c_recent, 'ZZI-2', today - 5, 'Delivered', array['Ironing']),
    (c_old, 'ZZI-3', today - 500, 'Delivered', array['Ironing']),
    (c_old2, 'ZZI-4', today - 450, 'Delivered', array['Ironing']),
    (c_rej, 'ZZI-5', today - 10, 'Delivered', array['Ironing']),
    (c_goog, 'ZZI-6', today - 30, 'Delivered', array['Ironing']);

  -- Logins: SMS sign-ins (phone confirmed), one Google login with a typed phone.
  insert into auth.users (id, phone, phone_confirmed_at, aud, role, instance_id) values
    (u_a, '88' || p_recent, now(), 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (u_b, '88' || p_old, now(), 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (u_b2, '88' || p_old2, now(), 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (u_new, '88' || p_new, now(), 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (u_rej, '88' || p_rej, now(), 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
  insert into auth.users (id, email, aud, role, instance_id) values
    (u_c, 'zz-idc-' || left(u_c::text, 8) || '@example.invalid', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (u_goog, 'zz-idg-' || left(u_goog::text, 8) || '@example.invalid', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
  insert into customer_accounts (auth_user_id, full_name, phone, terms_version, terms_accepted_at)
  values (u_goog, 'Tania R', p_goog, 1, now());

  -- ---------- A: one recent match, no account yet → welcome back, one tap ----------
  perform set_config('request.jwt.claims', json_build_object('sub', u_a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  j := portal_match_preview();
  assert j = jsonb_build_object('state', 'recent', 'hasProfile', false, 'firstName', 'Nazmul', 'orders', 2, 'lastOrder', to_char(today - 5, 'YYYY-MM')),
    format('recent preview shows only first name, count and month: %s', j);
  assert portal_orders(50) = '[]'::jsonb, 'no history before the claim';
  begin perform portal_claim_match(null, null); raise exception 'claimed without terms'; exception when invalid_parameter_value then null; end;
  j := portal_claim_match(null, 1::smallint);
  assert (j ->> 'ok')::boolean, format('claim: %s', j);
  assert jsonb_array_length(portal_orders(50)) = 2, 'history after the claim';
  assert portal_match_preview() ->> 'state' = 'linked', 'linked: no question again';
  execute 'reset role';
  assert (select full_name = 'Md. Nazmul Huda' and address = 'House 1, Road 2' and link_status = 'linked' and terms_version = 1
            from customer_accounts where auth_user_id = u_a), 'account created from Ops details';

  -- ---------- B: old record → name check; three misses → staff ----------
  perform set_config('request.jwt.claims', json_build_object('sub', u_b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  j := portal_match_preview();
  assert j = '{"state": "stepup", "hasProfile": false, "attemptsLeft": 3}'::jsonb, format('stepup shows nothing: %s', j);
  j := portal_claim_match(null, 1::smallint);
  assert j ->> 'error' = 'name_required', format('name needed: %s', j);
  j := portal_claim_match('Rahim', 1::smallint);
  assert j ->> 'error' = 'name_mismatch' and (j ->> 'attemptsLeft')::int = 2, format('miss 1: %s', j);
  j := portal_claim_match('Someone', 1::smallint);
  assert (j ->> 'attemptsLeft')::int = 1, format('miss 2: %s', j);
  j := portal_claim_match('Another', 1::smallint);
  assert j ->> 'state' = 'assisted', format('miss 3 → staff: %s', j);
  assert portal_match_preview() ->> 'state' = 'assisted', 'stays with staff';
  j := portal_claim_match('Karim', 1::smallint);
  assert not (j ->> 'ok')::boolean, 'no claim after three misses, even with the right name';
  assert portal_orders(50) = '[]'::jsonb, 'still no history';
  execute 'reset role';

  -- ---------- B2: old record, right name → restored ----------
  perform set_config('request.jwt.claims', json_build_object('sub', u_b2, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  j := portal_claim_match('  salma  ', 1::smallint);
  assert (j ->> 'ok')::boolean, format('name check passed: %s', j);
  assert jsonb_array_length(portal_orders(50)) = 1, 'old history restored';
  execute 'reset role';

  -- ---------- C: a second login proving A's phone (same person, or a new owner) → name check ----------
  -- (Supabase allows one SMS login per number, so a second login is a Google one proving it.)
  insert into customer_accounts (auth_user_id, full_name, phone, terms_version, terms_accepted_at) values (u_c, 'N Huda', p_recent, 1, now());
  execute 'set local role service_role';
  assert portal_link_verified_phone(u_c, p_recent) ->> 'result' = 'match', 'second login proves the phone';
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', u_c, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  assert portal_match_preview() ->> 'state' = 'stepup', 'already linked to another login → name check, nothing shown';
  j := portal_claim_match('Nazmul', 1::smallint);
  assert (j ->> 'ok')::boolean, 'the same person passes the check';
  execute 'reset role';

  -- ---------- no Velto customer → new-customer onboarding ----------
  perform set_config('request.jwt.claims', json_build_object('sub', u_new, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  assert portal_match_preview() = '{"state": "none", "hasProfile": false}'::jsonb, 'none';
  assert not (portal_claim_match(null, 1::smallint) ->> 'ok')::boolean, 'nothing to claim';
  execute 'reset role';

  -- ---------- "This isn't me" → never again, flagged ----------
  perform set_config('request.jwt.claims', json_build_object('sub', u_rej, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  assert portal_match_preview() ->> 'state' = 'recent', 'offered once';
  j := portal_reject_match();
  assert (j ->> 'ok')::boolean, format('reject: %s', j);
  assert portal_match_preview() = '{"state": "rejected", "hasProfile": false}'::jsonb, 'not offered again';
  assert not (portal_claim_match(null, 1::smallint) ->> 'ok')::boolean, 'cannot claim after rejecting';
  assert portal_orders(50) = '[]'::jsonb, 'history hidden';
  -- Profile save (new-customer onboarding) doesn't link either: auto-link is off.
  perform portal_profile_save('New Owner', p_rej, 'Flat 2', '7', 1::smallint);
  assert portal_match_preview() ->> 'state' = 'rejected', 'still not linked after onboarding';
  assert portal_orders(50) = '[]'::jsonb, 'still hidden after onboarding';
  execute 'reset role';

  -- ---------- Google login proves its phone with a website SMS code → confirm, then linked ----------
  execute 'set local role service_role';
  j := portal_link_verified_phone(u_goog, p_goog);
  assert j ->> 'result' = 'match', format('proof recorded, not linked: %s', j);
  execute 'reset role';
  assert (select link_status = 'none' and proven_phone = p_goog from customer_accounts where auth_user_id = u_goog), 'not linked by the SMS code alone';
  perform set_config('request.jwt.claims', json_build_object('sub', u_goog, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  j := portal_match_preview();
  assert j ->> 'state' = 'recent' and (j ->> 'hasProfile')::boolean and j ->> 'firstName' = 'Tania', format('google preview: %s', j);
  assert (portal_claim_match(null, null) ->> 'ok')::boolean, 'existing profile: no terms needed again';
  assert jsonb_array_length(portal_orders(50)) = 1, 'google login sees its history';
  execute 'reset role';

  -- ---------- staff ----------
  execute 'set local role service_role';
  j := website_identity_flags(500);
  assert exists (select 1 from jsonb_array_elements(j) e where e ->> 'phone' = p_rej and e ->> 'decision' = 'rejected'), 'rejection flagged';
  assert exists (select 1 from jsonb_array_elements(j) e where e ->> 'phone' = p_old and e ->> 'decision' = 'stepup_failed'), 'failed check flagged';
  assert website_phone_flags(array['+88' || p_rej, p_recent, p_old]) @> array[p_rej, p_old] and not (website_phone_flags(array[p_recent]) @> array[p_recent]), 'booking flag by phone';
  assert website_identity_flag_review(u_rej, c_rej, 'ZZ Staff'), 'reviewed';
  assert not (website_phone_flags(array[p_rej]) @> array[p_rej]), 'reviewed flag no longer on bookings';
  begin perform portal_match(u_a); raise exception 'internal match open to service'; exception when insufficient_privilege then null; end;
  execute 'reset role';

  -- ---------- nobody else ----------
  execute 'set local role authenticated';
  begin perform website_identity_flags(10); raise exception 'flags open to customers'; exception when insufficient_privilege then null; end;
  begin perform portal_match(u_a); raise exception 'internal match open to customers'; exception when insufficient_privilege then null; end;
  begin perform 1 from customer_identity_decisions; raise exception 'decisions readable'; exception when insufficient_privilege then null; end;
  execute 'reset role';
  execute 'set local role anon';
  begin perform portal_match_preview(); raise exception 'anon preview'; exception when insufficient_privilege then null; end;
  execute 'reset role';

  raise exception 'ALL_TESTS_PASSED (rolled back)';
end $$;
