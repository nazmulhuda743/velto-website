-- Revenue attribution V1 — staging test suite.
-- Runs entirely inside one transaction and ROLLS BACK: no test row persists.
-- Synthetic customers use the reserved 0179999xxxx phone range. Never run on production.
begin;

create temp table t_result (n serial, name text, pass boolean, detail text) on commit drop;

do $$
declare
  d date := (now() at time zone 'Asia/Dhaka')::date;
  s1 uuid := '5e551000-0000-4000-8000-000000000001';
  v1 uuid := '71517000-0000-4000-8000-000000000001';
  c_new uuid; c_late uuid; c_out uuid; c_quote uuid; c_staff uuid; c_p6 uuid; c_o6 uuid;
  c_mm uuid; c_ex uuid; c_re uuid; c_cz uuid; c_un uuid; c_pend uuid; c_none uuid;
  o uuid; o_staff text; o6 text; o_valid uuid;
  l record;
  k record;
  r jsonb;
  tot jsonb;
begin
  -- helpers ---------------------------------------------------------------
  create temp table t_ids (key text primary key, id uuid) on commit drop;

  -- customers
  insert into customers (phone, name) values ('01799990001', 'Rahim Uddin') returning id into c_new;
  insert into customers (phone, name) values ('01799990002', 'Late Booker') returning id into c_late;
  insert into customers (phone, name) values ('01799990003', 'Outside Window') returning id into c_out;
  insert into customers (phone, name) values ('01799990004', 'Quote Person') returning id into c_quote;
  insert into customers (phone, name) values ('01799990005', 'Staff Linked') returning id into c_staff;
  insert into customers (phone, name) values ('01799990006', 'Phone Owner') returning id into c_p6;
  insert into customers (phone, name) values ('01799990016', 'Other Customer') returning id into c_o6;
  insert into customers (phone, name) values ('01799990007', 'Karim Hossain') returning id into c_mm;
  insert into customers (phone, name) values ('01799990008', 'Existing Customer') returning id into c_ex;
  insert into customers (phone, name) values ('01799990009', 'Returning Customer') returning id into c_re;
  insert into customers (phone, name) values ('01799990010', 'Cancel Zero') returning id into c_cz;
  insert into customers (phone, name) values ('01799990011', 'Walk In') returning id into c_un;
  insert into customers (phone, name) values ('01799990013', 'Pending Person') returning id into c_pend;
  insert into customers (phone, name) values ('01799990014', 'Consent None') returning id into c_none;

  -- anonymous analytics: first touch 45 days ago (campaign ft_camp), later session s1
  insert into website_analytics_events (occurred_at, visitor_id, session_id, event, path, landing_page, utm_source, utm_medium, utm_campaign, device, consent_marketing)
  values (now() - interval '45 days', v1, '5e551000-0000-4000-8000-0000000000aa', 'page_view', '/services/curtain-cleaning', '/services/curtain-cleaning', 'facebook', 'paid_social', 'ft_camp', 'mobile', true),
         (now() - interval '40 days', v1, s1, 'page_view', '/book', '/book', null, null, null, 'mobile', true);

  -- leads through the real intake function --------------------------------
  r := website_create_request('booking', 'test-booking-new-000001', jsonb_build_object(
        'name', 'Rahim Uddin', 'phone', '+880 1799-990001', 'area', 'Uttara Sector 7', 'address', 'House 1', 'service', 'dry-cleaning',
        'attribution', jsonb_build_object('utm_source', 'facebook', 'utm_medium', 'paid_social', 'utm_campaign', 'curtain_sep26',
          'fbclid', 'IwAR-test', 'analytics_session', s1::text, 'device', 'mobile', 'consent', 'analytics+marketing',
          'referrer', 'l.facebook.com', 'evil_key', 'x', 'landing_page', '/services/curtain-cleaning?phone=017')));
  insert into t_ids values ('L_new', (select id from website_leads where reference = r->>'reference'));

  r := website_create_request('booking', 'test-booking-dup-000001', jsonb_build_object('name', 'Rahim Uddin', 'phone', '01799990001', 'area', 'Uttara Sector 7', 'address', 'x'));
  -- duplicate submission (same dedupe key) must not create a second lead
  perform website_create_request('booking', 'test-booking-dup-000001', jsonb_build_object('name', 'Rahim Uddin', 'phone', '01799990001', 'area', 'Uttara Sector 7', 'address', 'x'));
  insert into t_result (name, pass, detail) select 'duplicate submission creates one lead', count(*) = 1, count(*)::text
    from website_leads wl join tasks t on t.id = wl.task_id where t.dedupe_key = 'website:test-booking-dup-000001';
  delete from website_leads where task_id in (select id from tasks where dedupe_key = 'website:test-booking-dup-000001');

  r := website_create_request('booking', 'test-booking-late-00001', jsonb_build_object('name', 'Late Booker', 'phone', '01799990002', 'area', 'Uttara Sector 3', 'address', 'x',
        'attribution', jsonb_build_object('utm_source', 'facebook', 'utm_medium', 'paid_social', 'utm_campaign', 'curtain_sep26', 'consent', 'essential')));
  insert into t_ids values ('L_late', (select id from website_leads where reference = r->>'reference'));
  r := website_create_request('booking', 'test-booking-out-000001', jsonb_build_object('name', 'Outside Window', 'phone', '01799990003', 'area', 'Uttara Sector 3', 'address', 'x'));
  insert into t_ids values ('L_out', (select id from website_leads where reference = r->>'reference'));
  r := website_create_request('quote', 'test-quote-000000000001', jsonb_build_object('name', 'Quote Person', 'phone', '01799990004', 'area', 'Uttara Sector 18', 'service', 'curtain-cleaning',
        'attribution', jsonb_build_object('utm_source', 'google', 'utm_medium', 'cpc', 'utm_campaign', 'uttara_laundry', 'gclid', 'g-1', 'consent', 'marketing')));
  insert into t_ids values ('L_quote', (select id from website_leads where reference = r->>'reference'));
  r := website_create_request('booking', 'test-booking-staff-0001', jsonb_build_object('name', 'Staff Linked', 'phone', '01799990005', 'area', 'Uttara Sector 3', 'address', 'x'));
  insert into t_ids values ('L_staff', (select id from website_leads where reference = r->>'reference'));
  r := website_create_request('booking', 'test-booking-confl-0001', jsonb_build_object('name', 'Phone Owner', 'phone', '01799990006', 'area', 'Uttara Sector 3', 'address', 'x'));
  insert into t_ids values ('L_conflict', (select id from website_leads where reference = r->>'reference'));
  r := website_create_request('booking', 'test-booking-mism-00001', jsonb_build_object('name', 'Nusrat Jahan', 'phone', '01799990007', 'area', 'Uttara Sector 3', 'address', 'x'));
  insert into t_ids values ('L_mm', (select id from website_leads where reference = r->>'reference'));
  r := website_create_request('booking', 'test-booking-exist-0001', jsonb_build_object('name', 'Existing Customer', 'phone', '01799990008', 'area', 'Uttara Sector 3', 'address', 'x'));
  insert into t_ids values ('L_ex', (select id from website_leads where reference = r->>'reference'));
  r := website_create_request('booking', 'test-booking-react-0001', jsonb_build_object('name', 'Returning Customer', 'phone', '01799990009', 'area', 'Uttara Sector 3', 'address', 'x'));
  insert into t_ids values ('L_re', (select id from website_leads where reference = r->>'reference'));
  r := website_create_request('booking', 'test-booking-cz-0000001', jsonb_build_object('name', 'Cancel Zero', 'phone', '01799990010', 'area', 'Uttara Sector 3', 'address', 'x'));
  insert into t_ids values ('L_cz', (select id from website_leads where reference = r->>'reference'));
  r := website_create_request('booking', 'test-booking-pend-00001', jsonb_build_object('name', 'Pending Person', 'phone', '01799990013', 'area', 'Uttara Sector 3', 'address', 'x'));
  insert into t_ids values ('L_pend', (select id from website_leads where reference = r->>'reference'));
  r := website_create_request('booking', 'test-booking-none-00001', jsonb_build_object('name', 'Consent None', 'phone', '01799990014', 'area', 'Outside Uttara Sectors 1–18', 'address', 'x',
        'attribution', jsonb_build_object('utm_campaign', 'curtain_sep26', 'fbclid', 'IwAR-should-drop', 'analytics_session', s1::text, 'consent', 'essential')));
  insert into t_ids values ('L_none', (select id from website_leads where reference = r->>'reference'));
  r := website_create_request('booking', 'test-booking-nomatch-01', jsonb_build_object('name', 'Nobody', 'phone', '01799990099', 'area', 'Uttara Sector 3', 'address', 'x'));
  insert into t_ids values ('L_nomatch', (select id from website_leads where reference = r->>'reference'));

  -- backdate leads (test-only) ---------------------------------------------
  update website_leads set created_at = now() - interval '40 days' where id in (select id from t_ids where key in ('L_new', 'L_out', 'L_staff'));
  update website_leads set created_at = now() - interval '30 days' where id in (select id from t_ids where key in ('L_late', 'L_quote', 'L_conflict'));
  update website_leads set created_at = now() - interval '20 days' where id in (select id from t_ids where key in ('L_mm', 'L_ex', 'L_re', 'L_cz', 'L_none', 'L_nomatch'));
  update website_leads set created_at = now() - interval '2 days' where id = (select id from t_ids where key = 'L_pend');

  -- orders --------------------------------------------------------------
  insert into orders (customer_id, phone_snapshot, service_category, order_date, total_amount, order_status, created_at)
  values (c_new, '01799990001', array['Dry Cleaning'], d - 37, 1000, 'Delivered', now() - interval '37 days') returning id into o;
  insert into payments (order_id, amount, paid_at) values (o, 1000, d - 37);
  insert into orders (customer_id, phone_snapshot, service_category, order_date, total_amount, order_status, created_at)
  values (c_new, '01799990001', array['Dry Cleaning'], d - 20, 500, 'Delivered', now() - interval '20 days') returning id into o;
  insert into payments (order_id, amount, paid_at) values (o, 300, d - 20);

  insert into orders (customer_id, service_category, order_date, total_amount, order_status) values (c_late, array['Ironing'], d - 20, 400, 'Delivered');   -- lead day 10
  insert into orders (customer_id, service_category, order_date, total_amount, order_status) values (c_out, array['Ironing'], d - 20, 400, 'Delivered');    -- lead day 20
  insert into orders (customer_id, service_category, order_date, total_amount, order_status) values (c_quote, array['Wash + Iron'], d - 18, 2500, 'Delivered'); -- quote day 12
  insert into orders (customer_id, service_category, order_date, total_amount, order_status) values (c_staff, array['Ironing'], d - 10, 700, 'Delivered') returning order_number into o_staff; -- day 30
  insert into orders (customer_id, service_category, order_date, total_amount, order_status) values (c_o6, array['Ironing'], d - 28, 350, 'Delivered') returning order_number into o6;
  insert into orders (customer_id, service_category, order_date, total_amount, order_status) values (c_mm, array['Ironing'], d - 19, 600, 'Delivered');
  insert into orders (customer_id, service_category, order_date, total_amount, order_status) values (c_ex, array['Ironing'], d - 60, 300, 'Delivered');
  insert into orders (customer_id, service_category, order_date, total_amount, order_status) values (c_ex, array['Ironing'], d - 18, 300, 'Delivered');
  insert into orders (customer_id, service_category, order_date, total_amount, order_status) values (c_re, array['Ironing'], d - 200, 300, 'Delivered');
  insert into orders (customer_id, service_category, order_date, total_amount, order_status) values (c_re, array['Ironing'], d - 19, 900, 'Delivered');
  insert into orders (customer_id, service_category, order_date, total_amount, order_status) values (c_cz, array['Ironing'], d - 19, 800, 'Cancelled');
  insert into orders (customer_id, service_category, order_date, total_amount, order_status) values (c_cz, array['Ironing'], d - 18, 0, 'Delivered');
  insert into orders (customer_id, service_category, order_date, total_amount, order_status) values (c_cz, array['Ironing'], d - 17, 450, 'Delivered') returning id into o_valid;
  insert into orders (customer_id, service_category, order_date, total_amount, order_status) values (c_un, array['Ironing'], d - 15, 1200, 'Delivered');  -- no lead

  -- staff links
  update tasks set order_number = o_staff where id = (select task_id from website_leads where id = (select id from t_ids where key = 'L_staff'));
  update tasks set order_number = o6 where id = (select task_id from website_leads where id = (select id from t_ids where key = 'L_conflict'));

  -- run matching --------------------------------------------------------
  r := website_match_leads();
  insert into t_result (name, pass, detail) values ('matching run', (r->>'linked')::int >= 10, r::text);

  -- lead capture assertions -----------------------------------------------
  select * into l from website_leads where id = (select id from t_ids where key = 'L_new');
  insert into t_result (name, pass, detail) values
    ('lead snapshot: last-touch campaign', l.utm_campaign = 'curtain_sep26' and l.utm_source = 'facebook', l.utm_campaign),
    ('lead: analytics session kept with analytics consent', l.analytics_session_id = s1, coalesce(l.analytics_session_id::text, 'null')),
    ('lead: first touch from earliest visitor session', l.ft_utm_campaign = 'ft_camp', coalesce(l.ft_utm_campaign, 'null')),
    ('lead: click id kept as presence with marketing consent', l.click_id = 'fbclid', coalesce(l.click_id, 'null')),
    ('lead: landing page query stripped', l.landing_page = '/services/curtain-cleaning', l.landing_page),
    ('lead: sector + device + referrer', l.area_sector = 7 and l.device = 'mobile' and l.referrer_host = 'l.facebook.com', l.area_sector || '/' || l.device);
  insert into t_result (name, pass, detail) select 'task text: no click id values, no session id, unknown keys dropped',
    position('IwAR' in t.description) = 0 and position(s1::text in t.description) = 0 and position('evil' in t.description) = 0
      and t.description like '%click_id=fbclid%' and t.description like '%utm_campaign=curtain_sep26%', t.description
    from website_leads wl join tasks t on t.id = wl.task_id where wl.id = (select id from t_ids where key = 'L_new');

  select * into l from website_leads where id = (select id from t_ids where key = 'L_none');
  insert into t_result (name, pass, detail) values
    ('no analytics consent: session dropped', l.analytics_session_id is null and l.ft_at is null, coalesce(l.analytics_session_id::text, 'null')),
    ('no marketing consent: click id dropped', l.click_id is null, coalesce(l.click_id, 'null')),
    ('outside area stored as sector 0', l.area_sector = 0, coalesce(l.area_sector::text, 'null'));
  insert into t_result (name, pass, detail) select 'no marketing consent: click id absent from task', position('IwAR' in t.description) = 0 and position('click_id' in t.description) = 0, t.description
    from website_leads wl join tasks t on t.id = wl.task_id where wl.id = (select id from t_ids where key = 'L_none');
  select * into l from website_leads where id = (select id from t_ids where key = 'L_quote');
  insert into t_result (name, pass, detail) values ('marketing-only consent: gclid presence kept, no session', l.click_id = 'gclid' and l.analytics_session_id is null, coalesce(l.click_id, 'null'));
  insert into t_result (name, pass, detail) select 'lead holds no phone/name/address columns', count(*) = 0, string_agg(column_name, ',')
    from information_schema.columns where table_name = 'website_leads' and column_name in ('phone', 'name', 'address', 'notes', 'email');

  -- links ------------------------------------------------------------------
  select * into k from website_lead_customer_links where lead_id = (select id from t_ids where key = 'L_new') and status = 'active';
  insert into t_result (name, pass, detail) values ('exact phone + 7-day booking → primary', k.link_method = 'exact_phone' and k.window_kind = 'primary' and k.customer_id = c_new, k.link_method || '/' || k.window_kind);
  select * into k from website_lead_customer_links where lead_id = (select id from t_ids where key = 'L_late') and status = 'active';
  insert into t_result (name, pass, detail) values ('booking order on day 10 → late (not primary)', k.window_kind = 'late', k.window_kind);
  select * into k from website_lead_customer_links where lead_id = (select id from t_ids where key = 'L_out') and status = 'active';
  insert into t_result (name, pass, detail) values ('order after 14 days → identified, no conversion', k.window_kind = 'none' and k.order_id is null, k.window_kind);
  select * into k from website_lead_customer_links where lead_id = (select id from t_ids where key = 'L_quote') and status = 'active';
  insert into t_result (name, pass, detail) values ('quote order on day 12 → primary (14-day window)', k.window_kind = 'primary', k.window_kind);
  select * into k from website_lead_customer_links where lead_id = (select id from t_ids where key = 'L_staff') and status = 'active';
  insert into t_result (name, pass, detail) values ('staff link wins, outside time window', k.link_method = 'staff_order_link' and k.window_kind = 'explicit' and k.conflict is null, k.link_method || '/' || k.window_kind);
  select * into k from website_lead_customer_links where lead_id = (select id from t_ids where key = 'L_conflict') and status = 'active';
  insert into t_result (name, pass, detail) values ('staff link to other customer → linked with visible conflict', k.link_method = 'staff_order_link' and k.customer_id = c_o6 and k.conflict = 'staff_link_other_customer', coalesce(k.conflict, 'null'));
  select * into k from website_lead_customer_links where lead_id = (select id from t_ids where key = 'L_mm') and status = 'active';
  insert into t_result (name, pass, detail) values ('name mismatch flagged but link active', k.name_mismatch and k.status = 'active' and k.window_kind = 'primary', k.name_mismatch::text);
  select * into k from website_lead_customer_links where lead_id = (select id from t_ids where key = 'L_cz') and status = 'active';
  insert into t_result (name, pass, detail) values ('cancelled + zero-value orders skipped', k.order_id = o_valid, coalesce(k.order_id::text, 'null'));
  select * into k from website_lead_customer_links where lead_id = (select id from t_ids where key = 'L_pend') and status = 'active';
  insert into t_result (name, pass, detail) values ('open window, no order yet → pending', k.window_kind = 'pending', coalesce(k.window_kind, 'null'));
  insert into t_result (name, pass, detail) select 'unknown phone → no link', count(*) = 0, count(*)::text
    from website_lead_customer_links where lead_id = (select id from t_ids where key = 'L_nomatch');
  insert into t_result (name, pass, detail) select 'no fuzzy phone: 01799990099 does not link to 01799990009', not exists (
    select 1 from website_lead_customer_links where lead_id = (select id from t_ids where key = 'L_nomatch')), 'ok';

  r := website_match_leads();
  insert into t_result (name, pass, detail) values ('matching is idempotent', (r->>'linked')::int = 0 and (r->>'updated')::int = 0, r::text);

  -- classification + revenue ---------------------------------------------------
  select * into k from website_attribution_conversions(d - 90, d) where lead_id = (select id from t_ids where key = 'L_new');
  insert into t_result (name, pass, detail) values
    ('new customer → acquired', k.classification = 'acquired', k.classification),
    ('first-order billed / collected', k.first_billed = 1000 and k.first_collected = 1000, k.first_billed || '/' || k.first_collected),
    ('30-day matured revenue includes repeat', k.matured_30 and k.billed_30 = 1500 and k.collected_30 = 1300, k.billed_30 || '/' || k.collected_30),
    ('60/90-day not matured → NULL, not 0', not k.matured_60 and k.billed_60 is null and k.billed_90 is null, coalesce(k.billed_60::text, 'null')),
    ('lifetime + repeat + days to second', k.billed_life = 1500 and k.order_count = 2 and k.repeat_customer and k.days_to_second = 17 and k.repeat_30, k.days_to_second::text);
  select * into k from website_attribution_conversions(d - 90, d) where lead_id = (select id from t_ids where key = 'L_ex');
  insert into t_result (name, pass, detail) values ('order within prior 90 days → existing', k.classification = 'existing', coalesce(k.classification, 'null'));
  select * into k from website_attribution_conversions(d - 90, d) where lead_id = (select id from t_ids where key = 'L_re');
  insert into t_result (name, pass, detail) values ('prior order > 90 days → reactivated', k.classification = 'reactivated', coalesce(k.classification, 'null'));
  select * into k from website_attribution_conversions(d - 90, d) where lead_id = (select id from t_ids where key = 'L_staff');
  insert into t_result (name, pass, detail) values ('staff-linked conversion reported (explicit)', k.window_kind = 'explicit' and k.first_billed = 700 and not k.matured_30, coalesce(k.window_kind, 'null'));

  -- coverage reconciliation ----------------------------------------------------
  tot := website_attribution_totals(d - 90, d);
  insert into t_result (name, pass, detail) values
    ('coverage reconciles: orders', (tot->>'orders')::int = (tot->>'conversion_orders')::int + (tot->>'late_orders')::int + (tot->>'follow_on_orders')::int + (tot->>'unattributed_orders')::int, tot::text),
    ('coverage reconciles: billed', (tot->>'billed')::numeric = (tot->>'conversion_billed')::numeric + (tot->>'late_billed')::numeric + (tot->>'follow_on_billed')::numeric + (tot->>'unattributed_billed')::numeric, tot->>'billed'),
    ('follow-on order counted as attributed', (tot->>'follow_on_orders')::int >= 1, tot->>'follow_on_orders'),
    ('unattributed walk-in order stays unattributed', (tot->>'unattributed_billed')::numeric >= 1200, tot->>'unattributed_billed'),
    ('late conversion kept out of primary', (tot->>'late_orders')::int >= 1, tot->>'late_orders');

  -- review queue + actions -----------------------------------------------------
  insert into t_result (name, pass, detail) select 'review queue: conflict + name mismatch present, normal matches absent',
    bool_or(issue = 'staff_link_other_customer') and bool_or(issue = 'name_mismatch')
      and not bool_or(lead_id = (select id from t_ids where key = 'L_new')), string_agg(issue, ',')
    from website_attribution_review();
  select id into o from website_lead_customer_links where lead_id = (select id from t_ids where key = 'L_mm') and status = 'active';
  r := website_review_link(o, 'reject', 'Test Admin', 'wrong person');
  perform website_match_leads();
  insert into t_result (name, pass, detail) select 'rejected link is not recreated by matching', count(*) = 0, count(*)::text
    from website_lead_customer_links where lead_id = (select id from t_ids where key = 'L_mm') and status in ('active', 'confirmed');
  insert into t_result (name, pass, detail) select 'audit trail records reject', count(*) = 1, count(*)::text
    from website_attribution_audit where link_id = o and action = 'reject' and actor = 'Test Admin';

  -- spend dedupe --------------------------------------------------------------
  insert into website_marketing_spend (spend_date, platform, medium, campaign_name, spend, spend_bdt, created_by)
  values (d - 40, 'facebook', 'paid_social', 'curtain_sep26', 2000, 2000, 'test');
  begin
    insert into website_marketing_spend (spend_date, platform, medium, campaign_name, spend, spend_bdt, created_by)
    values (d - 40, 'facebook', 'paid_social', 'Curtain_Sep26', 2000, 2000, 'test');
    insert into t_result (name, pass, detail) values ('duplicate spend row rejected', false, 'inserted twice');
  exception when unique_violation then
    insert into t_result (name, pass, detail) values ('duplicate spend row rejected', true, 'unique_violation');
  end;
  begin
    insert into website_marketing_spend (spend_date, platform, campaign_name, spend, currency, spend_bdt, created_by)
    values (d - 40, 'google', 'x', 10, 'BDT', 12, 'test');
    insert into t_result (name, pass, detail) values ('BDT spend must equal spend_bdt', false, 'accepted');
  exception when check_violation then
    insert into t_result (name, pass, detail) values ('BDT spend must equal spend_bdt', true, 'check_violation');
  end;
end;
$$;

select name, pass, detail from t_result order by n;
rollback;
