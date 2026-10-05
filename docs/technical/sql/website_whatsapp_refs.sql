-- WhatsApp reference attribution + short-retention click ids (Revenue Attribution V1.1).
-- Written 2026-10-06 against the production schema (website_leads as created by
-- website_revenue_attribution.sql). Requires that file first.
--
-- What it adds
--   1. website_leads.kind 'whatsapp' with references shaped W + 5 characters (e.g. W7K2PQ).
--      /go/whatsapp creates one when a visitor taps a WhatsApp button on a public page and puts
--      "Ref: W7K2PQ" in the prefilled message. The row holds the same campaign snapshot as a
--      booking lead and, like every lead, no phone, name, address or message text.
--   2. website_lead_click_ids: raw fbclid / fbc / fbp / gclid for a lead, kept ONLY with
--      Marketing consent and only for 90 days. This is the store REVENUE-ATTRIBUTION-DESIGN.md §10
--      reserved for Meta Conversions API and Google offline conversions. Nothing reads it yet.
--   3. website_match_whatsapp_refs(): links a WhatsApp lead to the Ops order whose staff notes
--      (orders.csr_notes or orders.special_instructions) contain "Ref W7K2PQ". This works today
--      with no Ops app change; a dedicated Ops field can replace the note scan later without
--      changing the lead side. Link method 'whatsapp_reference', window 'explicit' (a staff act).
--
-- Access: RLS on, all privileges revoked from anon / authenticated / public, service_role only,
-- fixed search_path. The browser never reaches any of it.
--
-- This file is a reviewed migration artifact. Apply it to production only in a planned window,
-- then set VELTO_WHATSAPP_REFS_ENABLED=true in Vercel and redeploy.

do $$
begin
  if to_regclass('public.website_leads') is null
     or to_regclass('public.website_lead_customer_links') is null
     or to_regprocedure('public.website_clean_attribution(jsonb)') is null then
    raise exception 'website_whatsapp_refs requires website_revenue_attribution.sql';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders' and column_name = 'csr_notes'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders' and column_name = 'special_instructions'
  ) then
    raise exception 'website_whatsapp_refs expects orders.csr_notes and orders.special_instructions';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. WhatsApp leads
-- ---------------------------------------------------------------------------
alter table public.website_leads drop constraint if exists website_leads_kind_check;
alter table public.website_leads
  add constraint website_leads_kind_check check (kind in ('booking', 'quote', 'whatsapp'));

alter table public.website_leads drop constraint if exists website_leads_reference_check;
alter table public.website_leads
  add constraint website_leads_reference_check check (
    reference ~ '^WEB-[A-Z0-9]{8}$' or reference ~ '^W[2-9A-HJ-NP-Z]{5}$'
  );

-- A WhatsApp lead is never tied to an Ops task, and a booking/quote lead never uses a W reference.
alter table public.website_leads drop constraint if exists website_leads_whatsapp_shape_check;
alter table public.website_leads
  add constraint website_leads_whatsapp_shape_check check (
    (kind = 'whatsapp' and task_id is null and reference ~ '^W[2-9A-HJ-NP-Z]{5}$')
    or (kind <> 'whatsapp' and reference ~ '^WEB-[A-Z0-9]{8}$')
  );

create index if not exists website_leads_whatsapp_created_idx
  on public.website_leads (created_at) where kind = 'whatsapp';

-- ---------------------------------------------------------------------------
-- 2. Short-retention click ids (Marketing consent only)
-- ---------------------------------------------------------------------------
create table if not exists public.website_lead_click_ids (
  lead_id     uuid primary key references public.website_leads(id) on delete cascade,
  fbclid      text check (char_length(fbclid) <= 256),
  fbc         text check (char_length(fbc) <= 256),
  fbp         text check (char_length(fbp) <= 256),
  gclid       text check (char_length(gclid) <= 256),
  captured_at timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '90 days',
  check (coalesce(fbclid, fbc, fbp, gclid) is not null),
  check (expires_at > captured_at)
);

alter table public.website_lead_click_ids enable row level security;
revoke all on table public.website_lead_click_ids from public, anon, authenticated;
grant select, insert, update, delete on table public.website_lead_click_ids to service_role;

create index if not exists website_lead_click_ids_expires_idx on public.website_lead_click_ids (expires_at);

-- Writes click ids for a lead created in the last hour, only when that lead recorded Marketing
-- consent. Values pass the canonical cleaner (with the lead's own consent, never the caller's).
create or replace function public.website_store_click_ids(p_reference text, p jsonb)
returns boolean
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_lead public.website_leads%rowtype;
  v_clean jsonb;
