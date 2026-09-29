-- Synthetic test for docs/technical/sql/website_request_outcomes.sql. STAGING ONLY.
-- Expected: an error reading "ALL OUTCOME TESTS PASSED (rolled back)". Nothing is kept.
-- Uses the newest Ops order that has a customer; creates two website booking tasks and leads.
do $$
declare
  v_order text; v_customer uuid; v_order_at timestamptz; v_status text; v_phone text;
  t1 uuid; t2 uuid; l1 uuid; l2 uuid; j1 uuid; r jsonb; o record;
  v_today date := (now() at time zone 'Asia/Dhaka')::date;
begin
  select order_number, customer_id, created_at, order_status, phone_snapshot into v_order, v_customer, v_order_at, v_status, v_phone
    from public.orders
   where customer_id is not null and order_status <> 'Cancelled' and order_number ~ '^VELR?-[0-9]{3,6}$'
   order by created_at desc limit 1;
  assert v_order is not null, 'staging needs an order with a customer';

  insert into public.tasks (title, type, priority, status, due_at, description, assigned_by_name, source, source_ref, dedupe_key)
  values ('Website pickup - QA Outcome (01712345697)', 'pickup', 'high', 'open', now() + interval '1 hour',
          E'Pickup request from Velto website.\nName: QA Outcome\nPhone: 01712345697\nArea: Uttara Sector 7\nAddress: House 1, Road 1',
          'Velto website', 'website_booking', '01712345697', 'website:qa-outcome-00000000001')
  returning id into t1;
  insert into public.tasks (title, type, priority, status, due_at, description, assigned_by_name, source, source_ref, dedupe_key)
  values ('Website pickup - QA Outcome 2 (01712345696)', 'pickup', 'high', 'open', now() + interval '1 hour',
          E'Pickup request from Velto website.\nName: QA Outcome 2\nPhone: 01712345696\nArea: Uttara Sector 7\nAddress: House 2, Road 1',
          'Velto website', 'website_booking', '01712345696', 'website:qa-outcome-00000000002')
  returning id into t2;

  insert into public.website_leads (kind, task_id, reference, service, consent, consent_analytics, consent_marketing, device, utm_source, utm_medium)
  values ('booking', t1, 'WEB-QAOUT001', 'dry-cleaning', 'analytics', true, false, 'mobile', 'facebook', 'paid_social') returning id into l1;
  insert into public.website_leads (kind, task_id, reference, service, consent, consent_analytics, consent_marketing, device)
  values ('booking', t2, 'WEB-QAOUT002', 'laundry', 'essential', false, false, 'desktop') returning id into l2;

  execute 'set local role service_role';
  r := public.website_dispatch_sync();
  select id into j1 from public.website_dispatch_jobs where task_id = t1;
  assert j1 is not null, 'sync created the job';

  -- Before pickup: nothing yet.
  select * into o from public.website_request_outcomes(v_today, v_today) where lead_id = l1;
  assert o.lead_id = l1 and not o.picked and o.order_number is null and not o.delivered and not o.ordered_again and not o.cancelled,
    'fresh request: ' || row_to_json(o)::text;
  assert o.returning_customer is null or o.returning_customer = false, 'unknown/new customer';
  assert o.utm_source = 'facebook' and o.device = 'mobile', 'source fields pass through';

  -- Picked with the order: picked, the order shows, delivered follows Ops.
  r := public.website_dispatch_pick(j1, v_order, 'QA');
  assert (r->>'ok')::boolean, 'pick: ' || r::text;
  select * into o from public.website_request_outcomes(v_today, v_today) where lead_id = l1;
  assert o.picked and o.order_number is not null, 'picked with order: ' || row_to_json(o)::text;
  assert o.delivered = (v_status = 'Delivered'), 'delivered follows the order';
  assert o.ordered_again = exists (select 1 from public.orders x where x.customer_id = v_customer and x.created_at > v_order_at and x.order_status <> 'Cancelled'),
    'ordered again follows later orders';

  -- Cancelled request.
  r := public.website_dispatch_close((select id from public.website_dispatch_jobs where task_id = t2), 'cancelled', 'QA test', 'QA');
  select * into o from public.website_request_outcomes(v_today, v_today) where lead_id = l2;
  assert o.cancelled and not o.picked, 'cancelled: ' || row_to_json(o)::text;

  -- Outside the range: not returned.
  assert not exists (select 1 from public.website_request_outcomes(v_today - 10, v_today - 5) where lead_id in (l1, l2)), 'range respected';

  -- Browser roles cannot call it.
  execute 'reset role';
  assert not has_function_privilege('anon', 'public.website_request_outcomes(date, date)', 'execute'), 'anon blocked';
  assert not has_function_privilege('authenticated', 'public.website_request_outcomes(date, date)', 'execute'), 'authenticated blocked';

  raise exception 'ALL OUTCOME TESTS PASSED (rolled back)';
end $$;
