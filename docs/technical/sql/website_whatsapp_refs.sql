-- Velto WhatsApp references + ad click-id store (docs/technical/TRACKING.md §5-§7).
--
-- Closes REVENUE-ATTRIBUTION-DESIGN.md §11: a WhatsApp click on the website gets a short
-- reference (WA-7K2PQ) that travels inside the customer's first WhatsApp message, while the
-- campaign snapshot behind it is stored here. When the order is created, any Ops tool resolves
-- the reference from the chat text or the order note and links it; no staff typing is required.
--
-- Website-owned objects. Nothing here writes to customers, orders, payments or tasks.
-- No name, phone, address or message text is stored. Raw advertising click ids are kept only
-- with Marketing consent, in a separate table that expires after 90 days.
--
-- Requires: Ops tables orders, customers. Independent of website_revenue_attribution.sql.
-- Status: tested on STAGING inside a rolled-back transaction. NOT applied to production.
-- After applying: set VELTO_WHATSAPP_REFS_ENABLED=true in Vercel and redeploy.

begin;

-- ---------------------------------------------------------------------------
-- 0. Schema contract: the Ops columns this file reads
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1
    from (values
      ('customers', 'id'),
      ('orders', 'id'), ('orders', 'order_number'), ('orders', 'customer_id'), ('orders', 'order_date'),
      ('orders', 'order_status'), ('orders', 'total_amount'), ('orders', 'created_at'),
      ('orders', 'special_instructions'), ('orders', 'csr_notes'), ('orders', 'service_category')
    ) as req(tbl, col)
    where not exists (
      select 1 from information_schema.columns c
      where c.table_schema = 'public' and c.table_name = req.tbl and c.column_name = req.col
    )
  ) then
    raise exception 'website_whatsapp_refs: Ops schema does not match the reviewed contract';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------
