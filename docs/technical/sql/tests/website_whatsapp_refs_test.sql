-- Staging test for website_whatsapp_refs.sql. One DO block, synthetic data in the reserved
-- 0179999xxxx range; it always ends by raising, so every change is rolled back.
-- Pass: the error message starts with "WHATSAPP_REFS_TESTS_PASSED".
do $$
declare
  v jsonb;
  r1 text; r2 text; r3 text;
  v_cust uuid; v_order uuid;
  v_count integer;
  v_lead public.website_leads%rowtype;
  passed integer := 0;
begin
  -- 1. No consent: campaign kept, click ids dropped, nothing in the click-id store.
  v := public.website_create_whatsapp_lead(jsonb_build_object(
    'utm_source', 'facebook', 'utm_medium', 'paid_social', 'utm_campaign', 'test-wa',
    'fbclid', 'IwAR_test_1', 'gclid', 'g_test', 'consent', 'none', 'device', 'mobile',
    'landing_page', '/services/curtain-cleaning?x=1', 'service', 'curtain-cleaning', 'area_sector', '11'));
  assert v->>'ok' = 'true', 'create (none) ok';
  r1 := v->>'reference';
  assert r1 ~ '^W[2-9A-HJ-NP-Z]{5}$', 'reference shape: ' || coalesce(r1, 'null');
  select * into v_lead from public.website_leads where reference = r1;
  assert v_lead.kind = 'whatsapp' and v_lead.task_id is null, 'kind/task';
  assert v_lead.utm_campaign = 'test-wa' and v_lead.click_id is null, 'campaign kept, click id dropped';
  assert v_lead.landing_page = '/services/curtain-cleaning', 'landing query stripped';
  assert v_lead.service = 'curtain-cleaning' and v_lead.area_sector = 11, 'service + sector';
  assert not exists (select 1 from public.website_lead_click_ids where lead_id = v_lead.id), 'no click ids without consent';
  passed := passed + 1;

  -- 2. Marketing consent: raw ids kept in the short-retention store only.
  v := public.website_create_whatsapp_lead(jsonb_build_object(
    'utm_source', 'facebook', 'utm_campaign', 'test-wa', 'fbclid', 'IwAR_test_2',
    'fbp', 'fb.1.1700000000000.123', 'consent', 'analytics+marketing', 'analytics_session', 'not-a-uuid'));
  r2 := v->>'reference';
  select * into v_lead from public.website_leads where reference = r2;
  assert v_lead.click_id = 'fbclid' and v_lead.consent_marketing, 'presence only in lead';
  assert v_lead.analytics_session_id is null, 'invalid session dropped';
  select count(*) into v_count from public.website_lead_click_ids
   where lead_id = v_lead.id and fbclid = 'IwAR_test_2' and fbp = 'fb.1.1700000000000.123'
     and expires_at between now() + interval '89 days' and now() + interval '91 days';
  assert v_count = 1, 'click ids stored for 90 days';
  passed := passed + 1;

  -- 3. website_store_click_ids respects the lead's own consent, not the caller's.
  assert public.website_store_click_ids(r1, '{"fbclid":"x","consent":"marketing"}'::jsonb) = false, 'no-consent lead refused';
  assert public.website_store_click_ids(r2, '{"fbc":"fb.1.1.abc"}'::jsonb) = true, 'consented lead accepted';
  assert (select fbc from public.website_lead_click_ids where lead_id = v_lead.id) = 'fb.1.1.abc'
     and (select fbclid from public.website_lead_click_ids where lead_id = v_lead.id) = 'IwAR_test_2', 'merge keeps existing';
  assert public.website_store_click_ids('WNOPE2', '{"fbc":"x"}'::jsonb) = false, 'unknown ref';
  passed := passed + 1;

  -- 4. Shape constraints.
  begin
    insert into public.website_leads (kind, reference, consent, consent_analytics, consent_marketing)
    values ('whatsapp', 'WEB-ABCDEF12', 'none', false, false);
    assert false, 'whatsapp lead with WEB reference must fail';
  exception when check_violation then null;
  end;
  begin
    insert into public.website_leads (kind, reference, consent, consent_analytics, consent_marketing)
    values ('booking', 'W23456', 'none', false, false);
    assert false, 'booking lead with W reference must fail';
  exception when check_violation then null;
  end;
  passed := passed + 1;

  -- 5. Matching from a staff note on the Ops order.
  insert into public.customers (phone, name) values ('01799990901', 'WA Test One') returning id into v_cust;
  insert into public.orders (order_number, customer_id, service_category, order_status, order_date, total_amount, csr_notes)
  values ('TEST-WA-1', v_cust, array['Wash + Iron'], 'Delivered', (now() at time zone 'Asia/Dhaka')::date, 850,
          'came from website, ref: ' || lower(r1))
  returning id into v_order;
  v := public.website_match_whatsapp_refs();
  assert (v->>'linked')::int >= 1, 'linked';
  select count(*) into v_count from public.website_lead_customer_links k
    join public.website_leads l on l.id = k.lead_id
   where l.reference = r1 and k.order_id = v_order and k.link_method = 'whatsapp_reference'
     and k.window_kind = 'explicit' and k.status = 'active';
  assert v_count = 1, 'explicit whatsapp_reference link';
  v := public.website_match_whatsapp_refs();
  select count(*) into v_count from public.website_lead_customer_links k
    join public.website_leads l on l.id = k.lead_id where l.reference = r1;
  assert v_count = 1, 'idempotent';
  passed := passed + 1;

  -- 6. A second ref written on the same order is a conflict, not a second conversion.
  v := public.website_create_whatsapp_lead('{"consent":"none"}'::jsonb);
  r3 := v->>'reference';
  update public.orders set special_instructions = 'Ref ' || r3 where id = v_order;
  perform public.website_match_whatsapp_refs();
  select count(*) into v_count from public.website_lead_customer_links k
    join public.website_leads l on l.id = k.lead_id
   where l.reference = r3 and k.conflict = 'order_claimed_by_other_lead' and k.order_id is null and k.window_kind = 'none';
  assert v_count = 1, 'conflict recorded';
  passed := passed + 1;

  -- 7. A reference only matches as a whole token after "Ref".
  update public.orders set special_instructions = 'XREF' || r2 || 'Z' where id = v_order;
  perform public.website_match_whatsapp_refs();
  assert not exists (select 1 from public.website_lead_customer_links k join public.website_leads l on l.id = k.lead_id where l.reference = r2), 'no partial match';
  passed := passed + 1;

  -- 8. The existing engine and reports still run with WhatsApp leads present.
  perform public.website_match_leads();
  perform * from public.website_attribution_conversions(current_date - 1, current_date + 1);
  perform * from public.website_attribution_totals(current_date - 1, current_date + 1);
  perform * from public.website_attribution_review();
  passed := passed + 1;

  -- 9. Privileges.
  assert not has_function_privilege('anon', 'public.website_create_whatsapp_lead(jsonb)', 'execute'), 'anon cannot create';
  assert not has_function_privilege('authenticated', 'public.website_store_click_ids(text, jsonb)', 'execute'), 'authenticated cannot store';
  assert not has_table_privilege('anon', 'public.website_lead_click_ids', 'select'), 'anon cannot read click ids';
  assert (select relrowsecurity from pg_class where oid = 'public.website_lead_click_ids'::regclass), 'RLS on';
  passed := passed + 1;

  -- 10. Purge removes expired rows only.
  update public.website_lead_click_ids set captured_at = now() - interval '100 days', expires_at = now() - interval '1 day'
   where lead_id = (select id from public.website_leads where reference = r2);
  assert public.website_purge_click_ids() >= 1, 'purged';
  passed := passed + 1;

  raise exception 'WHATSAPP_REFS_TESTS_PASSED % / 10 (rolled back)', passed;
end;
$$;
