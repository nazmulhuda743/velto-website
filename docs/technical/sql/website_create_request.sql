-- Website booking / quote intake for Velto Ops.
-- Audited against the production Ops schema on 2026-09-25.
--
-- Bookings become open `pickup` tasks and household quotes become open `call`
-- tasks in the existing Ops task list. No new operational table is created.
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

  v_attribution := case
    when jsonb_typeof(p_payload->'attribution') = 'object'
      then p_payload->'attribution'
    else '{}'::jsonb
  end;

  select string_agg(key || '=' || left(value, 256), ', ' order by key)
    into v_attr
  from jsonb_each_text(v_attribution)
  where key = any (array[
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
    'fbclid', 'fbc', 'fbp', 'gclid',
    'landing_page', 'source', 'medium', 'campaign', 'content', 'ad', 'service'
  ]::text[]);

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