create table if not exists public.website_whatsapp_refs (
  id                   uuid primary key default gen_random_uuid(),
  ref                  text not null unique check (ref ~ '^WA-[2-9A-HJKMNP-Z]{5}$'),
  created_at           timestamptz not null default now(),
  -- The browser's click id: the Meta Contact event used eventID 'contact.' || this value.
  contact_event_id     text not null check (contact_event_id ~ '^[A-Za-z0-9-]{8,64}$'),
  page_path            text check (page_path ~ '^/[A-Za-z0-9/_.\-\[\]]{0,200}$'),
  placement            text check (placement ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  service              text check (service in ('dry_cleaning', 'wash_and_iron', 'ironing', 'curtain_cleaning',
                                                'carpet_cleaning', 'blanket_cleaning', 'express_service')),
  device               text check (device in ('mobile', 'tablet', 'desktop')),
  consent              text not null check (consent in ('none', 'essential', 'analytics', 'marketing', 'analytics+marketing')),
  analytics_session_id uuid,
  landing_page         text check (landing_page ~ '^/' and length(landing_page) <= 1024),
  referrer_host        text check (referrer_host ~ '^[a-z0-9.-]{1,120}$'),
  utm_source           text check (length(utm_source) <= 256),
  utm_medium           text check (length(utm_medium) <= 256),
  utm_campaign         text check (length(utm_campaign) <= 256),
  utm_content          text check (length(utm_content) <= 256),
  utm_term             text check (length(utm_term) <= 256),
  source               text check (length(source) <= 256),
  medium               text check (length(medium) <= 256),
  campaign             text check (length(campaign) <= 256),
  content              text check (length(content) <= 256),
  ad                   text check (length(ad) <= 256),
  -- Resolution: the order this conversation became (one reference per order, one order per reference).
  order_id             uuid unique references public.orders(id) on delete set null,
  customer_id          uuid references public.customers(id) on delete set null,
  linked_at            timestamptz,
  link_method          text check (link_method in ('chat_text', 'order_note', 'staff', 'system')),
  linked_by            text check (length(linked_by) <= 120),
  constraint website_whatsapp_refs_session_consent
    check (analytics_session_id is null or consent in ('analytics', 'analytics+marketing'))
);

create index if not exists website_whatsapp_refs_created_idx on public.website_whatsapp_refs (created_at);
create index if not exists website_whatsapp_refs_campaign_idx on public.website_whatsapp_refs (lower(utm_campaign));

-- Raw click ids for future server-side conversions (Meta CAPI, Google offline import).
-- Owner: a WhatsApp reference or a website booking/quote reference (website_leads.reference).
create table if not exists public.website_ad_click_ids (
  owner_ref   text primary key check (owner_ref ~ '^(WA-[2-9A-HJKMNP-Z]{5}|WEB-[A-Z0-9]{8})$'),
  captured_at timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '90 days',
  -- (Postgres caps a regex repeat count at 255, so lengths are checked separately.)
  fbclid      text check (fbclid ~ '^[A-Za-z0-9_-]+$' and length(fbclid) between 10 and 500),
  fbc         text check (fbc ~ '^fb\.[0-2]\.[0-9]{10,13}\.[A-Za-z0-9_-]+$' and length(fbc) <= 530),
  fbp         text check (fbp ~ '^fb\.[0-2]\.[0-9]{10,13}\.[0-9]{1,30}$'),
  gclid       text check (gclid ~ '^[A-Za-z0-9_-]+$' and length(gclid) between 10 and 500),
  constraint website_ad_click_ids_not_empty check (coalesce(fbclid, fbc, fbp, gclid) is not null)
);

create index if not exists website_ad_click_ids_expires_idx on public.website_ad_click_ids (expires_at);

-- ---------------------------------------------------------------------------
-- 2. Reference format (shared with src/lib/whatsapp-ref.ts)
-- ---------------------------------------------------------------------------
-- The first reference in any text (a pasted chat, an order note), normalized; null if none.
create or replace function public.website_extract_whatsapp_ref(p_text text)
returns text
language sql
immutable
set search_path = pg_catalog, public
as $$
  select 'WA-' || upper(m[1])
  from regexp_match(coalesce(p_text, ''), '(?:^|[^A-Za-z0-9])[Ww][Aa][- ]?([2-9A-HJKMNP-Za-hjkmnp-z]{5})(?![A-Za-z0-9])') as m
  where m is not null;
$$;

-- ---------------------------------------------------------------------------
-- 3. Writes from the website (service role)
-- ---------------------------------------------------------------------------
create or replace function public.website_store_ad_click_ids(p_owner_ref text, p_click_ids jsonb)
returns void
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v jsonb := case when jsonb_typeof(p_click_ids) = 'object' then p_click_ids else '{}'::jsonb end;
begin
  if coalesce(v ->> 'fbclid', v ->> 'fbc', v ->> 'fbp', v ->> 'gclid') is null then
    return;
  end if;
  insert into public.website_ad_click_ids (owner_ref, fbclid, fbc, fbp, gclid)
  values (p_owner_ref, nullif(v ->> 'fbclid', ''), nullif(v ->> 'fbc', ''), nullif(v ->> 'fbp', ''), nullif(v ->> 'gclid', ''))
  on conflict (owner_ref) do nothing;
end;
$$;

-- Creates one reference for one WhatsApp click and returns it. Click ids are stored only when the
-- recorded consent includes Marketing. Unknown payload keys are ignored; values are bounded by the
-- table checks, so a bad value fails the insert and the website falls back to the plain link.
create or replace function public.website_create_whatsapp_ref(p_payload jsonb, p_click_ids jsonb default '{}'::jsonb)
returns text
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  p jsonb := case when jsonb_typeof(p_payload) = 'object' then p_payload else '{}'::jsonb end;
  v_alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  v_ref text;
  v_bytes bytea;
  v_consent text := coalesce(nullif(p ->> 'consent', ''), 'none');
  i int;
  attempt int := 0;
begin
  loop
    attempt := attempt + 1;
    v_bytes := uuid_send(gen_random_uuid());
    v_ref := 'WA-';
    for i in 0..4 loop
      v_ref := v_ref || substr(v_alphabet, (get_byte(v_bytes, i) % 31) + 1, 1);
    end loop;
    begin
      insert into public.website_whatsapp_refs (
        ref, contact_event_id, page_path, placement, service, device, consent, analytics_session_id,
        landing_page, referrer_host, utm_source, utm_medium, utm_campaign, utm_content, utm_term,
        source, medium, campaign, content, ad
      ) values (
        v_ref, p ->> 'contact_event_id', nullif(p ->> 'page_path', ''), nullif(p ->> 'placement', ''),
        nullif(p ->> 'service', ''), nullif(p ->> 'device', ''), v_consent,
        case when v_consent in ('analytics', 'analytics+marketing') then nullif(p ->> 'analytics_session_id', '')::uuid end,
        nullif(p ->> 'landing_page', ''), nullif(p ->> 'referrer_host', ''),
        nullif(p ->> 'utm_source', ''), nullif(p ->> 'utm_medium', ''), nullif(p ->> 'utm_campaign', ''),
        nullif(p ->> 'utm_content', ''), nullif(p ->> 'utm_term', ''),
        nullif(p ->> 'source', ''), nullif(p ->> 'medium', ''), nullif(p ->> 'campaign', ''),
        nullif(p ->> 'content', ''), nullif(p ->> 'ad', '')
      );
      exit;
    exception when unique_violation then
      if attempt >= 5 then raise; end if;
    end;
  end loop;

  if v_consent in ('marketing', 'analytics+marketing') then
    perform public.website_store_ad_click_ids(v_ref, p_click_ids);
  end if;
  return v_ref;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Resolution (called by Ops tools, the Money Desk agent or a nightly job)
-- ---------------------------------------------------------------------------
-- Link a reference to the order it became. Idempotent; never moves an existing link.
-- p_method: chat_text (found in a pasted chat), order_note, staff, system.
create or replace function public.website_link_whatsapp_ref(
  p_ref text, p_order_id uuid, p_method text default 'system', p_actor text default null
)
returns jsonb
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_ref text := public.website_extract_whatsapp_ref(p_ref);
  r public.website_whatsapp_refs%rowtype;
  v_customer uuid;
begin
  if v_ref is null then return jsonb_build_object('ok', false, 'reason', 'invalid_ref'); end if;
  select * into r from public.website_whatsapp_refs where ref = v_ref for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'unknown_ref'); end if;
  select customer_id into v_customer from public.orders where id = p_order_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'unknown_order'); end if;
  if r.order_id = p_order_id then return jsonb_build_object('ok', true, 'ref', v_ref, 'already', true); end if;
  if r.order_id is not null then return jsonb_build_object('ok', false, 'reason', 'ref_linked_to_other_order'); end if;
  if exists (select 1 from public.website_whatsapp_refs where order_id = p_order_id) then
    return jsonb_build_object('ok', false, 'reason', 'order_linked_to_other_ref');
  end if;
  if p_method not in ('chat_text', 'order_note', 'staff', 'system') then
    return jsonb_build_object('ok', false, 'reason', 'invalid_method');
  end if;
  update public.website_whatsapp_refs
     set order_id = p_order_id, customer_id = v_customer, linked_at = now(),
         link_method = p_method, linked_by = left(p_actor, 120)
   where id = r.id;
  return jsonb_build_object('ok', true, 'ref', v_ref, 'already', false);
