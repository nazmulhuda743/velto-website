-- WhatsApp references + click-id store — staging test suite.
-- Run after the body of website_whatsapp_refs.sql (between its begin/commit) in ONE transaction
-- that ends with ROLLBACK: no test row persists. Synthetic customers use 0179999xxxx.
-- Never run on production.

create temp table t_result (n serial, name text, pass boolean, detail text) on commit drop;

do $$
declare
  c1 uuid; o1 uuid; o2 uuid; o3 uuid;
  r1 text; r2 text; r3 text; r4 text;
  v jsonb;
  n int;
  ok boolean;
begin
  insert into customers (phone, name) values ('01799990101', 'Ref Test') returning id into c1;
  insert into orders (customer_id, service_category, total_amount, order_status) values (c1, array['Dry Cleaning'], 1200, 'New') returning id into o1;
  insert into orders (customer_id, service_category, total_amount, order_status) values (c1, array['Ironing'], 0, 'New') returning id into o2;

  -- 1. create: marketing consent keeps click ids
  r1 := website_create_whatsapp_ref(
    jsonb_build_object('contact_event_id', '0f9c2d1e-aaaa-4bbb-8ccc-123456789abc', 'page_path', '/services/dry-cleaning',
      'placement', 'service_hero', 'service', 'dry_cleaning', 'device', 'mobile', 'consent', 'analytics+marketing',
      'analytics_session_id', '5e551000-0000-4000-8000-000000000101', 'utm_source', 'facebook', 'utm_campaign', 'dc-uttara',
      'landing_page', '/services/dry-cleaning'),
    jsonb_build_object('fbclid', 'IwAR0abcdefghijk', 'fbc', 'fb.1.1759700000000.IwAR0abcdefghijk', 'fbp', 'fb.1.1759700000000.1234567890'));
  insert into t_result (name, pass, detail) values ('ref format', r1 ~ '^WA-[2-9A-HJKMNP-Z]{5}$', r1);
  select count(*) into n from website_ad_click_ids where owner_ref = r1;
  insert into t_result (name, pass, detail) values ('marketing consent stores click ids', n = 1, n::text);

  -- 2. no marketing consent: no click ids, no session without analytics
  r2 := website_create_whatsapp_ref(
    jsonb_build_object('contact_event_id', '1f9c2d1e-aaaa-4bbb-8ccc-123456789abc', 'consent', 'essential',
      'analytics_session_id', '5e551000-0000-4000-8000-000000000102', 'utm_source', 'facebook'),
    jsonb_build_object('fbclid', 'IwAR0abcdefghijk'));
  select count(*) into n from website_ad_click_ids where owner_ref = r2;
  insert into t_result (name, pass, detail) values ('no marketing consent: no click ids', n = 0, n::text);
  select analytics_session_id is null into ok from website_whatsapp_refs where ref = r2;
  insert into t_result (name, pass, detail) values ('no analytics consent: no session id', ok, '');

  -- 3. bad values are rejected (the website then sends the plain link)
  begin
    perform website_create_whatsapp_ref(jsonb_build_object('contact_event_id', 'x', 'consent', 'none'), '{}');
    insert into t_result (name, pass, detail) values ('invalid click id rejected', false, 'accepted');
  exception when check_violation then
    insert into t_result (name, pass, detail) values ('invalid click id rejected', true, 'check_violation');
  end;
  begin
    perform website_create_whatsapp_ref(jsonb_build_object('contact_event_id', '2f9c2d1e-aaaa', 'consent', 'all'), '{}');
    insert into t_result (name, pass, detail) values ('unknown consent rejected', false, 'accepted');
  exception when check_violation then
    insert into t_result (name, pass, detail) values ('unknown consent rejected', true, 'check_violation');
  end;

  -- 4. extraction from chat text
  insert into t_result (name, pass, detail) values ('extract from chat',
    website_extract_whatsapp_ref(E'Hi, curtain pickup lagbe\n\nRef: ' || lower(r1)) = r1, r1);
  insert into t_result (name, pass, detail) values ('extract ignores lookalikes',
    website_extract_whatsapp_ref('order WAX7K2PQ1 and SWA-7K2PQ') is null, '');

  -- 5. linking
  v := website_link_whatsapp_ref('Ref: ' || r1, o1, 'chat_text', 'test');
  insert into t_result (name, pass, detail) values ('link ref to order', (v ->> 'ok')::boolean, v::text);
  select customer_id = c1 into ok from website_whatsapp_refs where ref = r1;
  insert into t_result (name, pass, detail) values ('customer copied from order', ok, '');
  v := website_link_whatsapp_ref(r1, o1, 'chat_text', 'test');
  insert into t_result (name, pass, detail) values ('link is idempotent', (v ->> 'already')::boolean, v::text);
  v := website_link_whatsapp_ref(r1, o2, 'chat_text', 'test');
  insert into t_result (name, pass, detail) values ('ref never moves to another order', v ->> 'reason' = 'ref_linked_to_other_order', v::text);
  v := website_link_whatsapp_ref(r2, o1, 'chat_text', 'test');
  insert into t_result (name, pass, detail) values ('order takes one ref', v ->> 'reason' = 'order_linked_to_other_ref', v::text);
  v := website_link_whatsapp_ref('WA-22222', o2, 'chat_text', 'test');
  insert into t_result (name, pass, detail) values ('unknown ref', v ->> 'reason' = 'unknown_ref', v::text);

  -- 6. automatic link from an order note
  r3 := website_create_whatsapp_ref(jsonb_build_object('contact_event_id', '3f9c2d1e-aaaa-4bbb-8ccc-123456789abc', 'consent', 'none'), '{}');
  insert into orders (customer_id, service_category, total_amount, order_status, special_instructions)
  values (c1, array['Wash & Iron'], 650, 'New', 'From WhatsApp. Ref ' || r3) returning id into o3;
  n := website_link_whatsapp_refs_from_orders(30);
  select order_id = o3 and link_method = 'order_note' into ok from website_whatsapp_refs where ref = r3;
  insert into t_result (name, pass, detail) values ('order note links automatically', n >= 1 and ok, n::text);

  -- 7. attribution snapshot for a server-side sender
  v := website_whatsapp_ref_attribution(r1);
  insert into t_result (name, pass, detail) values ('snapshot has campaign + click ids + order',
    v ->> 'utm_campaign' = 'dc-uttara' and v -> 'click_ids' ->> 'fbc' is not null and v -> 'order' ->> 'billed_value' = '1200', v::text);
  insert into t_result (name, pass, detail) values ('value_final true for billed order', (v -> 'order' ->> 'value_final')::boolean, '');
  r4 := website_create_whatsapp_ref(jsonb_build_object('contact_event_id', '4f9c2d1e-aaaa-4bbb-8ccc-123456789abc', 'consent', 'none'), '{}');
  perform website_link_whatsapp_ref(r4, o2, 'staff', 'test');
  v := website_whatsapp_ref_attribution(r4);
  insert into t_result (name, pass, detail) values ('value_final false for zero total (no Purchase)', not (v -> 'order' ->> 'value_final')::boolean, v -> 'order' ->> 'value_final');
  insert into t_result (name, pass, detail) values ('no click ids without consent', v -> 'click_ids' is null or v -> 'click_ids' = 'null'::jsonb, '');

  -- 8. lead click ids (WEB reference) and retention
  perform website_store_ad_click_ids('WEB-ABCD1234', jsonb_build_object('gclid', 'Cj0KCQjw_abcdefgh'));
  perform website_store_ad_click_ids('WEB-ABCD1234', jsonb_build_object('gclid', 'Cj0KCQjw_other123'));
  select count(*) into n from website_ad_click_ids where owner_ref = 'WEB-ABCD1234' and gclid = 'Cj0KCQjw_abcdefgh';
  insert into t_result (name, pass, detail) values ('lead click ids stored once', n = 1, n::text);
  update website_ad_click_ids set expires_at = now() - interval '1 minute' where owner_ref = 'WEB-ABCD1234';
  v := website_whatsapp_refs_purge();
  select count(*) into n from website_ad_click_ids where owner_ref = 'WEB-ABCD1234';
  insert into t_result (name, pass, detail) values ('purge removes expired click ids', n = 0, v::text);

  -- 9. privileges
  insert into t_result (name, pass, detail) values ('anon cannot read refs',
    not has_table_privilege('anon', 'public.website_whatsapp_refs', 'select'), '');
  insert into t_result (name, pass, detail) values ('anon cannot run create',
    not has_function_privilege('anon', 'public.website_create_whatsapp_ref(jsonb, jsonb)', 'execute'), '');
  insert into t_result (name, pass, detail) values ('authenticated cannot read click ids',
    not has_table_privilege('authenticated', 'public.website_ad_click_ids', 'select'), '');
end;
$$;

select name, pass, detail from t_result order by n;
