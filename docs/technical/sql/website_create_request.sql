-- Website booking / quote intake for Velto Ops.
-- Bookings become open `pickup` tasks and household quotes become open `call`
-- tasks in the existing Ops task list. No new table; callable by service_role only.
-- Idempotent on the website's idempotency key via the existing tasks_dedupe_uidx.

create or replace function public.website_create_request(p_kind text, p_dedupe_key text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := left(btrim(p_payload->>'name'), 100);
  v_phone text := left(btrim(p_payload->>'phone'), 32);
  v_area text := left(btrim(p_payload->>'area'), 120);
  v_digits text := regexp_replace(coalesce(left(btrim(p_payload->>'phone'), 32), ''), '\D', '', 'g');
  v_phone_key text := case
    when v_digits ~ '^8801[0-9]{9}$' then substr(v_digits, 3)
    when v_digits ~ '^008801[0-9]{9}$' then substr(v_digits, 5)
    else v_digits end;
  v_service text := p_payload->>'service';
  v_service_label text;
  v_key text := 'website:' || p_dedupe_key;
  v_id uuid;
  v_recent int;
  v_outlet text;
  v_title text;
  v_desc text;
  v_attr text;
begin
  if p_kind is null or p_kind not in ('booking', 'quote') then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  if p_dedupe_key is null or p_dedupe_key !~ '^[A-Za-z0-9._:-]{16,128}$' then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  if coalesce(v_name, '') = '' or length(v_phone_key) < 7 or coalesce(v_area, '') = '' then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;

  select id into v_id from tasks where dedupe_key = v_key;
  if v_id is not null then
    return jsonb_build_object('ok', true, 'duplicate', true,
      'reference', 'WEB-' || upper(substr(replace(v_id::text, '-', ''), 1, 8)));
  end if;

  select count(*) into v_recent from tasks
  where source in ('website_booking', 'website_quote')
    and source_ref = v_phone_key
    and created_at > now() - interval '30 minutes';
  if v_recent >= 3 then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;

  v_service_label := case v_service
    when 'dry-cleaning' then 'Dry Cleaning'
    when 'wash-and-iron' then 'Wash & Iron'
    when 'ironing' then 'Ironing'
    when 'curtain-cleaning' then 'Curtain Cleaning'
    when 'carpet-cleaning' then 'Carpet Cleaning'
    when 'blanket-comforter-cleaning' then 'Blanket & Comforter Cleaning'
    when 'express' then 'Express'
    else null end;

  -- Sector 18 requests route to the RUAP outlet; everything else to the main Sector 11 outlet.
  v_outlet := case when v_area ~* '(^|[^0-9])18([^0-9]|$)' then 'RUAP' else 'S11' end;

  select string_agg(key || '=' || left(value, 120), ', ' order by key) into v_attr
  from jsonb_each_text(coalesce(p_payload->'attribution', '{}'::jsonb));

  if p_kind = 'booking' then
    v_title := 'Website pickup - ' || v_name || ' (' || v_phone || ')';
  else
    v_title := 'Website quote - ' || coalesce(v_service_label, 'Household') || ' - ' || v_name || ' (' || v_phone || ')';
  end if;

  v_desc := concat_ws(E'\n',
    case when p_kind = 'booking' then 'Pickup request from velto website. Call or WhatsApp to confirm the time.'
         else 'Household quote request from velto website. Call or WhatsApp with price guidance.' end,
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

  insert into tasks (title, type, priority, status, due_at, outlet_code, description,
                     assigned_by_name, source, source_ref, dedupe_key)
  values (v_title, case when p_kind = 'booking' then 'pickup' else 'call' end, 'high', 'open',
          now() + interval '1 hour', v_outlet, v_desc,
          'Velto website', 'website_' || p_kind, v_phone_key, v_key)
  on conflict (dedupe_key) where dedupe_key is not null do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from tasks where dedupe_key = v_key;
    return jsonb_build_object('ok', true, 'duplicate', true,
      'reference', 'WEB-' || upper(substr(replace(v_id::text, '-', ''), 1, 8)));
  end if;

  return jsonb_build_object('ok', true, 'duplicate', false,
    'reference', 'WEB-' || upper(substr(replace(v_id::text, '-', ''), 1, 8)));
end;
$$;

revoke all on function public.website_create_request(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.website_create_request(text, text, jsonb) to service_role;