end;
$$;

-- Automatic path that needs no Ops change: link any recent order whose notes carry a reference
-- (for example a chat message pasted into the order). Oldest order first; returns links made.
create or replace function public.website_link_whatsapp_refs_from_orders(p_lookback_days int default 30)
returns int
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  o record;
  v_ref text;
  v_result jsonb;
  v_linked int := 0;
begin
  for o in
    select id, special_instructions, csr_notes
    from public.orders
    where created_at >= now() - make_interval(days => greatest(1, least(p_lookback_days, 180)))
      and not exists (select 1 from public.website_whatsapp_refs w where w.order_id = orders.id)
      and (special_instructions ~* 'WA[- ]?[2-9A-HJKMNP-Z]{5}' or csr_notes ~* 'WA[- ]?[2-9A-HJKMNP-Z]{5}')
    order by created_at, id
  loop
    v_ref := coalesce(public.website_extract_whatsapp_ref(o.special_instructions), public.website_extract_whatsapp_ref(o.csr_notes));
    continue when v_ref is null;
    v_result := public.website_link_whatsapp_ref(v_ref, o.id, 'order_note', 'system');
    if (v_result ->> 'ok')::boolean and not coalesce((v_result ->> 'already')::boolean, false) then
      v_linked := v_linked + 1;
    end if;
  end loop;
  return v_linked;
end;
$$;

