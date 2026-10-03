-- Synthetic test for docs/technical/sql/website_push_prefs.sql (after website_push.sql). STAGING ONLY.
-- Rolls back: expected an error reading "ALL_TESTS_PASSED (rolled back)".
begin;
do $$
declare
  r text := lpad((floor(random() * 1000000))::int::text, 6, '0');
  ph text; uid uuid := gen_random_uuid(); other uuid := gen_random_uuid(); cust uuid; j jsonb;
  ep text; k text := repeat('A', 87); a text := repeat('B', 22);
begin
  ph := '017' || r || '66';
  ep := 'https://fcm.googleapis.com/fcm/send/zz-prefs-' || r;
  insert into auth.users (id, phone, phone_confirmed_at, aud, role, instance_id)
  values (uid, '88' || ph, now(), 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
  insert into customers (name, phone, zone, status) values ('Md. Zz Prefs', ph, 'Uttara', 'Active') returning id into cust;
  insert into customer_accounts (auth_user_id, full_name, phone, customer_id, verified_phone, link_status, terms_version, terms_accepted_at)
  values (uid, 'Zz Prefs', ph, cust, ph, 'linked', 1, now());

  -- No subscription yet: the defaults (operational on, offers off).
  j := website_push_status(uid);
  assert (j ->> 'devices')::int = 0 and (j ->> 'orderUpdates')::boolean and (j ->> 'pickupUpdates')::boolean
     and (j ->> 'careUpdates')::boolean and (j ->> 'paymentUpdates')::boolean and (j ->> 'reminders')::boolean
     and not (j ->> 'offers')::boolean, format('defaults without devices: %s', j);

  -- Subscribed: the same defaults on the row.
  j := website_push_save_for_user(uid, ep, k, a, 'en', 'test');
  assert (j ->> 'devices')::int = 1 and (j ->> 'pickupUpdates')::boolean and not (j ->> 'offers')::boolean, format('after subscribe: %s', j);
  assert (select pickup_updates and care_updates and payment_updates and not offers from website_push_subs where endpoint = ep), 'row defaults';

  -- Only the keys present change.
  j := website_push_prefs_set(uid, '{"care": false}');
  assert not (j ->> 'careUpdates')::boolean and (j ->> 'orderUpdates')::boolean and (j ->> 'pickupUpdates')::boolean
     and (j ->> 'paymentUpdates')::boolean and (j ->> 'reminders')::boolean and not (j ->> 'offers')::boolean, format('care off only: %s', j);
  j := website_push_prefs_set(uid, '{"offers": true, "payment": false, "pickup": false}');
  assert (j ->> 'offers')::boolean and not (j ->> 'paymentUpdates')::boolean and not (j ->> 'pickupUpdates')::boolean
     and not (j ->> 'careUpdates')::boolean, format('three at once: %s', j);
  j := website_push_prefs_set(uid, '{"order": false, "reminders": false}');
  assert not (j ->> 'orderUpdates')::boolean and not (j ->> 'reminders')::boolean, format('order and reminders: %s', j);
  assert (select not order_updates and not reminders and not pickup_updates and not care_updates and not payment_updates and offers
            from website_push_subs where endpoint = ep), 'stored';

  -- Junk is ignored: non-boolean values, unknown keys, not an object, null.
  j := website_push_prefs_set(uid, '{"order": "yes", "care": 1, "offers": null, "admin": true}');
  assert not (j ->> 'orderUpdates')::boolean and not (j ->> 'careUpdates')::boolean and (j ->> 'offers')::boolean, format('junk ignored: %s', j);
  j := website_push_prefs_set(uid, '[true]');
  assert (j ->> 'offers')::boolean, 'array ignored';
  j := website_push_prefs_set(uid, null);
  assert (j ->> 'offers')::boolean, 'null ignored';

  -- The old two-switch function still works alongside.
  j := website_push_prefs(uid, true, true);
  assert (j ->> 'orderUpdates')::boolean and (j ->> 'reminders')::boolean and (j ->> 'offers')::boolean, format('old prefs: %s', j);

  -- Another login's call changes nothing here; turned-off rows are not touched.
  perform website_push_prefs_set(other, '{"offers": false}');
  assert (select offers from website_push_subs where endpoint = ep), 'other login cannot change it';
  perform website_push_remove(uid, ep);
  perform website_push_prefs_set(uid, '{"offers": false}');
  assert (select offers from website_push_subs where endpoint = ep), 'inactive row untouched';

  -- Nobody but the server.
  execute 'set local role authenticated';
  begin perform website_push_prefs_set(uid, '{"offers": true}'); raise exception 'customers call prefs_set'; exception when insufficient_privilege then null; end;
  begin perform website_push_status(uid); raise exception 'customers call status'; exception when insufficient_privilege then null; end;
  execute 'reset role';
  execute 'set local role anon';
  begin perform website_push_prefs_set(uid, '{"offers": true}'); raise exception 'anon calls prefs_set'; exception when insufficient_privilege then null; end;
  execute 'reset role';

  raise exception 'ALL_TESTS_PASSED (rolled back)';
end $$;
rollback;
