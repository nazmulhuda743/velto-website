-- Synthetic test for docs/technical/sql/website_today.sql and the portal_pickup_change change in
-- website_customer_pickups.sql. STAGING ONLY. Runs in one transaction and rolls back: nothing is kept.
-- Expected: the final select returns 'ALL TODAY TESTS PASSED'; any failing assert raises an error.
-- Uses two active profiles; creates fake Ops orders (0179999xxxx phones), tasks, a weekly
-- subscription and one signed-in customer.
begin;

do $$
declare
  v_today date := (now() at time zone 'Asia/Dhaka')::date;
  rnd text := lpad((floor(random() * 1000000))::int::text, 6, '0');
  v_r1 uuid; v_r1_name text; v_r2 uuid;
  p_one text := '01799997101'; p_two text := '01799997102'; p_late text := '01799997103'; p_taken text := '01799997104';
  p_before text := '01799997107'; p_cancel text := '01799997108'; p_mix text := '01799997109';
  j_one uuid; j_two uuid; j_late uuid; j_taken uuid; j_holder uuid; j_before uuid; j_cancel uuid; j_mix uuid;
  o_one text; o_two_a text; o_two_b text; o_late text; o_taken text; o_before text; o_cancel text; o_mix text; o_ready20 text; o_ready40 text;
  v_sub uuid; v_sub_paused uuid; t_week uuid; t_week_old uuid; t_week_delivery uuid; t_week_paused uuid; t_week_done uuid;
  v_user uuid := gen_random_uuid(); v_phone text; t_cust uuid; j_cust uuid;
  n integer; r jsonb; jb record;