-- Everything a server-side conversion sender needs for one reference: the campaign snapshot,
-- the consented click ids (if not expired) and the linked order's facts. `value_final` is false
-- until the order has a billed total above zero and isn't cancelled; no Purchase before that.
create or replace function public.website_whatsapp_ref_attribution(p_ref text)
returns jsonb
language sql
stable
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'ref', w.ref,
    'created_at', w.created_at,
    'contact_event_id', w.contact_event_id,
    'consent', w.consent,
    'page_path', w.page_path, 'placement', w.placement, 'service', w.service, 'device', w.device,
    'landing_page', w.landing_page, 'referrer_host', w.referrer_host,
    'utm_source', w.utm_source, 'utm_medium', w.utm_medium, 'utm_campaign', w.utm_campaign,
    'utm_content', w.utm_content, 'utm_term', w.utm_term,
    'click_ids', case when c.owner_ref is not null and c.expires_at > now()
                      then jsonb_strip_nulls(jsonb_build_object('fbclid', c.fbclid, 'fbc', c.fbc, 'fbp', c.fbp, 'gclid', c.gclid))
                 end,
    'order', case when o.id is not null then jsonb_build_object(
      'order_id', o.id, 'order_number', o.order_number, 'order_date', o.order_date,
      'status', o.order_status, 'billed_value', o.total_amount, 'currency', 'BDT',
      'services', to_jsonb(o.service_category),
      'value_final', coalesce(o.total_amount, 0) > 0 and coalesce(o.order_status, '') !~* '^cancel'
    ) end,
    'link_method', w.link_method, 'linked_at', w.linked_at
  )
  from public.website_whatsapp_refs w
  left join public.website_ad_click_ids c on c.owner_ref = w.ref
  left join public.orders o on o.id = w.order_id
  where w.ref = public.website_extract_whatsapp_ref(p_ref);
$$;

-- Retention: click ids after 90 days; references that never became an order after 180 days.
create or replace function public.website_whatsapp_refs_purge()
returns jsonb
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_ids int;
  v_refs int;
begin
  delete from public.website_ad_click_ids where expires_at <= now();
  get diagnostics v_ids = row_count;
  delete from public.website_whatsapp_refs where order_id is null and created_at < now() - interval '180 days';
  get diagnostics v_refs = row_count;
  return jsonb_build_object('click_ids', v_ids, 'refs', v_refs);
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Access: service role only
-- ---------------------------------------------------------------------------
alter table public.website_whatsapp_refs enable row level security;
alter table public.website_ad_click_ids enable row level security;

revoke all on public.website_whatsapp_refs from anon, authenticated, public;
revoke all on public.website_ad_click_ids from anon, authenticated, public;
grant select, insert, update, delete on public.website_whatsapp_refs to service_role;
grant select, insert, update, delete on public.website_ad_click_ids to service_role;

revoke all on function public.website_extract_whatsapp_ref(text) from anon, authenticated, public;
revoke all on function public.website_store_ad_click_ids(text, jsonb) from anon, authenticated, public;
revoke all on function public.website_create_whatsapp_ref(jsonb, jsonb) from anon, authenticated, public;
revoke all on function public.website_link_whatsapp_ref(text, uuid, text, text) from anon, authenticated, public;
revoke all on function public.website_link_whatsapp_refs_from_orders(int) from anon, authenticated, public;
revoke all on function public.website_whatsapp_ref_attribution(text) from anon, authenticated, public;
revoke all on function public.website_whatsapp_refs_purge() from anon, authenticated, public;

grant execute on function public.website_extract_whatsapp_ref(text) to service_role;
grant execute on function public.website_store_ad_click_ids(text, jsonb) to service_role;
grant execute on function public.website_create_whatsapp_ref(jsonb, jsonb) to service_role;
grant execute on function public.website_link_whatsapp_ref(text, uuid, text, text) to service_role;
grant execute on function public.website_link_whatsapp_refs_from_orders(int) to service_role;
grant execute on function public.website_whatsapp_ref_attribution(text) to service_role;
grant execute on function public.website_whatsapp_refs_purge() to service_role;

commit;

-- Suggested schedule after activation (pg_cron, Dhaka night), next to website_match_leads():
--   select cron.schedule('website-whatsapp-refs-link',  '40 21 * * *', $$select public.website_link_whatsapp_refs_from_orders(30)$$);
--   select cron.schedule('website-whatsapp-refs-purge', '45 21 * * *', $$select public.website_whatsapp_refs_purge()$$);