begin
  select * into v_lead from public.website_leads
  where reference = btrim(p_reference) and created_at > now() - interval '1 hour';
  if not found or not v_lead.consent_marketing then
    return false;
  end if;

  v_clean := public.website_clean_attribution(
    (case when jsonb_typeof(p) = 'object' then p else '{}'::jsonb end)
    || jsonb_build_object('consent', v_lead.consent)
  );
  if coalesce(v_clean->>'fbclid', v_clean->>'fbc', v_clean->>'fbp', v_clean->>'gclid') is null then
    return false;
  end if;

  insert into public.website_lead_click_ids (lead_id, fbclid, fbc, fbp, gclid)
  values (v_lead.id, v_clean->>'fbclid', v_clean->>'fbc', v_clean->>'fbp', v_clean->>'gclid')
  on conflict (lead_id) do update
    set fbclid = coalesce(excluded.fbclid, website_lead_click_ids.fbclid),
        fbc    = coalesce(excluded.fbc, website_lead_click_ids.fbc),
        fbp    = coalesce(excluded.fbp, website_lead_click_ids.fbp),
        gclid  = coalesce(excluded.gclid, website_lead_click_ids.gclid);
  return true;
end;
$$;

create or replace function public.website_purge_click_ids()
returns integer
language sql
set search_path = pg_catalog, public
as $$
  with gone as (delete from public.website_lead_click_ids where expires_at <= now() returning 1)
  select count(*)::integer from gone;
$$;

-- ---------------------------------------------------------------------------
-- 3. Create a WhatsApp lead
-- ---------------------------------------------------------------------------
-- p: the same attribution keys as a booking (website_clean_attribution decides what survives),
-- plus optional "service" and "area_sector" (1–18, or 0 for outside Uttara).
-- Returns { ok, reference } or { ok: false, error }.
create or replace function public.website_create_whatsapp_lead(p jsonb)
returns jsonb
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_attribution jsonb := public.website_clean_attribution(p);
  v_alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_reference text;
  v_service text;
  v_sector smallint;
  v_session uuid;
  v_visitor uuid;
  v_ft_at timestamptz; v_ft_source text; v_ft_medium text; v_ft_campaign text; v_ft_content text;
  v_ft_landing text; v_ft_referrer text; v_ft_click text;
  v_id uuid;
  v_try integer := 0;
begin
  v_service := lower(btrim(p->>'service'));
  if v_service !~ '^[a-z][a-z-]{1,39}$' then v_service := null; end if;
  if (p->>'area_sector') ~ '^[0-9]{1,2}$' and (p->>'area_sector')::int between 0 and 18 then
    v_sector := (p->>'area_sector')::smallint;
  end if;

  -- First touch, as in website_create_request (Analytics consent only).
  v_session := (v_attribution->>'analytics_session')::uuid;
  if v_session is not null and to_regclass('public.website_analytics_events') is not null then
    select e.visitor_id into v_visitor from public.website_analytics_events e where e.session_id = v_session limit 1;
    if v_visitor is not null then
      select e.occurred_at, e.utm_source, e.utm_medium, e.utm_campaign, e.utm_content,
             coalesce(e.landing_page, e.path), e.referrer_host, e.click_id
        into v_ft_at, v_ft_source, v_ft_medium, v_ft_campaign, v_ft_content, v_ft_landing, v_ft_referrer, v_ft_click
      from public.website_analytics_events e
      where e.visitor_id = v_visitor and e.occurred_at > now() - interval '90 days'
      order by e.occurred_at, e.id
      limit 1;
    end if;
  end if;

  loop
    v_try := v_try + 1;
    v_reference := 'W';
    for i in 1..5 loop
      v_reference := v_reference || substr(v_alphabet, 1 + floor(random() * 32)::int, 1);
    end loop;
    begin
      insert into public.website_leads (
        kind, task_id, reference, service, outlet_code, area_sector,
        consent, consent_analytics, consent_marketing, analytics_session_id, device,
        utm_source, utm_medium, utm_campaign, utm_content, utm_term,
        source, medium, campaign, content, ad, landing_page, referrer_host, click_id,
        ft_at, ft_utm_source, ft_utm_medium, ft_utm_campaign, ft_utm_content,
        ft_landing_page, ft_referrer_host, ft_click_id
      ) values (
        'whatsapp', null, v_reference, v_service, null, v_sector,
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
        case when v_session is not null then v_ft_at end, v_ft_source, v_ft_medium, v_ft_campaign, v_ft_content,
        v_ft_landing, v_ft_referrer,
        case when v_attribution->>'consent' in ('marketing', 'analytics+marketing') then v_ft_click end
      )
      returning id into v_id;
      exit;
    exception when unique_violation then
      if v_try >= 5 then
        return jsonb_build_object('ok', false, 'error', 'reference_collision');
      end if;
    end;
  end loop;

  if v_attribution->>'consent' in ('marketing', 'analytics+marketing')
     and coalesce(v_attribution->>'fbclid', v_attribution->>'fbc', v_attribution->>'fbp', v_attribution->>'gclid') is not null then
    insert into public.website_lead_click_ids (lead_id, fbclid, fbc, fbp, gclid)
    values (v_id, v_attribution->>'fbclid', v_attribution->>'fbc', v_attribution->>'fbp', v_attribution->>'gclid');
  end if;

  return jsonb_build_object('ok', true, 'reference', v_reference);
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Match WhatsApp references written on Ops orders
-- ---------------------------------------------------------------------------
-- Staff write "Ref W7K2PQ" (any case; ":" "#" "-" or spaces allowed after Ref) in the order's
-- CSR notes or special instructions. A reference links to the earliest qualifying order that
-- carries it (not Cancelled, total > 0, has a customer, dated on/after the tap). Explicit staff
-- act → window 'explicit', no time limit. An order already claimed by another live link is
-- recorded as a conflict and not counted, exactly like a duplicate staff link.
-- Rejected or admin-reversed links are never recreated. Idempotent.
create or replace function public.website_match_whatsapp_refs(p_lookback_days integer default 120)
returns jsonb
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  r record;
  v_order_id uuid;
  v_customer uuid;
  v_conflict text;
  v_link_id uuid;
  v_linked integer := 0;
