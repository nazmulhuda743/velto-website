-- Website booking / quote intake for Velto Ops.
-- Audited against the production Ops schema on 2026-09-25.
--
-- Bookings become open `pickup` tasks and household quotes become open `call`
-- tasks in the existing Ops task list. No new operational table is created.
--
-- Revenue attribution V1: attribution is cleaned by the canonical contract
-- (public.website_clean_attribution, strict allowlist + consent gates) and a
-- website_leads row is written in the same transaction as the task. The lead
-- holds no phone, name, address or notes — it points at the task.
-- Requires docs/technical/sql/website_revenue_attribution.sql first.
-- Execution is restricted to service_role. The website still needs
-- VELTO_OPS_WRITES_ENABLED=true before any request can reach this RPC.
--
-- This file is a reviewed migration artifact only. Do not apply it as part of
-- a code deploy. Apply it during the controlled production activation sequence.

do $$
begin
  if to_regclass('public.tasks') is null then
    raise exception 'website_create_request requires public.tasks';
  end if;

  if to_regclass('public.website_leads') is null
     or to_regprocedure('public.website_clean_attribution(jsonb)') is null then
    raise exception 'website_create_request requires website_revenue_attribution.sql (website_leads, website_clean_attribution)';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_indexes
    where schemaname = 'public'
      and tablename = 'tasks'
      and indexname = 'tasks_dedupe_uidx'
      and indexdef ilike 'create unique index%'
      and indexdef ilike '%(dedupe_key)%'
  ) then
    raise exception 'website_create_request requires unique tasks_dedupe_uidx on tasks.dedupe_key';
  end if;

  if exists (
    select required.column_name
    from (values
      ('id'), ('title'), ('type'), ('priority'), ('status'), ('due_at'),
      ('outlet_code'), ('description'), ('assigned_by_name'), ('source'),
      ('source_ref'), ('dedupe_key'), ('created_at')
    ) as required(column_name)
    where not exists (
      select 1
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = 'tasks'
        and c.column_name = required.column_name
    )
  ) then
    raise exception 'website_create_request production tasks schema does not match the reviewed contract';
  end if;
end;
$$;

