-- Synthetic test for docs/technical/sql/website_rhythm.sql. STAGING ONLY.
-- Fake customers with made-up order histories; every rule checked; then a raise rolls
-- everything back. Expected: an error reading "ALL_TESTS_PASSED (rolled back)".
do $$
declare
  today date := (now() at time zone 'Asia/Dhaka')::date;
  r text := lpad((floor(random() * 1000000))::int::text, 6, '0');
  c_due uuid; c_track uuid; c_slip uuid; c_open uuid; c_one uuid; c_opt uuid;
  v_code text; v_code2 text; j jsonb; task uuid; i int;
begin
  insert into customers (name, phone, address, zone, status) values ('Md. Zz Due', '017' || r || '01', 'House 1, Road 2, Sector 7', 'Uttara', 'Active') returning id into c_due;
  insert into customers (name, phone, zone, status) values ('Zz Track', '017' || r || '02', 'Uttara', 'Active') returning id into c_track;
  insert into customers (name, phone, zone, status) values ('Zz Slip', '017' || r || '03', 'Uttara', 'Active') returning id into c_slip;
  insert into customers (name, phone, zone, status) values ('Zz Open', '017' || r || '04', 'Uttara', 'Active') returning id into c_open;
  insert into customers (name, phone, zone, status) values ('Zz One', '017' || r || '05', 'Uttara', 'Active') returning id into c_one;
  insert into customers (name, phone, zone, status) values ('Zz Opt', '017' || r || '06', 'Uttara', 'Active') returning id into c_opt;

  -- Every 10 days, last 10 days ago: due. Same rhythm, last 4 days ago: on track. Last 40 days ago: slipping.
  for i in 0..4 loop
    insert into orders (customer_id, order_number, order_date, order_status, service_category, total_amount) values
      (c_due,   'ZZR-D' || r || i, today - 10 - i * 10, 'Delivered', array['Ironing'], 250),
      (c_track, 'ZZR-T' || r || i, today - 4 - i * 10,  'Delivered', array['Ironing'], 250),
      (c_slip,  'ZZR-S' || r || i, today - 40 - i * 10, 'Delivered', array['Wash + Iron'], 600),
      (c_open,  'ZZR-O' || r || i, today - 10 - i * 10, case when i = 0 then 'Picked' else 'Delivered' end, array['Ironing'], 250),
      (c_opt,   'ZZR-P' || r || i, today - 10 - i * 10, 'Delivered', array['Ironing'], 250);
  end loop;
  insert into orders (customer_id, order_number, order_date, order_status, service_category, total_amount)
  values (c_one, 'ZZR-1' || r, today - 20, 'Delivered', array['Dry Cleaning'], 900);

  perform website_rhythm_refresh();
  assert (select segment from website_rhythm where customer_id = c_due) = 'regular_due', 'due segment';
  assert (select segment from website_rhythm where customer_id = c_track) = 'regular_on_track', 'on-track segment';
  assert (select segment from website_rhythm where customer_id = c_slip) = 'slipping', 'slipping segment';
  assert (select segment from website_rhythm where customer_id = c_one) = 'onetimer_warm', 'one-timer segment';
  assert (select open_order from website_rhythm where customer_id = c_open), 'open order seen';
  assert (select cadence_days = 10 and usual_service = 'Ironing' and first_name = 'Zz' from website_rhythm where customer_id = c_due), 'cadence, service, first name';

  -- Candidates: due yes; on track, open order, opted out no.
  insert into website_rhythm_optouts (phone) values ('017' || r || '06');
  assert exists (select 1 from website_rhythm_candidates('regular_due', 200) where customer_id = c_due), 'due is a candidate';
  assert not exists (select 1 from website_rhythm_candidates('regular_due', 200) where customer_id in (c_track, c_open, c_opt)), 'track/open/opt-out excluded';
  assert exists (select 1 from website_rhythm_candidates('slipping', 200) where customer_id = c_slip), 'slipping is a candidate';

  -- SMS decided and sent; the customer is then out of every queue for 7 days.
  v_code := website_rhythm_record(c_due, 'regular_due', 'sms', 'bn');
  assert v_code ~ '^[A-Za-z0-9_-]{8}$', format('code shape %s', v_code);
  perform website_rhythm_mark(v_code, true);
  assert (select status from website_rhythm_touches where code = v_code) = 'sent', 'marked sent';
  assert not exists (select 1 from website_rhythm_candidates('regular_due', 200) where customer_id = c_due), 'not twice';

  -- The link: first name and service only; first click recorded.
  j := website_rhythm_link(v_code);
  assert j ->> 'state' = 'open' and j ->> 'firstName' = 'Zz' and j ->> 'service' = 'Ironing' and not (j ? 'address') and not (j ? 'phone'), format('link %s', j);
  assert (select clicked_at is not null from website_rhythm_touches where code = v_code), 'click recorded';
  assert website_rhythm_link('nope') ->> 'ok' = 'false', 'bad code';
  -- The server gets the address to book; once booked, the link can't book again.
  j := website_rhythm_booking_data(v_code);
  assert (j ->> 'ok')::boolean and j ->> 'address' like 'House 1%' and j ->> 'phone' = '017' || r || '01', format('booking data %s', j);
  assert website_rhythm_booked(v_code, 'VEL-TEST');
  assert website_rhythm_link(v_code) ->> 'state' = 'booked', 'booked state';
  assert not (website_rhythm_booking_data(v_code) ->> 'ok')::boolean, 'books once';
  -- Expired links don't book.
  v_code2 := website_rhythm_record(c_track, 'regular_due', 'sms', 'en');
  update website_rhythm_touches set expires_at = now() - interval '1 minute' where code = v_code2;
  assert website_rhythm_link(v_code2) ->> 'state' = 'expired', 'expired';
  assert not (website_rhythm_booking_data(v_code2) ->> 'ok')::boolean, 'expired does not book';
  -- Stop reminders from the link.
  assert website_rhythm_optout(v_code2);
  assert exists (select 1 from website_rhythm_optouts where phone = '017' || r || '02'), 'opted out';

  -- Staff task for the slipping regular, once per cycle.
  task := website_rhythm_staff_task(c_slip);
  assert task is not null, 'task made';
  assert (select type = 'call' and source = 'website_rhythm' and description like '%every 10 days%' and description like '%40 days since%' from tasks where id = task), 'task text';
  assert website_rhythm_staff_task(c_slip) is null, 'task not duplicated';
  assert not exists (select 1 from website_rhythm_candidates('slipping', 200) where customer_id = c_slip), 'slipping not twice';

  -- Hold-out rows count against caps too.
  perform website_rhythm_record(c_one, 'regular_due', 'holdout');
  assert (select status from website_rhythm_touches where customer_id = c_one) = 'holdout', 'holdout row';

  -- Results.
  j := website_rhythm_stats(30);
  assert (j -> 'playbooks' -> 'regular_due' ->> 'bookedByLink')::int >= 1, format('stats %s', j);
  assert (j -> 'playbooks' -> 'slipping' ->> 'contacted')::int >= 1, 'stats slipping';

  -- Keys and roles.
  assert not website_rhythm_check_key('x'), 'short key refused';
  assert website_rhythm_check_key((select run_key from website_rhythm_keys)), 'right key accepted';
  execute 'set local role authenticated';
  begin perform website_rhythm_candidates('regular_due', 5); raise exception 'customers can read the queue'; exception when insufficient_privilege then null; end;
  begin perform website_rhythm_link(v_code); raise exception 'customers can read links'; exception when insufficient_privilege then null; end;
  begin perform 1 from website_rhythm_touches; raise exception 'touches readable'; exception when insufficient_privilege then null; end;
  execute 'reset role';
  execute 'set local role anon';
  begin perform website_rhythm_check_key('x'); raise exception 'anon key check'; exception when insufficient_privilege then null; end;
  execute 'reset role';
  execute 'set local role service_role';
  begin perform 1 from website_rhythm_keys; raise exception 'service role reads the key table directly'; exception when insufficient_privilege then null; end;
  perform website_rhythm_stats(30);
  execute 'reset role';

  raise exception 'ALL_TESTS_PASSED (rolled back)';
end $$;
