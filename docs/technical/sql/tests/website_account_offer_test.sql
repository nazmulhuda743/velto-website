-- Synthetic test for docs/technical/sql/website_account_offer.sql. STAGING ONLY.
-- A fake SMS-signed-in customer with two open website bookings and one cancelled; the count
-- must be 2 for them and 0 for a customer with no proven phone; then a raise rolls back.
-- Expected: an error reading "ALL_ACCOUNT_OFFER_TESTS_PASSED (rolled back)".
do $$
declare
  r text := lpad((floor(random() * 1000000))::int::text, 6, '0');
  pa text := '017' || r || '61';
  ua uuid := gen_random_uuid(); uc uuid := gen_random_uuid();
  t1 uuid; t2 uuid; t3 uuid;
  n int;
begin
  insert into auth.users (id, email, phone, phone_confirmed_at, aud, role, instance_id)
  values (ua, null, '88' || pa, now(), 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
         (uc, 'zz-offer-' || left(uc::text, 8) || '@example.invalid', null, null, 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
  insert into customer_accounts (auth_user_id, full_name, phone, terms_version, terms_accepted_at)
  values (ua, 'ZZ Offer A', pa, 1, now()), (uc, 'ZZ Offer C', '019' || r || '63', 1, now());

  insert into tasks (title, type, priority, status, due_at, description, assigned_by_name, source, source_ref, dedupe_key)
  values ('ZZ offer 1', 'pickup', 'high', 'open', now() + interval '1 hour', 'Pickup request from Velto website.', 'Velto website', 'website_booking', pa, 'zz-offer-1-' || r)
  returning id into t1;
  insert into tasks (title, type, priority, status, due_at, description, assigned_by_name, source, source_ref, dedupe_key)
  values ('ZZ offer 2', 'pickup', 'high', 'done', now() - interval '20 days', 'Pickup request from Velto website.', 'Velto website', 'website_booking', pa, 'zz-offer-2-' || r)
  returning id into t2;
  insert into tasks (title, type, priority, status, due_at, description, assigned_by_name, source, source_ref, dedupe_key)
  values ('ZZ offer 3', 'pickup', 'high', 'done', now() - interval '2 days', 'Pickup request from Velto website.', 'Velto website', 'website_booking', pa, 'zz-offer-3-' || r)
  returning id into t3;
  insert into website_dispatch_jobs (task_id, kind, source, stage)
  values (t3, 'pickup', 'website_booking', 'cancelled');

  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  n := public.portal_website_bookings();
  if n <> 2 then raise exception 'expected 2 bookings for the signed-in customer, got %', n; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', uc, 'role', 'authenticated')::text, true);
  n := public.portal_website_bookings();
  if n <> 0 then raise exception 'expected 0 for a customer with no proven phone, got %', n; end if;

  raise exception 'ALL_ACCOUNT_OFFER_TESTS_PASSED (rolled back)';
end $$;