create or replace function public.website_create_request(
  p_kind text,
  p_dedupe_key text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_name text;
  v_phone text;
  v_area text;
  v_area_key text;
  v_digits text;
  v_phone_key text;
  v_service text;
  v_service_label text;
  v_key text;
  v_id uuid;
  v_recent integer;
  v_outlet text;
  v_title text;
  v_desc text;
  v_attr text;
  v_attribution jsonb;
  v_session uuid;
  v_visitor uuid;
  v_ft_at timestamptz;
  v_ft_source text;
  v_ft_medium text;
  v_ft_campaign text;
  v_ft_content text;
  v_ft_landing text;
  v_ft_referrer text;
  v_ft_click text;
  v_sector smallint;
begin
  if p_kind is null or p_kind not in ('booking', 'quote') then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;

  if p_dedupe_key is null or p_dedupe_key !~ '^[A-Za-z0-9._:-]{16,128}$' then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;

  if p_payload is null
     or jsonb_typeof(p_payload) <> 'object'
     or octet_length(p_payload::text) > 32768 then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;

  v_name := left(btrim(p_payload->>'name'), 100);
  v_phone := left(btrim(p_payload->>'phone'), 32);
  v_area := left(btrim(p_payload->>'area'), 120);
  v_area_key := lower(regexp_replace(coalesce(v_area, ''), '\s+', ' ', 'g'));
  v_digits := regexp_replace(coalesce(v_phone, ''), '\D', '', 'g');
  v_phone_key := case
    when v_digits ~ '^8801[0-9]{9}$' then substr(v_digits, 3)
    when v_digits ~ '^008801[0-9]{9}$' then substr(v_digits, 5)
    else v_digits
  end;
  v_service := nullif(btrim(p_payload->>'service'), '');
  v_key := 'website:' || p_dedupe_key;

  if coalesce(v_name, '') = ''
     or length(v_phone_key) < 7
     or coalesce(v_area, '') = '' then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;

  v_service_label := case v_service
    when 'dry-cleaning' then 'Dry Cleaning'
    when 'wash-and-iron' then 'Wash & Iron'
    when 'ironing' then 'Ironing'
    when 'curtain-cleaning' then 'Curtain Cleaning'
    when 'carpet-cleaning' then 'Carpet Cleaning'
    when 'blanket-comforter-cleaning' then 'Blanket & Comforter Cleaning'
    when 'express' then 'Express'
    else null
  end;

  if p_kind = 'booking' and v_service is not null and v_service_label is null then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;

  if p_kind = 'quote' and coalesce(v_service, '') not in (
    'curtain-cleaning',
    'carpet-cleaning',
    'blanket-comforter-cleaning'
  ) then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;

  select id
    into v_id
  from public.tasks
  where dedupe_key = v_key;

  if v_id is not null then
    return jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'reference', 'WEB-' || upper(substr(replace(v_id::text, '-', ''), 1, 8))
    );
  end if;

  -- Serialize rate-limit checks for one normalized phone number so concurrent
  -- requests cannot trivially race the 3 requests / 30 minutes limit.
  perform pg_advisory_xact_lock(hashtextextended(v_phone_key, 0));

  select count(*)
    into v_recent
  from public.tasks
  where source in ('website_booking', 'website_quote')
    and source_ref = v_phone_key
    and created_at > now() - interval '30 minutes';

  if v_recent >= 3 then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;

  -- Form values are exact labels. Only the exact Sector 18 option routes to
  -- RUAP. This deliberately avoids matching "Outside Uttara Sectors 1-18".
  v_outlet := case
    when v_area_key = 'uttara sector 18' then 'RUAP'
    else 'S11'
  end;

  -- Canonical contract: allowlisted keys, bounded values, consent-gated
  -- advertising ids and analytics session (see website_clean_attribution).
  v_attribution := public.website_clean_attribution(p_payload->'attribution');

  -- Staff-facing summary. Opaque identifiers (click ids, analytics session,
  -- consent state) are kept out of the task text; click ids appear only as
  -- presence (click_id=fbclid|gclid).
  select string_agg(key || '=' || value, ', ' order by key)
    into v_attr
  from (
    select key, value from jsonb_each_text(v_attribution)
    where key = any (array[
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
      'landing_page', 'source', 'medium', 'campaign', 'content', 'ad', 'service',
      'referrer', 'device'
    ]::text[])
    union all
    select 'click_id', case when v_attribution ? 'gclid' then 'gclid' else 'fbclid' end
    where v_attribution ?| array['gclid', 'fbclid']
  ) a;

  if p_kind = 'booking' then
    v_title := 'Website pickup - ' || v_name || ' (' || v_phone || ')';
  else
    v_title := 'Website quote - ' || coalesce(v_service_label, 'Household') ||
      ' - ' || v_name || ' (' || v_phone || ')';
  end if;

  v_desc := concat_ws(E'\n',
    case
      when p_kind = 'booking'
        then 'Pickup request from Velto website. Call or WhatsApp to confirm the time.'
      else 'Household quote request from Velto website. Call or WhatsApp with price guidance.'
    end,
    'Name: ' || v_name,
    'Phone: ' || v_phone,
    'Area: ' || v_area,
    'Address: ' || left(nullif(btrim(p_payload->>'address'), ''), 500),
    'Preferred pickup: ' || left(nullif(btrim(p_payload->>'preferredPickup'), ''), 120),
    'Service: ' || v_service_label,
    'Approx. size / quantity: ' || left(nullif(btrim(p_payload->>'approximateDetails'), ''), 1000),
    'Notes: ' || left(nullif(btrim(p_payload->>'notes'), ''), 1000),
    'Campaign: ' || v_attr
  );

  insert into public.tasks (
    title,
    type,
    priority,
    status,
    due_at,
    outlet_code,
    description,
    assigned_by_name,
    source,
    source_ref,
    dedupe_key
  )
  values (
    v_title,
    case when p_kind = 'booking' then 'pickup' else 'call' end,
    'high',
    'open',
    now() + interval '1 hour',
    v_outlet,
    v_desc,
    'Velto website',
    'website_' || p_kind,
    v_phone_key,
    v_key
  )
  on conflict (dedupe_key) where dedupe_key is not null do nothing
  returning id into v_id;

  if v_id is null then
    select id
      into v_id
    from public.tasks
    where dedupe_key = v_key;

    if v_id is null then
      raise exception 'website_create_request dedupe conflict did not resolve to a task';
    end if;

    return jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'reference', 'WEB-' || upper(substr(replace(v_id::text, '-', ''), 1, 8))
    );
  end if;

  -- Lead row (same transaction). First touch = the earliest first-party
  -- session of the same anonymous visitor within 90 days, only when the
  -- submission carried an analytics session (Analytics consent).
  v_session := (v_attribution->>'analytics_session')::uuid;
  if v_session is not null then
    select e.visitor_id into v_visitor
    from public.website_analytics_events e
    where e.session_id = v_session
    limit 1;
    if v_visitor is not null then
      select e.occurred_at, e.utm_source, e.utm_medium, e.utm_campaign, e.utm_content,
             coalesce(e.landing_page, e.path), e.referrer_host, e.click_id
        into v_ft_at, v_ft_source, v_ft_medium, v_ft_campaign, v_ft_content, v_ft_landing, v_ft_referrer, v_ft_click
      from public.website_analytics_events e
      where e.visitor_id = v_visitor
        and e.occurred_at > now() - interval '90 days'
      order by e.occurred_at, e.id
      limit 1;
    end if;
  end if;

  v_sector := case
    when v_area_key ~ '^uttara sector ([1-9]|1[0-8])$' then substring(v_area_key from '([0-9]+)$')::smallint
    when v_area_key like 'outside%' then 0
    else null
  end;

  insert into public.website_leads (
    kind, task_id, reference, service, outlet_code, area_sector,
    consent, consent_analytics, consent_marketing, analytics_session_id, device,
    utm_source, utm_medium, utm_campaign, utm_content, utm_term,
    source, medium, campaign, content, ad, landing_page, referrer_host, click_id,
    ft_at, ft_utm_source, ft_utm_medium, ft_utm_campaign, ft_utm_content,
    ft_landing_page, ft_referrer_host, ft_click_id
  )
  values (
    p_kind, v_id, 'WEB-' || upper(substr(replace(v_id::text, '-', ''), 1, 8)), v_service, v_outlet, v_sector,
    v_attribution->>'consent',
    v_attribution->>'consent' in ('analytics', 'analytics+marketing'),
    v_attribution->>'consent' in ('marketing', 'analytics+marketing'),
    v_session, v_attribution->>'device',
    v_attribution->>'utm_source', v_attribution->>'utm_medium', v_attribution->>'utm_campaign',
    v_attribution->>'utm_content', v_attribution->>'utm_term',
    v_attribution->>'source', v_attribution->>'medium', v_attribution->>'campaign',
    v_attribution->>'content', v_attribution->>'ad',
    v_attribution->>'landing_page', v_attribution->>'referrer',
    case when v_attribution ? 'gclid' then 'gclid' when v_attribution ? 'fbclid' then 'fbclid' end,
    v_ft_at, v_ft_source, v_ft_medium, v_ft_campaign, v_ft_content, v_ft_landing, v_ft_referrer,
    case when v_attribution->>'consent' in ('marketing', 'analytics+marketing') then v_ft_click end
  );

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'reference', 'WEB-' || upper(substr(replace(v_id::text, '-', ''), 1, 8))
  );
end;
$$;

revoke all on function public.website_create_request(text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.website_create_request(text, text, jsonb)
  to service_role;