begin
  /* ---------- access: service role only ---------- */
  assert (select relrowsecurity from pg_class where oid = 'public.website_riders'::regclass), 'RLS on website_riders';
  assert (select relrowsecurity from pg_class where oid = 'public.website_rider_days_off'::regclass), 'RLS on website_rider_days_off';
  assert not exists (select 1 from pg_policies where tablename in ('website_riders', 'website_rider_days_off')), 'no policies';

  execute 'set local role anon';
  begin perform 1 from public.website_riders; raise exception 'anon read website_riders';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.website_rider_days_off; raise exception 'anon read website_rider_days_off';
  exception when insufficient_privilege then null; end;
  begin perform public.website_dispatch_autolink(); raise exception 'anon ran autolink';
  exception when insufficient_privilege then null; end;
  execute 'reset role';
  execute 'set local role authenticated';
  begin perform 1 from public.website_riders; raise exception 'authenticated read website_riders';
  exception when insufficient_privilege then null; end;
  begin perform public.website_dispatch_sync(); raise exception 'authenticated ran sync';
  exception when insufficient_privilege then null; end;
  execute 'reset role';

  /* ---------- riders: defaults and limits ---------- */
  select id, name into v_r1, v_r1_name from public.profiles where active order by name, id limit 1;
  select id into v_r2 from public.profiles where active and id <> v_r1 order by name, id limit 1;
  assert v_r1 is not null and v_r2 is not null, 'two active profiles on staging';

  execute 'set local role service_role';
  insert into public.website_riders (profile_id) values (v_r2);
  select * into jb from public.website_riders where profile_id = v_r2;
  assert jb.can_ride and jb.stops_per_window = 8, 'rider defaults: can ride, 8 stops';
  begin update public.website_riders set stops_per_window = 31 where profile_id = v_r2; raise exception '31 stops accepted';
  exception when check_violation then null; end;
  insert into public.website_rider_days_off (profile_id, day) values (v_r2, v_today + 1);
  begin insert into public.website_rider_days_off (profile_id, day) values (v_r2, v_today + 1); raise exception 'same day off twice';
  exception when unique_violation then null; end;
  delete from public.website_riders where profile_id = v_r2;
  delete from public.website_rider_days_off where profile_id = v_r2;
  execute 'reset role';

  /* ---------- cron: one job, every 5 minutes, sync then auto-link ---------- */
  assert (select count(*) from cron.job where jobname = 'website-dispatch-sync') = 1, 'one cron job';
  assert (select schedule = '*/5 * * * *' and command like '%website_dispatch_sync()%website_dispatch_autolink()%' and active
            from cron.job where jobname = 'website-dispatch-sync'), 'cron job every 5 minutes';

  /* ---------- weekly routine pickups start at To assign, once ---------- */
  insert into public.weekly_subscriptions (name, phone, address, sector, days, time_window, status)
  values ('ZZ Weekly ' || rnd, '01799997105', 'House 5, Road 5', 'Uttara Sector 5', array[1, 4], 'afternoon', 'active')
  returning id into v_sub;
  insert into public.weekly_subscriptions (name, phone, address, sector, days, time_window, status)
  values ('ZZ Weekly Paused ' || rnd, '01799997110', 'House 10, Road 5', 'Uttara Sector 5', array[1, 4], 'morning', 'paused')
  returning id into v_sub_paused;
  insert into public.tasks (title, type, priority, status, due_at, description, assigned_by_name, source, source_ref, dedupe_key)
  values ('Weekly pickup · ZZ Weekly (afternoon)', 'pickup', 'normal', 'open', ((v_today + 1)::timestamp + interval '9 hour') at time zone 'Asia/Dhaka',
          'House 5, Road 5 · ৳0/run', 'Velto (auto)', 'weekly', v_sub::text, 'wk:zz-' || rnd || ':pickup')
  returning id into t_week;
  insert into public.tasks (title, type, priority, status, due_at, description, assigned_by_name, source, source_ref, dedupe_key)
  values ('Weekly pickup · ZZ Weekly (afternoon)', 'pickup', 'normal', 'open', ((v_today - 1)::timestamp + interval '9 hour') at time zone 'Asia/Dhaka',
          'House 5, Road 5', 'Velto (auto)', 'weekly', v_sub::text, 'wk:zz-' || rnd || ':old')
  returning id into t_week_old;
  insert into public.tasks (title, type, priority, status, due_at, description, assigned_by_name, source, source_ref, dedupe_key)
  values ('Weekly delivery · ZZ Weekly', 'delivery', 'normal', 'open', ((v_today + 1)::timestamp + interval '17 hour') at time zone 'Asia/Dhaka',
          'Return', 'Velto (auto)', 'weekly', v_sub::text, 'wk:zz-' || rnd || ':delivery')
  returning id into t_week_delivery;
  insert into public.tasks (title, type, priority, status, due_at, description, assigned_by_name, source, source_ref, dedupe_key)
  values ('Weekly pickup · ZZ Weekly Paused (morning)', 'pickup', 'normal', 'open', ((v_today + 1)::timestamp + interval '9 hour') at time zone 'Asia/Dhaka',
          'House 10, Road 5', 'Velto (auto)', 'weekly', v_sub_paused::text, 'wk:zz-' || rnd || ':paused')
  returning id into t_week_paused;
  insert into public.tasks (title, type, priority, status, due_at, done_at, done_by_name, description, assigned_by_name, source, source_ref, dedupe_key)
  values ('Weekly pickup · ZZ Weekly (afternoon)', 'pickup', 'normal', 'done', ((v_today + 2)::timestamp + interval '9 hour') at time zone 'Asia/Dhaka',
          now(), 'Rider', 'House 5, Road 5', 'Velto (auto)', 'weekly', v_sub::text, 'wk:zz-' || rnd || ':done')
  returning id into t_week_done;

  execute 'set local role service_role';
  r := public.website_dispatch_sync();
  assert (r ->> 'weekly')::int >= 1, 'sync reports weekly: ' || r::text;
  select * into jb from public.website_dispatch_jobs where task_id = t_week;
  assert jb.id is not null, 'weekly pickup on the board';
  assert jb.kind = 'pickup' and jb.source = 'weekly' and jb.stage = 'confirmed' and jb.confirmed_at is not null,
    'weekly starts confirmed: ' || coalesce(jb.stage, '-');
  assert jb.slot_date = v_today + 1 and jb.slot = 'afternoon', 'weekly on its day and window';
  assert jb.phone_key = '01799997105' and jb.customer_name = 'ZZ Weekly ' || rnd and jb.address = 'House 5, Road 5', 'weekly customer details';
  assert not exists (select 1 from public.website_dispatch_jobs where task_id = t_week_old), 'weekly due yesterday not imported';
  assert not exists (select 1 from public.website_dispatch_jobs where task_id = t_week_delivery), 'weekly delivery task not imported';
  assert not exists (select 1 from public.website_dispatch_jobs where task_id = t_week_paused), 'paused routine not imported';
  assert not exists (select 1 from public.website_dispatch_jobs where task_id = t_week_done), 'weekly task already done in Ops not imported';
  r := public.website_dispatch_sync();
  assert (select count(*) from public.website_dispatch_jobs where task_id = t_week) = 1, 'second sync does not duplicate';
  assert (r ->> 'weekly')::int = 0, 'second sync adds no weekly job: ' || r::text;
  -- A manager gives it a rider: Assigned (scheduled).
  r := public.website_dispatch_plan(jb.id, v_r1, v_r1_name, v_today + 1, 'afternoon', 'QA');
  assert (r ->> 'ok')::boolean and (select stage from public.website_dispatch_jobs where id = jb.id) = 'scheduled', 'weekly job assigned';
  execute 'reset role';

  /* ---------- auto-link ---------- */
  -- Anything already linkable on staging is linked first, so the counts below are this test's own.
  execute 'set local role service_role';
  perform public.website_dispatch_autolink();
  execute 'reset role';

  -- Test jobs reached the board a day before pickup (created_at), except where stated.
  -- A. Nothing to link: each job below has zero or several candidates.
  insert into public.website_dispatch_jobs (kind, source, customer_name, phone, phone_key, stage, picked_at, created_at)
  values ('pickup', 'website_booking', 'ZZ Two', p_two, p_two, 'picked', now() - interval '2 hours', now() - interval '1 day') returning id into j_two;
  insert into public.orders (phone_snapshot, name_snapshot, service_category, order_status, created_at)
  values (p_two, 'ZZ Two', array['Ironing'], 'New', now() - interval '1 hour') returning order_number into o_two_a;
  insert into public.orders (phone_snapshot, name_snapshot, service_category, order_status, created_at)
  values (p_two, 'ZZ Two', array['Ironing'], 'New', now()) returning order_number into o_two_b;
  -- Picked 3 days ago; the order came today (3 days after the pickup).
  insert into public.website_dispatch_jobs (kind, source, customer_name, phone, phone_key, stage, picked_at, created_at)
  values ('pickup', 'website_booking', 'ZZ Late', p_late, p_late, 'picked', now() - interval '3 days', now() - interval '4 days') returning id into j_late;
  insert into public.orders (phone_snapshot, name_snapshot, service_category, order_status, created_at)
  values (p_late, 'ZZ Late', array['Ironing'], 'New', now()) returning order_number into o_late;
  -- The only order for p_taken is already linked to another pickup job.
  insert into public.website_dispatch_jobs (kind, source, customer_name, phone, phone_key, stage, picked_at, created_at)
  values ('pickup', 'website_booking', 'ZZ Taken', p_taken, p_taken, 'picked', now() - interval '2 hours', now() - interval '1 day') returning id into j_taken;
  insert into public.orders (phone_snapshot, name_snapshot, service_category, order_status, created_at)
  values (p_taken, 'ZZ Taken', array['Ironing'], 'New', now()) returning order_number into o_taken;
  insert into public.website_dispatch_jobs (kind, source, customer_name, phone, phone_key, stage, picked_at, created_at, order_number)
  values ('pickup', 'website_booking', 'ZZ Holder', p_taken, p_taken, 'picked', now() - interval '3 hours', now() - interval '1 day', o_taken) returning id into j_holder;
  -- The job reached the board an hour ago; the only order was made two hours ago (before the booking).
  insert into public.website_dispatch_jobs (kind, source, customer_name, phone, phone_key, stage, picked_at, created_at)
  values ('pickup', 'website_booking', 'ZZ Before', p_before, p_before, 'picked', now() - interval '30 minutes', now() - interval '1 hour') returning id into j_before;
  insert into public.orders (phone_snapshot, name_snapshot, service_category, order_status, created_at)
  values (p_before, 'ZZ Before', array['Ironing'], 'New', now() - interval '2 hours') returning order_number into o_before;
  -- The only order is cancelled.
  insert into public.website_dispatch_jobs (kind, source, customer_name, phone, phone_key, stage, picked_at, created_at)
  values ('pickup', 'website_booking', 'ZZ Cancel', p_cancel, p_cancel, 'picked', now() - interval '2 hours', now() - interval '1 day') returning id into j_cancel;
  insert into public.orders (phone_snapshot, name_snapshot, service_category, order_status, created_at)
  values (p_cancel, 'ZZ Cancel', array['Ironing'], 'Cancelled', now()) returning order_number into o_cancel;

  execute 'set local role service_role';
  n := public.website_dispatch_autolink();
  assert n = 0, 'two candidates, late, taken, before-the-job and cancelled orders: nothing linked, returns 0: ' || n;
  assert (select order_number from public.website_dispatch_jobs where id = j_two) is null, 'two candidates: not linked';
  assert (select order_number from public.website_dispatch_jobs where id = j_late) is null, 'order 3 days after pickup: not linked';
  assert (select order_number from public.website_dispatch_jobs where id = j_taken) is null, 'order linked to another job: not linked';
  assert (select order_number from public.website_dispatch_jobs where id = j_before) is null, 'order made before the job: not linked';
  assert (select order_number from public.website_dispatch_jobs where id = j_cancel) is null, 'cancelled order: not linked';
  execute 'reset role';

  -- B. One candidate each: linked. p_mix has a cancelled order and one real order.
  insert into public.website_dispatch_jobs (kind, source, customer_name, phone, phone_key, stage, picked_at, created_at)
  values ('pickup', 'website_booking', 'ZZ One', p_one, p_one, 'picked', now() - interval '2 hours', now() - interval '1 day') returning id into j_one;
  insert into public.orders (phone_snapshot, name_snapshot, service_category, order_status, created_at)
  values (p_one, 'ZZ One', array['Ironing'], 'New', now()) returning order_number into o_one;
  insert into public.website_dispatch_jobs (kind, source, customer_name, phone, phone_key, stage, picked_at, created_at)
  values ('pickup', 'website_booking', 'ZZ Mix', p_mix, p_mix, 'picked', now() - interval '2 hours', now() - interval '1 day') returning id into j_mix;
  insert into public.orders (phone_snapshot, name_snapshot, service_category, order_status, created_at)
  values (p_mix, 'ZZ Mix', array['Ironing'], 'Cancelled', now() - interval '1 hour');
  insert into public.orders (phone_snapshot, name_snapshot, service_category, order_status, created_at)
  values (p_mix, 'ZZ Mix', array['Ironing'], 'New', now()) returning order_number into o_mix;

  execute 'set local role service_role';
  n := public.website_dispatch_autolink();
  assert n = 2, 'one candidate each: two links: ' || n;
  assert (select order_number from public.website_dispatch_jobs where id = j_one) = o_one, 'one candidate: linked';
  assert (select history -> -1 ->> 'by' = 'Auto-link' and history -> -1 ->> 'action' = 'order linked'
            from public.website_dispatch_jobs where id = j_one), 'linked through the link RPC, by Auto-link';
  assert (select order_number from public.website_dispatch_jobs where id = j_mix) = o_mix, 'cancelled order ignored, the real one linked';
  assert (select order_number from public.website_dispatch_jobs where id = j_two) is null, 'two candidates still not linked';
  n := public.website_dispatch_autolink();
  assert n = 0, 'second run links nothing: ' || n;
  -- The manager picks one of the two: it stays as chosen.
  r := public.website_dispatch_link_order(j_two, o_two_b, 'QA');
  assert (r ->> 'ok')::boolean, 'manual link';
  assert public.website_dispatch_autolink() = 0, 'manual link is kept';
  assert (select order_number from public.website_dispatch_jobs where id = j_two) = o_two_b, 'manual choice unchanged';
  execute 'reset role';

  /* ---------- Ready orders: the last 30 days come onto the board, older ones stay with Ops ---------- */
  insert into public.orders (phone_snapshot, name_snapshot, service_category, order_status, created_at, updated_at, delivery_date)
  values ('01799997111', 'ZZ Ready 20d', array['Ironing'], 'Ready', now() - interval '25 days', now() - interval '20 days', v_today - 10)
  returning order_number into o_ready20;
  insert into public.orders (phone_snapshot, name_snapshot, service_category, order_status, created_at, updated_at, delivery_date)
  values ('01799997112', 'ZZ Ready 40d', array['Ironing'], 'Ready', now() - interval '45 days', now() - interval '40 days', v_today - 30)
  returning order_number into o_ready40;
  execute 'set local role service_role';
  perform public.website_dispatch_sync();
  assert exists (select 1 from public.website_dispatch_jobs where kind = 'delivery' and order_number = o_ready20 and stage = 'new'),
    'order Ready 20 days on the board';
  assert not exists (select 1 from public.website_dispatch_jobs where kind = 'delivery' and order_number = o_ready40),
    'order Ready 40 days left to Ops';
  execute 'reset role';

  /* ---------- the customer changes time: the rider stays only while free ---------- */
  v_phone := '017' || rnd || '61';
  insert into auth.users (id, email, phone, phone_confirmed_at, aud, role, instance_id)
  values (v_user, null, '88' || v_phone, now(), 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
  insert into public.customer_accounts (auth_user_id, full_name, phone, terms_version, terms_accepted_at)
  values (v_user, 'ZZ Today Customer', v_phone, 1, now());
  insert into public.tasks (title, type, priority, status, due_at, description, assigned_by_name, source, source_ref, dedupe_key)
  values ('ZZ today pickup', 'pickup', 'high', 'open', now() + interval '1 hour',
          E'Pickup request from Velto website.\nName: ZZ Today Customer\nPhone: ' || v_phone || E'\nArea: Uttara Sector 7\nAddress: Road 9\nPreferred pickup: Tomorrow, Morning',
          'Velto website', 'website_booking', v_phone, 'zz-today-' || rnd)
  returning id into t_cust;

  execute 'set local role service_role';
  perform public.website_dispatch_sync();
  select id into j_cust from public.website_dispatch_jobs where task_id = t_cust;
  assert j_cust is not null, 'customer job on the board';
  r := public.website_dispatch_plan(j_cust, v_r1, v_r1_name, v_today + 10, 'morning', 'QA');
  assert (select stage from public.website_dispatch_jobs where id = j_cust) = 'scheduled', 'customer job assigned';
  execute 'reset role';

  -- 1. Room in the new window (nobody ticked as rider yet: everyone counts, 8 stops): kept.
  delete from public.website_riders;
  perform set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  r := public.portal_pickup_change(t_cust, v_today + 11, 'afternoon');
  execute 'reset role';
  select * into jb from public.website_dispatch_jobs where id = j_cust;
  assert jb.assignee_id = v_r1 and jb.assignee_name = v_r1_name, 'rider with room kept';
  assert jb.stage = 'new' and jb.slot_date is null and jb.confirmed_at is null, 'back to To call: ' || jb.stage;
  assert jb.history -> -1 ->> 'action' = 'customer changed time' and jb.history -> -1 ->> 'by' = 'Customer (website)', 'history: customer changed time';
  assert (select assigned_to = v_r1 and assignee_ids = array[v_r1] from public.tasks where id = t_cust), 'Ops task keeps the rider';
  assert (select due_at from public.tasks where id = t_cust) = public.website_dispatch_slot_end(v_today + 11, 'afternoon'), 'Ops task due at the new window';

  -- 2. Full in the new window (1 stop per window, one stop there already): removed.
  execute 'set local role service_role';
  r := public.website_dispatch_plan(j_cust, v_r1, v_r1_name, v_today + 10, 'morning', 'QA');
  assert (select stage from public.website_dispatch_jobs where id = j_cust) = 'scheduled', 'assigned again';
  execute 'reset role';
  insert into public.website_riders (profile_id, stops_per_window, updated_by) values (v_r1, 1, 'QA');
  insert into public.website_dispatch_jobs (kind, source, customer_name, phone_key, stage, slot_date, slot, assignee_id, assignee_name)
  values ('pickup', 'website_booking', 'ZZ Other Stop', '01799997106', 'scheduled', v_today + 12, 'evening', v_r1, v_r1_name);
  execute 'set local role authenticated';
  r := public.portal_pickup_change(t_cust, v_today + 12, 'evening');
  execute 'reset role';
  select * into jb from public.website_dispatch_jobs where id = j_cust;
  assert jb.assignee_id is null and jb.assignee_name is null and jb.stage = 'new', 'full rider removed';
  assert (select assigned_to is null and assignee_ids = '{}'::uuid[] from public.tasks where id = t_cust), 'Ops task off the full rider''s list';

  -- 3. Room, but off that day: removed.
  update public.website_riders set stops_per_window = 8 where profile_id = v_r1;
  execute 'set local role service_role';
  r := public.website_dispatch_plan(j_cust, v_r1, v_r1_name, v_today + 10, 'morning', 'QA');
  execute 'reset role';
  insert into public.website_rider_days_off (profile_id, day) values (v_r1, v_today + 13);
  execute 'set local role authenticated';
  r := public.portal_pickup_change(t_cust, v_today + 13, 'morning');
  assert (select (p ->> 'changesLeft')::int from jsonb_array_elements(r -> 'pickups') p where p ->> 'id' = t_cust::text) = 0,
    'three changes counted (new history action)';
  begin perform public.portal_pickup_change(t_cust, v_today + 14, 'morning'); raise exception 'fourth change accepted';
  exception when insufficient_privilege then null; end;
  execute 'reset role';
  assert (select assignee_id is null from public.website_dispatch_jobs where id = j_cust), 'rider off that day removed';
end;
$$;

select 'ALL TODAY TESTS PASSED' as result;

rollback;