begin
  for r in
    select l.id, l.reference, l.created_at
    from public.website_leads l
    where l.kind = 'whatsapp'
      and l.created_at > now() - make_interval(days => greatest(p_lookback_days, 1))
      and not exists (
        select 1 from public.website_lead_customer_links k
        where k.lead_id = l.id
          and (k.status in ('active', 'confirmed') or k.reviewed_by is not null or k.status = 'rejected')
      )
    order by l.created_at, l.id
  loop
    v_order_id := null;
    v_customer := null;
    select o.id, o.customer_id into v_order_id, v_customer
    from public.orders o
    where o.customer_id is not null
      and o.order_status <> 'Cancelled'
      and o.total_amount > 0
      and o.order_date >= (r.created_at at time zone 'Asia/Dhaka')::date
      and (
        coalesce(o.csr_notes, '') ~* ('\mref[[:space:]:#-]*' || r.reference || '\M')
        or coalesce(o.special_instructions, '') ~* ('\mref[[:space:]:#-]*' || r.reference || '\M')
      )
    order by o.order_date, o.created_at, o.id
    limit 1;

    continue when v_order_id is null;

    v_conflict := case when exists (
      select 1 from public.website_lead_customer_links k
      where k.order_id = v_order_id and k.status in ('active', 'confirmed')
    ) then 'order_claimed_by_other_lead' end;

    insert into public.website_lead_customer_links
      (lead_id, customer_id, order_id, link_method, window_kind, name_mismatch, conflict)
    values (
      r.id, v_customer,
      case when v_conflict is null then v_order_id end,
      'whatsapp_reference',
      case when v_conflict is null then 'explicit' else 'none' end,
      false, v_conflict
    )
    returning id into v_link_id;
    insert into public.website_attribution_audit (link_id, lead_id, action, actor, detail)
    values (v_link_id, r.id, 'auto_link', 'system', 'whatsapp_reference' || coalesce(':' || v_conflict, ''));
    v_linked := v_linked + 1;
  end loop;

  return jsonb_build_object('linked', v_linked, 'ran_at', now());
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Privileges
-- ---------------------------------------------------------------------------
revoke all on function public.website_store_click_ids(text, jsonb) from public, anon, authenticated;
revoke all on function public.website_purge_click_ids() from public, anon, authenticated;
revoke all on function public.website_create_whatsapp_lead(jsonb) from public, anon, authenticated;
revoke all on function public.website_match_whatsapp_refs(integer) from public, anon, authenticated;
grant execute on function public.website_store_click_ids(text, jsonb) to service_role;
grant execute on function public.website_purge_click_ids() to service_role;
grant execute on function public.website_create_whatsapp_lead(jsonb) to service_role;
grant execute on function public.website_match_whatsapp_refs(integer) to service_role;

-- Schedule after activation (pg_cron, alongside website_match_leads at 03:30 Dhaka = 21:30 UTC):
--   select cron.schedule('website_match_whatsapp_refs', '35 21 * * *', $$select public.website_match_whatsapp_refs()$$);
--   select cron.schedule('website_purge_click_ids',     '40 21 * * *', $$select public.website_purge_click_ids()$$);
