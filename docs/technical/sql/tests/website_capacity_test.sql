-- Synthetic test for docs/technical/sql/website_capacity.sql. STAGING ONLY. Rolls back.
-- Expected: an error reading "ALL_CAPACITY_TESTS_PASSED (rolled back)".
do $$
declare
  tomorrow date := (now() at time zone 'Asia/Dhaka')::date + 1;
  r text := lpad((floor(random() * 1000000))::int::text, 6, '0');
  k1 text := 'qa-cap-' || r || '-aaaaaaaa';
  k2 text := 'qa-cap-' || r || '-bbbbbbbb';
  k3 text := 'qa-cap-' || r || '-cccccccc';
  k4 text := 'qa-cap-' || r || '-dddddddd';
  pay jsonb;
  j jsonb; a jsonb;
  job uuid; t1 uuid;
  v_used numeric;
begin
  assert public.capacity_zone_for('Uttara Sector 11') = 's9-12', 'sector 11 → s9-12';
  assert public.capacity_zone_for('House 4, Sector-7, Uttara') = 's1-8', 'sector-7 in an address';
  assert public.capacity_zone_for('Uttara') is null, 'no sector → no zone';

  -- Tomorrow evening in S9–12 takes 2 pickups.
  j := public.capacity_set_slot(tomorrow, 'pickup', 's9-12', 'evening', 2, false, 'QA', 'QA');
  assert (j->>'ok')::boolean, 'set slot';

  pay := jsonb_build_object('name', 'QA One', 'phone', '017' || r || '01', 'area', 'Uttara Sector 11', 'address', 'House 1, Road 1',
                            'preferredPickup', 'Tomorrow, Evening 4–8 PM', 'attribution', jsonb_build_object('consent', 'none'));
  j := public.website_book_pickup(k1, pay, jsonb_build_object('date', tomorrow, 'window', 'evening'));
  assert (j->>'ok')::boolean, 'first booking: ' || j::text;
  select id into t1 from public.tasks where dedupe_key = 'website:' || k1;
  assert (select due_at from public.tasks where id = t1) = public.website_dispatch_slot_end(tomorrow, 'evening'), 'task due at the window end';
  assert (select task_id from public.capacity_reservations where ref = 'booking:' || k1) = t1, 'reservation linked to the task';

  -- The same submission again: same reference, no second place taken.
  a := public.website_book_pickup(k1, pay, jsonb_build_object('date', tomorrow, 'window', 'evening'));
  assert a->>'reference' = j->>'reference', 'retry returns the same reference';

  j := public.website_book_pickup(k2, pay || jsonb_build_object('phone', '017' || r || '02', 'name', 'QA Two'), jsonb_build_object('date', tomorrow, 'window', 'evening'));
  assert (j->>'ok')::boolean, 'second booking fills the slot';
  select st.used into v_used from public.capacity_state(tomorrow, 'pickup', 's9-12', 'evening') st;
  assert v_used = 2, 'used 2, got ' || v_used;

  -- Full: the third is refused and nothing is created.
  j := public.website_book_pickup(k3, pay || jsonb_build_object('phone', '017' || r || '03'), jsonb_build_object('date', tomorrow, 'window', 'evening'));
  assert j->>'error' = 'slot_full', 'third refused: ' || j::text;
  assert not exists (select 1 from public.tasks where dedupe_key = 'website:' || k3), 'no task for a refused booking';
  a := public.capacity_availability('pickup', 's9-12');
  assert exists (select 1 from jsonb_array_elements(a->'days') d, jsonb_array_elements(d->'windows') w
                 where (d->>'date')::date = tomorrow and w->>'id' = 'evening' and w->>'status' = 'full'), 'availability says full';

  -- A website booking can't override; staff can, with a reason, and it is marked over capacity.
  j := public.website_book_pickup(k3, pay || jsonb_build_object('phone', '017' || r || '03'), jsonb_build_object('date', tomorrow, 'window', 'evening', 'override', 'x'));
  assert j->>'error' = 'slot_full', 'website override ignored';
  j := public.website_book_pickup(k3, pay || jsonb_build_object('phone', '017' || r || '03'),
                                  jsonb_build_object('date', tomorrow, 'window', 'evening', 'source', 'staff', 'actor', 'QA staff', 'override', 'Regular customer, rider agreed'));
  assert (j->>'ok')::boolean and (j->'slot'->>'over')::boolean, 'staff override: ' || j::text;

  -- Blocked, past, no zone.
  perform public.capacity_set_slot(tomorrow, 'pickup', 's9-12', 'morning', null, true, 'Rider off', 'QA');
  j := public.website_book_pickup(k4, pay || jsonb_build_object('phone', '017' || r || '04'), jsonb_build_object('date', tomorrow, 'window', 'morning'));
  assert j->>'error' = 'slot_closed', 'blocked: ' || j::text;
  j := public.website_book_pickup(k4, pay || jsonb_build_object('phone', '017' || r || '04'), jsonb_build_object('date', tomorrow - 2, 'window', 'evening'));
  assert j->>'error' = 'slot_past', 'past: ' || j::text;
  j := public.website_book_pickup(k4, pay || jsonb_build_object('phone', '017' || r || '04', 'area', 'Outside Uttara Sectors 1–18'), jsonb_build_object('date', tomorrow, 'window', 'afternoon'));
  assert j->>'error' = 'no_zone', 'outside: ' || j::text;

  -- The dispatch board: the booked pickup arrives planned for its window.
  perform public.website_dispatch_sync();
  perform public.capacity_sync_jobs();
  select id into job from public.website_dispatch_jobs where task_id = t1;
  assert (select slot_date = tomorrow and slot = 'evening' and stage = 'confirmed' and confirmed_by = 'Website (window booked)' and zone_id = 's9-12'
            from public.website_dispatch_jobs where id = job),
    'job arrives confirmed for the booked window';

  -- Moving it to the afternoon moves its place (evening frees one).
  j := public.website_dispatch_plan(job, null, null, tomorrow, 'afternoon', 'QA');
  assert (j->>'ok')::boolean, 'move: ' || j::text;
  assert (select window_id from public.capacity_reservations where ref = 'booking:' || k1) = 'afternoon', 'reservation moved';
  select st.used into v_used from public.capacity_state(tomorrow, 'pickup', 's9-12', 'evening') st;
  assert v_used = 2, 'evening now 2 (B + staff override), got ' || v_used;
  -- Back to the full evening: refused without a reason, allowed with one.
  j := public.website_dispatch_plan(job, null, null, tomorrow, 'evening', 'QA');
  assert j->>'error' = 'slot_full', 'full evening refused: ' || j::text;
  j := public.website_dispatch_plan(job, null, null, tomorrow, 'evening', 'QA', 'Customer insists');
  assert (j->>'ok')::boolean and (j->>'over')::boolean, 'manager override';

  -- A plan cleared directly (as the customer's own change does, website_customer_pickups.sql) frees the place.
  update public.website_dispatch_jobs set slot_date = null, slot = null, assignee_id = null, assignee_name = null,
         stage = 'new', confirmed_at = null, confirmed_by = null where id = job;
  assert (select status from public.capacity_reservations where ref = 'booking:' || k1) = 'released', 'customer change releases';
  -- ...and the sync does not put the old window back.
  perform public.capacity_sync_jobs();
  assert (select slot_date is null and stage = 'new' from public.website_dispatch_jobs where id = job), 'released window not re-applied';
  -- Planned again (confirmed by phone first), then cancelled: the place is freed again.
  update public.website_dispatch_jobs set confirmed_at = now(), confirmed_by = 'QA' where id = job;
  j := public.website_dispatch_plan(job, null, null, tomorrow, 'afternoon', 'QA');
  assert (j->>'ok')::boolean and (select stage from public.website_dispatch_jobs where id = job) = 'confirmed', 'confirmed stays confirmed: ' || j::text;
  perform public.website_dispatch_close(job, 'cancelled', 'QA', 'QA');
  assert (select status from public.capacity_reservations where ref = 'booking:' || k1) = 'released', 'cancel releases';

  -- A picked-up stop keeps its place (done), from the trigger alone.
  perform public.website_dispatch_sync();
  perform public.capacity_sync_jobs();
  select id into job from public.website_dispatch_jobs where task_id = (select id from public.tasks where dedupe_key = 'website:' || k2);
  update public.website_dispatch_jobs set stage = 'picked' where id = job;
  assert (select status from public.capacity_reservations where ref = 'booking:' || k2) = 'done', 'picked keeps its place';

  -- Confirmed by phone on the Requests card (website_dispatch_contact plans through
  -- website_dispatch_plan): a full window is refused, a free one takes a place.
  j := public.website_book_pickup(k4, pay || jsonb_build_object('phone', '017' || r || '04', 'name', 'QA Phone'),
                                  jsonb_build_object('date', tomorrow, 'window', 'afternoon'));
  perform public.website_dispatch_sync();
  perform public.capacity_sync_jobs();
  select id into job from public.website_dispatch_jobs where task_id = (select id from public.tasks where dedupe_key = 'website:' || k4);
  perform public.website_dispatch_plan(job, null, null, null, null, 'QA');
  assert (select status from public.capacity_reservations where ref = 'booking:' || k4) = 'released', 'unplanned first';
  j := public.website_dispatch_contact(job, 'confirmed', tomorrow, 'evening', 'QA');
  assert j->>'error' = 'slot_full', 'phone confirm into the full evening refused: ' || j::text;
  j := public.website_dispatch_contact(job, 'confirmed', tomorrow, 'afternoon', 'QA');
  assert (j->>'ok')::boolean, 'phone confirm: ' || j::text;
  assert (select status = 'held' and window_id = 'afternoon' and not over_capacity from public.capacity_reservations where ref = 'booking:' || k4),
    'phone confirmation takes a place';
  -- A day + window written directly (no capacity function) still takes a place, marked over if full.
  update public.website_dispatch_jobs set slot_date = tomorrow, slot = 'evening' where id = job;
  assert (select status = 'held' and window_id = 'evening' and over_capacity from public.capacity_reservations where ref = 'booking:' || k4),
    'direct write takes a place (over capacity in the full evening)';

  -- The board shows the slot and its reservations.
  a := public.capacity_board(tomorrow);
  assert exists (select 1 from jsonb_array_elements(a->'slots') s where s->>'kind' = 'pickup' and s->>'zone' = 's9-12' and s->>'window' = 'evening'
                 and (s->>'capacity')::int = 2 and jsonb_array_length(s->'reservations') >= 1), 'board slot';

  raise exception 'ALL_CAPACITY_TESTS_PASSED (rolled back)';
end;
$$;
