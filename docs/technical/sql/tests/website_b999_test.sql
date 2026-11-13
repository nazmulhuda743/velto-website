-- Synthetic test for docs/technical/sql/website_b999.sql. STAGING ONLY. Rolls back.
-- Expected: an error reading "ALL_TESTS_PASSED (rolled back)".
-- The concurrent last-place test runs separately (two connections at once), see B999.md.
do $$
declare
  r text := lpad((floor(random() * 1000000))::int::text, 6, '0');
  d date := current_date + 3;
  days date[] := array[current_date + 1, current_date + 2, current_date + 3];
  j jsonb; t text; n int; bid uuid; i int;
  p jsonb;
begin
  -- Four bookings fill the day (cap 4); each from its own phone (website_create_request rate-limits per phone).
  for i in 1..4 loop
    p := jsonb_build_object('name', 'Zz B999 ' || i, 'phone', '+88 017' || r || '1' || i, 'sector', 7, 'address', 'House ' || i || ', Road 9',
      'pickupDate', d::text, 'price', 1, 'quantity', 99, 'service', 'ironing', 'coupon', 'FREE',
      'attribution', jsonb_build_object('utm_source', 'facebook', 'utm_medium', 'paid', 'utm_campaign', 'b999', 'utm_content', 'v1', 'utm_term', 'blanket', 'fbclid', 'abc', 'consent', 'analytics+marketing'));
    j := website_b999_book('zzb999-' || r || '-key-' || i, p, 4, days);
    assert (j ->> 'ok')::boolean and not (j ->> 'duplicate')::boolean and j ->> 'reference' ~ '^WEB-[A-Z0-9]{8}$', format('book %s: %s', i, j);
  end loop;

  -- Fixed values regardless of what the browser sent.
  select count(*) into n from website_b999_bookings
   where name like 'Zz B999 %' and pickup_date = d and offer_code = 'B999-WEB' and package = 'B999' and quantity = 3
     and package_price = 999 and service = 'Blanket Cleaning' and item_type = 'Regular Blanket' and currency = 'BDT'
     and acquisition_source = 'WEBSITE' and campaign_family = 'BLANKET' and payment_method = 'Pay at delivery'
     and phone ~ '^017' and sector = 7 and utm_source = 'facebook' and utm_campaign = 'b999' and utm_term = 'blanket';
  assert n = 4, format('saved fields: %s', n);

  -- The Ops task: blanket service, the fixed offer line, no 10% or coupon line.
  select t2.description into t from tasks t2 join website_b999_bookings b on b.task_id = t2.id where b.dedupe_key = 'zzb999-' || r || '-key-1';
  assert t like '%Service: Blanket & Comforter Cleaning%' and t like '%Offer: B999-WEB · 3 Regular/Medium blankets · ৳999 fixed%'
     and t like '%Do NOT apply the first-order 10% or any coupon.%' and t not like '%First website order: apply%' and t not like '%FREE%', format('task %s', t);
  assert (select type = 'pickup' and source = 'website_booking' from tasks t2 join website_b999_bookings b on b.task_id = t2.id where b.dedupe_key = 'zzb999-' || r || '-key-1'), 'normal website pickup task';
  assert (select l.utm_campaign = 'b999' and l.service = 'blanket-comforter-cleaning' from website_leads l join website_b999_bookings b on b.task_id = l.task_id where b.dedupe_key = 'zzb999-' || r || '-key-1'), 'lead keeps utm';

  -- The 5th booking for that day is refused; the next day is open.
  p := jsonb_build_object('name', 'Zz B999 5', 'phone', '017' || r || '15', 'sector', 7, 'address', 'House 5, Road 9', 'pickupDate', d::text);
  assert website_b999_book('zzb999-' || r || '-key-5', p, 4, days) ->> 'error' = 'day_full', 'cap';
  assert (website_b999_days(days) ->> d::text)::int = 4 and (website_b999_days(days) ->> (current_date + 1)::text)::int >= 0, 'days count';
  p := p || jsonb_build_object('pickupDate', (current_date + 2)::text);
  assert (website_b999_book('zzb999-' || r || '-key-5', p, 4, days) ->> 'ok')::boolean, 'another day';

  -- Same key again (reload / double submit): the same booking, no second row or task.
  j := website_b999_book('zzb999-' || r || '-key-1', jsonb_build_object('name', 'X'), 4, days);
  assert (j ->> 'duplicate')::boolean and (select count(*) from website_b999_bookings where dedupe_key = 'zzb999-' || r || '-key-1') = 1, 'dedupe';

  -- Outside Uttara, bad phone, a day not offered: nothing saved.
  select count(*) into n from website_b999_bookings;
  assert website_b999_book('zzb999-' || r || '-key-6', p || jsonb_build_object('sector', 0), 4, days) ->> 'error' = 'outside_area', 'outside';
  assert website_b999_book('zzb999-' || r || '-key-6', p || jsonb_build_object('sector', 'outside'), 4, days) ->> 'error' in ('invalid', 'outside_area'), 'outside text';
  assert website_b999_book('zzb999-' || r || '-key-6', p || jsonb_build_object('phone', '12345'), 4, days) ->> 'field' = 'phone', 'phone';
  assert website_b999_book('zzb999-' || r || '-key-6', p || jsonb_build_object('pickupDate', (current_date + 30)::text), 4, days) ->> 'field' = 'date', 'date';
  assert (select count(*) from website_b999_bookings) = n, 'nothing saved';

  -- The table itself refuses anything but the package.
  begin
    insert into website_b999_bookings (dedupe_key, reference, name, phone, sector, address, pickup_date, package_price)
    values ('zzb999-' || r || '-bad-price', 'WEB-X', 'Zz', '01712345678', 7, 'House 1, Road 1', d, 899);
    assert false, '899 accepted';
  exception when check_violation then null;
  end;
  begin
    insert into website_b999_bookings (dedupe_key, reference, name, phone, sector, address, pickup_date, quantity)
    values ('zzb999-' || r || '-bad-qty', 'WEB-X', 'Zz', '01712345678', 7, 'House 1, Road 1', d, 4);
    assert false, 'qty 4 accepted';
  exception when check_violation then null;
  end;
  begin
    insert into website_b999_bookings (dedupe_key, reference, name, phone, sector, address, pickup_date, offer_code)
    values ('zzb999-' || r || '-bad-code', 'WEB-X', 'Zz', '01712345678', 7, 'House 1, Road 1', d, 'OTHER');
    assert false, 'other code accepted';
  exception when check_violation then null;
  end;

  -- Price confirmation: the total stays until the answer is recorded.
  select id into bid from website_b999_bookings where dedupe_key = 'zzb999-' || r || '-key-1';
  assert website_b999_decide(bid, 'approved', 'phone', 0, null, 'Staff') ->> 'error' = 'not_flagged', 'decide needs a flag';
  assert (website_b999_flag(bid, 2, 1, 0, 0, 1049, 'One looks heavy', 'Staff A') ->> 'ok')::boolean, 'flag';
  assert (select price_status = 'confirmation_required' and approved_total is null and proposed_total = 1049 from website_b999_bookings where id = bid), 'flagged, not approved';
  assert website_b999_flag(bid, 3, 1, 0, 0, 1049, null, 'Staff A') ->> 'error' = 'invalid', 'more than 3 in the pack';
  assert (website_b999_decide(bid, 'declined', 'whatsapp', 1, 800, 'Staff B') ->> 'ok')::boolean, 'declined';
  assert (select price_status = 'declined' and approved_total = 800 and declined_heavy = 1 and decided_by = 'Staff B' and decided_at is not null from website_b999_bookings where id = bid), 'decision recorded';
  assert website_b999_flag(bid, 3, 0, 0, 0, 999, null, 'Staff A') ->> 'error' = 'decided', 'no re-flag after decision';
  assert exists (select 1 from jsonb_array_elements(website_b999_list(30)) e where (e ->> 'id')::uuid = bid and (e ->> 'approvedTotal')::int = 800), 'list';

  -- Cancel frees the place.
  select id into bid from website_b999_bookings where dedupe_key = 'zzb999-' || r || '-key-2';
  assert (website_b999_cancel(bid, 'Staff') ->> 'ok')::boolean, 'cancel';
  assert (website_b999_days(days) ->> d::text)::int = 3, 'cancel frees the place';

  -- Grants.
  assert not has_function_privilege('anon', 'website_b999_book(text,jsonb,integer,date[])', 'execute'), 'anon book';
  assert not has_function_privilege('authenticated', 'website_b999_list(integer)', 'execute'), 'auth list';
  assert has_function_privilege('service_role', 'website_b999_book(text,jsonb,integer,date[])', 'execute'), 'svc book';
  assert not has_table_privilege('service_role', 'website_b999_bookings', 'select') and not has_table_privilege('anon', 'website_b999_bookings', 'select'), 'table closed';

  raise exception 'ALL_TESTS_PASSED (rolled back)';
end $$;
