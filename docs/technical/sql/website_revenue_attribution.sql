-- Velto Revenue Attribution V1 (docs/technical/REVENUE-ATTRIBUTION-DESIGN.md).
--
-- Website-owned objects in the same Supabase project as Velto Ops. Nothing here
-- writes to customers, orders, payments or tasks. Leads reference the Ops task
-- that website_create_request created; the phone number stays in Ops
-- (tasks.source_ref, customers.phone) and is never copied here.
--
-- Requires, in order:
--   1. docs/technical/sql/website_analytics.sql      (PR #19 analytics objects)
--   2. this file
--   3. docs/technical/sql/website_create_request.sql (inserts website_leads)
--
-- Status: applied to STAGING (ekgdefcdqcsqvpbqponv) only.

begin;

-- ---------------------------------------------------------------------------
-- 0. Schema contract: the Ops columns this file reads
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1
    from (values
      ('customers', 'id'), ('customers', 'phone'), ('customers', 'name'), ('customers', 'customer_code'),
      ('orders', 'id'), ('orders', 'order_number'), ('orders', 'customer_id'), ('orders', 'order_date'),
      ('orders', 'order_status'), ('orders', 'total_amount'), ('orders', 'created_at'),
      ('payments', 'order_id'), ('payments', 'amount'), ('payments', 'paid_at'),
      ('tasks', 'id'), ('tasks', 'order_number'), ('tasks', 'source_ref'), ('tasks', 'status'),
      ('tasks', 'description'), ('tasks', 'source'),
      ('website_analytics_events', 'session_id'), ('website_analytics_events', 'visitor_id')
    ) as req(tbl, col)
    where not exists (
      select 1 from information_schema.columns c
      where c.table_schema = 'public' and c.table_name = req.tbl and c.column_name = req.col
    )
  ) then
    raise exception 'website_revenue_attribution: Ops or analytics schema does not match the reviewed contract';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. Canonical attribution contract (shared with src/lib/attribution.ts)
-- ---------------------------------------------------------------------------
-- Strict allowlist. Values are trimmed, control characters rejected, lengths
-- bounded. Consent gates: advertising click ids survive only with Marketing
-- consent; the analytics session id only with Analytics consent.
create or replace function public.website_clean_attribution(p jsonb)
returns jsonb
language plpgsql
immutable
set search_path = pg_catalog, public
as $$
declare
  v_in jsonb := case when jsonb_typeof(p) = 'object' then p else '{}'::jsonb end;
  v_out jsonb := '{}'::jsonb;
  v_key text;
  v_val text;
  v_consent text;
  v_analytics boolean;
  v_marketing boolean;
begin
  -- Campaign text fields.
  foreach v_key in array array[
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
    'source', 'medium', 'campaign', 'content', 'ad', 'service'
  ] loop
    v_val := btrim(v_in->>v_key);
    if v_val <> '' and v_val !~ '[[:cntrl:]]' then
      v_out := v_out || jsonb_build_object(v_key, left(v_val, 256));
    end if;
  end loop;

  v_val := btrim(v_in->>'landing_page');
  if v_val ~ '^/' and v_val !~ '^//' and v_val !~ '[[:cntrl:][:space:]]' then
    v_out := v_out || jsonb_build_object('landing_page', left(split_part(split_part(v_val, '?', 1), '#', 1), 300));
  end if;

  v_val := lower(btrim(v_in->>'referrer'));
  if v_val ~ '^[a-z0-9.-]{1,120}$' then
    v_out := v_out || jsonb_build_object('referrer', v_val);
  end if;

  v_val := btrim(v_in->>'device');
  if v_val in ('mobile', 'tablet', 'desktop') then
    v_out := v_out || jsonb_build_object('device', v_val);
  end if;

  v_consent := btrim(v_in->>'consent');
  if v_consent is null or v_consent not in ('none', 'essential', 'analytics', 'marketing', 'analytics+marketing') then
    v_consent := 'none';
  end if;
  v_out := v_out || jsonb_build_object('consent', v_consent);
  v_analytics := v_consent in ('analytics', 'analytics+marketing');
  v_marketing := v_consent in ('marketing', 'analytics+marketing');

  if v_marketing then
    foreach v_key in array array['fbclid', 'fbc', 'fbp', 'gclid'] loop
      v_val := btrim(v_in->>v_key);
      if v_val <> '' and v_val !~ '[[:cntrl:][:space:]]' then
        v_out := v_out || jsonb_build_object(v_key, left(v_val, 256));
      end if;
    end loop;
  end if;

  v_val := lower(btrim(v_in->>'analytics_session'));
  if v_analytics and v_val ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    v_out := v_out || jsonb_build_object('analytics_session', v_val);
  end if;

  return v_out;
end;
$$;

-- Word-overlap check used only to raise a review flag, never to match.
create or replace function public.website_name_mismatch(p_a text, p_b text)
returns boolean
language sql
immutable
set search_path = pg_catalog, public
as $$
  with a as (
    select distinct t from regexp_split_to_table(lower(coalesce(p_a, '')), '[^[:alpha:]]+') t where length(t) >= 2
  ), b as (
    select distinct t from regexp_split_to_table(lower(coalesce(p_b, '')), '[^[:alpha:]]+') t where length(t) >= 2
  )
  select case
    when not exists (select 1 from a) or not exists (select 1 from b) then false
    else not exists (select 1 from a join b using (t))
  end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Leads: one row per website booking / quote (created by website_create_request)
-- ---------------------------------------------------------------------------
create table if not exists public.website_leads (
  id                   uuid primary key default gen_random_uuid(),
  created_at           timestamptz not null default now(),
  kind                 text not null check (kind in ('booking', 'quote')),
  task_id              uuid unique references public.tasks(id) on delete set null,
  reference            text not null unique check (reference ~ '^WEB-[A-Z0-9]{8}$'),
  service              text check (service ~ '^[a-z][a-z-]{1,39}$'),
  outlet_code          text check (char_length(outlet_code) <= 10),
  area_sector          smallint check (area_sector between 0 and 18), -- 1–18 = Uttara sector, 0 = outside
  consent              text not null check (consent in ('none', 'essential', 'analytics', 'marketing', 'analytics+marketing')),
  consent_analytics    boolean not null,
  consent_marketing    boolean not null,
  analytics_session_id uuid,
  device               text check (device in ('mobile', 'tablet', 'desktop')),
  -- last touch: the attribution sent with the submission
  utm_source text check (char_length(utm_source) <= 256),
  utm_medium text check (char_length(utm_medium) <= 256),
  utm_campaign text check (char_length(utm_campaign) <= 256),
  utm_content text check (char_length(utm_content) <= 256),
  utm_term text check (char_length(utm_term) <= 256),
  source text check (char_length(source) <= 256),
  medium text check (char_length(medium) <= 256),
  campaign text check (char_length(campaign) <= 256),
  content text check (char_length(content) <= 256),
  ad text check (char_length(ad) <= 256),
  landing_page text check (char_length(landing_page) <= 300),
  referrer_host text check (char_length(referrer_host) <= 120),
  click_id text check (click_id in ('fbclid', 'gclid')),         -- presence only, never the value
  -- first touch: earliest first-party session of the same anonymous visitor (≤ 90 days), analytics consent only
  ft_at timestamptz,
  ft_utm_source text, ft_utm_medium text, ft_utm_campaign text, ft_utm_content text,
  ft_landing_page text, ft_referrer_host text, ft_click_id text check (ft_click_id in ('fbclid', 'gclid')),
  check (consent_analytics = (consent in ('analytics', 'analytics+marketing'))),
  check (consent_marketing = (consent in ('marketing', 'analytics+marketing'))),
  check (consent_analytics or (analytics_session_id is null and ft_at is null)),
  check (consent_marketing or (click_id is null and ft_click_id is null))
);

create index if not exists website_leads_created_idx on public.website_leads (created_at desc);
create index if not exists website_analytics_events_visitor_idx
  on public.website_analytics_events (visitor_id, occurred_at);

-- ---------------------------------------------------------------------------
-- 3. Lead ↔ Ops customer links (reversible, audited)
-- ---------------------------------------------------------------------------
create table if not exists public.website_lead_customer_links (
  id            uuid primary key default gen_random_uuid(),
  lead_id       uuid not null references public.website_leads(id) on delete cascade,
  customer_id   uuid not null references public.customers(id) on delete cascade,
  order_id      uuid references public.orders(id) on delete set null,
  link_method   text not null check (link_method in ('staff_order_link', 'exact_phone', 'whatsapp_reference')),
  -- explicit: staff-linked order (no window) · primary: order inside the 7-day (booking) / 14-day (quote) window
  -- late: booking order on day 8–14 (reported separately) · pending: identified, window still open
  -- none: identified, window closed without a qualifying order
  window_kind   text not null check (window_kind in ('explicit', 'primary', 'late', 'pending', 'none')),
  status        text not null default 'active' check (status in ('active', 'confirmed', 'rejected', 'reversed')),
  name_mismatch boolean not null default false,
  conflict      text check (conflict in ('staff_link_other_customer', 'order_claimed_by_other_lead', 'multiple_identifiers')),
  linked_at     timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  reviewed_at   timestamptz,
  reviewed_by   text check (char_length(reviewed_by) <= 120),
  reversed_at   timestamptz,
  review_note   text check (char_length(review_note) <= 200),
  rule_version  smallint not null default 1
);

create unique index if not exists website_links_live_lead_uidx
  on public.website_lead_customer_links (lead_id) where status in ('active', 'confirmed');
create unique index if not exists website_links_live_order_uidx
  on public.website_lead_customer_links (order_id) where order_id is not null and status in ('active', 'confirmed');
create index if not exists website_links_customer_idx on public.website_lead_customer_links (customer_id);

create table if not exists public.website_attribution_audit (
  id        bigint generated always as identity primary key,
  at        timestamptz not null default now(),
  link_id   uuid,
  lead_id   uuid,
  action    text not null check (action in ('auto_link', 'auto_update', 'superseded', 'confirm', 'reject', 'reverse')),
  actor     text not null check (char_length(actor) <= 120),
  detail    text check (char_length(detail) <= 200)
);
create index if not exists website_attribution_audit_link_idx on public.website_attribution_audit (link_id, at desc);

-- ---------------------------------------------------------------------------
-- 4. Marketing spend (manual + CSV now; API imports later)
-- ---------------------------------------------------------------------------
create table if not exists public.website_marketing_spend (
  id              uuid primary key default gen_random_uuid(),
  spend_date      date not null,
  platform        text not null check (platform ~ '^[a-z0-9][a-z0-9_ .-]{0,39}$'),   -- utm_source vocabulary: facebook, instagram, google…
  medium          text check (char_length(medium) <= 60),
  campaign_name   text not null check (char_length(campaign_name) between 1 and 160),
  campaign_id     text check (char_length(campaign_id) <= 80),
  adset_name      text check (char_length(adset_name) <= 160),
  adset_id        text check (char_length(adset_id) <= 80),
  ad_name         text check (char_length(ad_name) <= 160),
  ad_id           text check (char_length(ad_id) <= 80),
  spend           numeric(14, 2) not null check (spend >= 0),
  currency        text not null default 'BDT' check (currency ~ '^[A-Z]{3}$'),
  spend_bdt       numeric(14, 2) not null check (spend_bdt >= 0),
  notes           text check (char_length(notes) <= 500),
  import_source   text not null default 'manual' check (import_source in ('manual', 'csv', 'meta_api', 'google_api')),
  import_batch_id uuid,
  external_key    text check (char_length(external_key) <= 200),   -- future API row identity
  created_at      timestamptz not null default now(),
  created_by      text not null check (char_length(created_by) <= 120),
  updated_at      timestamptz,
  updated_by      text check (char_length(updated_by) <= 120),
  deleted_at      timestamptz,
  deleted_by      text check (char_length(deleted_by) <= 120),
  check (currency <> 'BDT' or spend_bdt = spend)
);

-- One live row per day × platform × campaign × ad set × ad: re-imports and
-- double manual entry are rejected instead of double-counted.
create unique index if not exists website_spend_natural_uidx on public.website_marketing_spend (
  spend_date, lower(platform), lower(campaign_name),
  lower(coalesce(adset_id, adset_name, '')), lower(coalesce(ad_id, ad_name, ''))
) where deleted_at is null;
create unique index if not exists website_spend_external_uidx
  on public.website_marketing_spend (import_source, external_key) where external_key is not null and deleted_at is null;
create index if not exists website_spend_date_idx on public.website_marketing_spend (spend_date) where deleted_at is null;

-- Booking orders after day 7 (≤ 14) are late / assisted; quotes use the full 14 days.
create or replace function public.website_is_late_booking(p_kind text, p_order_date date, p_lead_date date)
returns boolean
language sql
immutable
set search_path = pg_catalog, public
as $$
  select p_kind = 'booking' and p_order_date > p_lead_date + 7;
$$;

-- ---------------------------------------------------------------------------
-- 5. Matching engine (deterministic; rule_version 1)
-- ---------------------------------------------------------------------------
-- Precedence: staff-linked order  >  (future) WhatsApp reference  >  exact phone.
-- Exact phone: tasks.source_ref (normalized 01XXXXXXXXX by website_create_request)
-- equals customers.phone (unique). The converted order is the customer's first
-- qualifying order (not Cancelled, total > 0) with order_date from the lead's
-- Dhaka date to +7 days (booking) / +14 days (quote), ordered by order_date,
-- created_at, id, and not already claimed by another live link. Booking orders
-- on day 8–14 are recorded as `late`. Leads are processed oldest first, so the
-- earliest lead wins a shared order. Admin rejections / reversals are respected.
create or replace function public.website_match_leads(p_lookback_days integer default 120)
returns jsonb
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_today   date := (now() at time zone 'Asia/Dhaka')::date;
  r         record;
  v_live    public.website_lead_customer_links%rowtype;
  v_has_live boolean;
  v_order_id uuid;
  v_order_date date;
  v_order_customer uuid;
  v_other   public.website_lead_customer_links%rowtype;
  v_phone_customer uuid;
  v_cust_name text;
  v_lead_date date;
  v_kind    text;
  v_conflict text;
  v_link_id uuid;
  v_linked  integer := 0;
  v_updated integer := 0;
  v_superseded integer := 0;
begin
  for r in
    select l.*, t.order_number as staff_order_number, t.source_ref as phone_key,
           (regexp_match(coalesce(t.description, ''), '^Name: (.+)$', 'n'))[1] as lead_name
    from public.website_leads l
    left join public.tasks t on t.id = l.task_id
    where l.created_at > now() - make_interval(days => greatest(p_lookback_days, 1))
    order by l.created_at, l.id
  loop
    select * into v_live from public.website_lead_customer_links
    where lead_id = r.id and status in ('active', 'confirmed');
    v_has_live := found;
    v_lead_date := (r.created_at at time zone 'Asia/Dhaka')::date;

    v_phone_customer := null;
    if r.phone_key ~ '^01[0-9]{9}$' then
      select id into v_phone_customer from public.customers where phone = r.phone_key;
    end if;

    -- ---- 1. Staff-linked order (explicit; no window) -----------------------
    if nullif(btrim(r.staff_order_number), '') is not null then
      v_order_id := null;
      v_order_customer := null;
      select o.id, o.customer_id into v_order_id, v_order_customer
      from public.orders o
      where o.order_number = btrim(r.staff_order_number)
        and o.customer_id is not null;

      if v_order_id is not null then
        if v_has_live and v_live.link_method = 'staff_order_link' and v_live.order_id is not distinct from v_order_id then
          continue;
        end if;
        -- An admin rejected or reversed this exact staff link: respect it.
        if exists (
          select 1 from public.website_lead_customer_links
          where lead_id = r.id and link_method = 'staff_order_link' and order_id = v_order_id
            and (status = 'rejected' or (status = 'reversed' and reviewed_by is not null))
        ) then
          continue;
        end if;

        -- Supersede a system link on this lead (e.g. an earlier exact-phone link).
        if v_has_live and v_live.reviewed_by is null then
          update public.website_lead_customer_links
             set status = 'reversed', reversed_at = now(), updated_at = now(), review_note = 'superseded_by_staff_link'
           where id = v_live.id;
          insert into public.website_attribution_audit (link_id, lead_id, action, actor, detail)
          values (v_live.id, r.id, 'superseded', 'system', 'staff_order_link');
          v_superseded := v_superseded + 1;
          v_has_live := false;
        elsif v_has_live then
          continue;  -- an admin-confirmed link stays until an admin changes it
        end if;

        -- The order may already be claimed by another lead's live link.
        select * into v_other from public.website_lead_customer_links
        where order_id = v_order_id and status in ('active', 'confirmed') and lead_id <> r.id;
        v_conflict := null;
        if found then
          if v_other.link_method = 'exact_phone' and v_other.reviewed_by is null then
            update public.website_lead_customer_links
               set status = 'reversed', reversed_at = now(), updated_at = now(), review_note = 'superseded_by_staff_link'
             where id = v_other.id;
            insert into public.website_attribution_audit (link_id, lead_id, action, actor, detail)
            values (v_other.id, v_other.lead_id, 'superseded', 'system', 'order_staff_linked_to_other_lead');
            v_superseded := v_superseded + 1;
          else
            v_conflict := 'order_claimed_by_other_lead';
          end if;
        end if;
        if v_conflict is null and v_phone_customer is not null and v_phone_customer <> v_order_customer then
          v_conflict := 'staff_link_other_customer';
        end if;

        select name into v_cust_name from public.customers where id = v_order_customer;
        insert into public.website_lead_customer_links
          (lead_id, customer_id, order_id, link_method, window_kind, name_mismatch, conflict)
        values (
          r.id, v_order_customer,
          case when v_conflict = 'order_claimed_by_other_lead' then null else v_order_id end,
          'staff_order_link',
          case when v_conflict = 'order_claimed_by_other_lead' then 'none' else 'explicit' end,
          public.website_name_mismatch(r.lead_name, v_cust_name),
          v_conflict
        )
        returning id into v_link_id;
        insert into public.website_attribution_audit (link_id, lead_id, action, actor, detail)
        values (v_link_id, r.id, 'auto_link', 'system', 'staff_order_link' || coalesce(':' || v_conflict, ''));
        v_linked := v_linked + 1;
        continue;
      end if;
      -- Staff order number not found / no customer: no link; surfaced in the review queue.
    end if;

    -- ---- 2. WhatsApp reference: not available in V1 ------------------------

    -- ---- 3. Exact phone -----------------------------------------------------
    if v_has_live and v_live.window_kind <> 'pending' then
      continue;  -- final
    end if;
    if v_phone_customer is null then
      continue;
    end if;
    if exists (
      select 1 from public.website_lead_customer_links
      where lead_id = r.id and link_method = 'exact_phone' and customer_id = v_phone_customer
        and (status = 'rejected' or (status = 'reversed' and reviewed_by is not null))
    ) then
      continue;
    end if;

    v_order_id := null;
    v_order_date := null;
    select o.id, o.order_date into v_order_id, v_order_date
    from public.orders o
    where o.customer_id = v_phone_customer
      and o.order_status <> 'Cancelled'
      and o.total_amount > 0
      and o.order_date >= v_lead_date
      and o.order_date <= v_lead_date + 14
      and not exists (
        select 1 from public.website_lead_customer_links k
        where k.order_id = o.id and k.status in ('active', 'confirmed') and k.lead_id <> r.id
      )
    order by o.order_date, o.created_at, o.id
    limit 1;

    if v_order_id is not null then
      v_kind := case when public.website_is_late_booking(r.kind, v_order_date, v_lead_date) then 'late' else 'primary' end;
    else
      v_kind := case when v_today > v_lead_date + 14 then 'none' else 'pending' end;
    end if;

    select name into v_cust_name from public.customers where id = v_phone_customer;

    if v_has_live then
      if v_live.window_kind = v_kind and v_live.order_id is not distinct from v_order_id then
        continue;
      end if;
      update public.website_lead_customer_links
         set order_id = v_order_id, window_kind = v_kind, updated_at = now(),
             name_mismatch = public.website_name_mismatch(r.lead_name, v_cust_name)
       where id = v_live.id;
      insert into public.website_attribution_audit (link_id, lead_id, action, actor, detail)
      values (v_live.id, r.id, 'auto_update', 'system', v_kind);
      v_updated := v_updated + 1;
    else
      insert into public.website_lead_customer_links
        (lead_id, customer_id, order_id, link_method, window_kind, name_mismatch)
      values (r.id, v_phone_customer, v_order_id, 'exact_phone', v_kind,
              public.website_name_mismatch(r.lead_name, v_cust_name))
      returning id into v_link_id;
      insert into public.website_attribution_audit (link_id, lead_id, action, actor, detail)
      values (v_link_id, r.id, 'auto_link', 'system', 'exact_phone:' || v_kind);
      v_linked := v_linked + 1;
    end if;
  end loop;

  return jsonb_build_object('linked', v_linked, 'updated', v_updated, 'superseded', v_superseded, 'ran_at', now());
end;
$$;



-- ---------------------------------------------------------------------------
-- 6. Review actions (admin, via the dashboard server)
-- ---------------------------------------------------------------------------
create or replace function public.website_review_link(p_link_id uuid, p_action text, p_actor text, p_note text default null)
returns jsonb
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_link public.website_lead_customer_links%rowtype;
  v_actor text := left(btrim(coalesce(p_actor, '')), 120);
begin
  if p_action not in ('confirm', 'reject', 'reverse') or v_actor = '' then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  select * into v_link from public.website_lead_customer_links where id = p_link_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_link.status not in ('active', 'confirmed') then
    return jsonb_build_object('ok', false, 'error', 'not_live');
  end if;

  update public.website_lead_customer_links
     set status = case p_action when 'confirm' then 'confirmed' when 'reject' then 'rejected' else 'reversed' end,
         reviewed_at = now(), reviewed_by = v_actor, updated_at = now(),
         reversed_at = case when p_action = 'confirm' then reversed_at else now() end,
         review_note = left(nullif(btrim(p_note), ''), 200)
   where id = p_link_id;
  insert into public.website_attribution_audit (link_id, lead_id, action, actor, detail)
  values (p_link_id, v_link.lead_id, p_action, v_actor, left(nullif(btrim(p_note), ''), 200));
  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Reporting (server-side, bounded by date; no PII beyond customer_code)
-- ---------------------------------------------------------------------------

-- Leads created in a Dhaka date range, with their link state.
create or replace function public.website_attribution_leads(p_from date, p_to date)
returns table (
  lead_id uuid, created_at timestamptz, kind text, service text, area_sector smallint, device text,
  consent text, has_session boolean,
  utm_source text, utm_medium text, utm_campaign text, utm_content text, source text, campaign text,
  landing_page text, referrer_host text, click_id text,
  ft_at timestamptz, ft_utm_source text, ft_utm_medium text, ft_utm_campaign text, ft_referrer_host text, ft_click_id text,
  link_method text, window_kind text, link_status text, name_mismatch boolean, conflict text, has_order boolean
)
language sql
stable
set search_path = pg_catalog, public
as $$
  select l.id, l.created_at, l.kind, l.service, l.area_sector, l.device, l.consent, l.analytics_session_id is not null,
         l.utm_source, l.utm_medium, l.utm_campaign, l.utm_content, l.source, l.campaign,
         l.landing_page, l.referrer_host, l.click_id,
         l.ft_at, l.ft_utm_source, l.ft_utm_medium, l.ft_utm_campaign, l.ft_referrer_host, l.ft_click_id,
         k.link_method, k.window_kind, k.status, coalesce(k.name_mismatch, false), k.conflict, k.order_id is not null
  from public.website_leads l
  left join public.website_lead_customer_links k on k.lead_id = l.id and k.status in ('active', 'confirmed')
  where l.created_at >= (p_from::timestamp at time zone 'Asia/Dhaka')
    and l.created_at < ((p_to + 1)::timestamp at time zone 'Asia/Dhaka')
  order by l.created_at desc
  limit 20000;
$$;

-- Attributed conversions whose attributed order falls in the range, with
-- classification and cohort revenue. Windows are measured from the attributed
-- order date; an unmatured window returns NULL (never 0).
create or replace function public.website_attribution_conversions(p_from date, p_to date)
returns table (
  link_id uuid, lead_id uuid, lead_kind text, lead_created_at timestamptz, service text, device text, consent text,
  link_method text, window_kind text, link_status text, name_mismatch boolean, conflict text,
  customer_id uuid, customer_ref text, order_id uuid, order_number text, order_date date,
  classification text,
  utm_source text, utm_medium text, utm_campaign text, utm_content text, source text, campaign text,
  landing_page text, referrer_host text, click_id text,
  ft_at timestamptz, ft_utm_source text, ft_utm_medium text, ft_utm_campaign text, ft_utm_content text, ft_referrer_host text, ft_click_id text,
  first_billed numeric, first_collected numeric,
  billed_30 numeric, billed_60 numeric, billed_90 numeric, billed_life numeric,
  collected_30 numeric, collected_60 numeric, collected_90 numeric, collected_life numeric,
  matured_30 boolean, matured_60 boolean, matured_90 boolean,
  order_count integer, repeat_customer boolean, days_to_second integer,
  repeat_30 boolean, repeat_60 boolean, repeat_90 boolean
)
language sql
stable
set search_path = pg_catalog, public
as $$
  with today as (select (now() at time zone 'Asia/Dhaka')::date d),
  conv as (
    select k.*, o.order_number, o.order_date, o.created_at as order_created_at, o.total_amount
    from public.website_lead_customer_links k
    join public.orders o on o.id = k.order_id
    where k.status in ('active', 'confirmed')
      and k.window_kind in ('explicit', 'primary', 'late')
      and o.order_status <> 'Cancelled' and o.total_amount > 0
      and o.order_date between p_from and p_to
  ),
  q as (  -- the customer's qualifying orders
    select o.id, o.customer_id, o.order_date, o.created_at, o.total_amount
    from public.orders o
    where o.order_status <> 'Cancelled' and o.total_amount > 0
      and o.customer_id in (select customer_id from conv)
  ),
  pay as (
    select p.order_id, p.amount, p.paid_at from public.payments p where p.order_id in (select id from q)
  )
  select
    c.id, c.lead_id, l.kind, l.created_at, l.service, l.device, l.consent,
    c.link_method, c.window_kind, c.status, c.name_mismatch, c.conflict,
    c.customer_id, cu.customer_code, c.order_id, c.order_number, c.order_date,
    case
      when prior.last_date is null then 'acquired'
      when prior.last_date >= c.order_date - 90 then 'existing'
      else 'reactivated'
    end,
    l.utm_source, l.utm_medium, l.utm_campaign, l.utm_content, l.source, l.campaign,
    l.landing_page, l.referrer_host, l.click_id,
    l.ft_at, l.ft_utm_source, l.ft_utm_medium, l.ft_utm_campaign, l.ft_utm_content, l.ft_referrer_host, l.ft_click_id,
    c.total_amount,
    coalesce((select sum(amount) from pay where pay.order_id = c.order_id), 0),
    case when c.order_date + 30 <= t.d then w.b30 end,
    case when c.order_date + 60 <= t.d then w.b60 end,
    case when c.order_date + 90 <= t.d then w.b90 end,
    w.blife,
    case when c.order_date + 30 <= t.d then w.c30 end,
    case when c.order_date + 60 <= t.d then w.c60 end,
    case when c.order_date + 90 <= t.d then w.c90 end,
    w.clife,
    c.order_date + 30 <= t.d, c.order_date + 60 <= t.d, c.order_date + 90 <= t.d,
    w.n, w.n >= 2, w.second_date - c.order_date,
    case when c.order_date + 30 <= t.d then coalesce(w.second_date < c.order_date + 30, false) end,
    case when c.order_date + 60 <= t.d then coalesce(w.second_date < c.order_date + 60, false) end,
    case when c.order_date + 90 <= t.d then coalesce(w.second_date < c.order_date + 90, false) end
  from conv c
  cross join today t
  join public.website_leads l on l.id = c.lead_id
  join public.customers cu on cu.id = c.customer_id
  left join lateral (
    select max(q.order_date) as last_date
    from q
    where q.customer_id = c.customer_id
      and (q.order_date < c.order_date or (q.order_date = c.order_date and q.created_at < c.order_created_at))
  ) prior on true
  left join lateral (
    select
      coalesce(sum(q.total_amount) filter (where q.order_date < c.order_date + 30), 0) b30,
      coalesce(sum(q.total_amount) filter (where q.order_date < c.order_date + 60), 0) b60,
      coalesce(sum(q.total_amount) filter (where q.order_date < c.order_date + 90), 0) b90,
      coalesce(sum(q.total_amount), 0) blife,
      coalesce((select sum(p.amount) from pay p join q q2 on q2.id = p.order_id
                where q2.customer_id = c.customer_id and q2.order_date >= c.order_date
                  and q2.order_date < c.order_date + 30 and p.paid_at < c.order_date + 30), 0) c30,
      coalesce((select sum(p.amount) from pay p join q q2 on q2.id = p.order_id
                where q2.customer_id = c.customer_id and q2.order_date >= c.order_date
                  and q2.order_date < c.order_date + 60 and p.paid_at < c.order_date + 60), 0) c60,
      coalesce((select sum(p.amount) from pay p join q q2 on q2.id = p.order_id
                where q2.customer_id = c.customer_id and q2.order_date >= c.order_date
                  and q2.order_date < c.order_date + 90 and p.paid_at < c.order_date + 90), 0) c90,
      coalesce((select sum(p.amount) from pay p join q q2 on q2.id = p.order_id
                where q2.customer_id = c.customer_id and q2.order_date >= c.order_date), 0) clife,
      count(*)::int n,
      (array_agg(q.order_date order by q.order_date, q.created_at))[2] second_date
    from q
    where q.customer_id = c.customer_id
      and (q.order_date > c.order_date or (q.order_date = c.order_date and q.created_at >= c.order_created_at))
  ) w on true
  order by c.order_date desc
  limit 20000;
$$;

-- Period coverage: every qualifying Ops order in the range is exactly one of
-- conversion / follow-on (attributed) or unattributed, so the parts reconcile.
create or replace function public.website_attribution_totals(p_from date, p_to date)
returns jsonb
language sql
stable
set search_path = pg_catalog, public
as $$
  with live as (
    select k.customer_id, k.order_id, k.window_kind, o.order_date as conv_date, o.created_at as conv_created
    from public.website_lead_customer_links k
    join public.orders o on o.id = k.order_id
    where k.status in ('active', 'confirmed') and k.window_kind in ('explicit', 'primary', 'late')
      and o.order_status <> 'Cancelled' and o.total_amount > 0
  ),
  eligible as (
    select o.id, o.customer_id, o.order_date, o.created_at, o.total_amount,
           coalesce((select sum(p.amount) from public.payments p where p.order_id = o.id), 0) as collected
    from public.orders o
    where o.order_status <> 'Cancelled' and o.total_amount > 0
      and o.order_date between p_from and p_to
  ),
  labelled as (
    select e.*,
      case
        when exists (select 1 from live where live.order_id = e.id and live.window_kind <> 'late') then 'conversion'
        when exists (select 1 from live where live.order_id = e.id and live.window_kind = 'late') then 'late'
        when exists (select 1 from live where live.customer_id = e.customer_id and live.window_kind <> 'late'
                      and (live.conv_date < e.order_date or (live.conv_date = e.order_date and live.conv_created < e.created_at)))
          then 'follow_on'
        else 'unattributed'
      end as label,
      not exists (
        select 1 from public.orders p
        where p.customer_id = e.customer_id and p.order_status <> 'Cancelled' and p.total_amount > 0
          and (p.order_date < e.order_date or (p.order_date = e.order_date and p.created_at < e.created_at))
      ) and e.customer_id is not null as is_first_order
    from eligible e
  )
  select jsonb_build_object(
    'orders', count(*),
    'billed', coalesce(sum(total_amount), 0),
    'collected', coalesce(sum(collected), 0),
    'customers', count(distinct customer_id),
    'orders_without_customer', count(*) filter (where customer_id is null),
    'conversion_orders', count(*) filter (where label = 'conversion'),
    'conversion_billed', coalesce(sum(total_amount) filter (where label = 'conversion'), 0),
    'late_orders', count(*) filter (where label = 'late'),
    'late_billed', coalesce(sum(total_amount) filter (where label = 'late'), 0),
    'follow_on_orders', count(*) filter (where label = 'follow_on'),
    'follow_on_billed', coalesce(sum(total_amount) filter (where label = 'follow_on'), 0),
    'unattributed_orders', count(*) filter (where label = 'unattributed'),
    'unattributed_billed', coalesce(sum(total_amount) filter (where label = 'unattributed'), 0),
    'attributed_collected', coalesce(sum(collected) filter (where label in ('conversion', 'follow_on')), 0),
    'attributed_customers', count(distinct customer_id) filter (where label in ('conversion', 'follow_on')),
    'new_customers', count(*) filter (where is_first_order),
    'attributed_new_customers', count(*) filter (where is_first_order and label = 'conversion'),
    'new_customer_billed', coalesce(sum(total_amount) filter (where is_first_order), 0),
    'attributed_new_customer_billed', coalesce(sum(total_amount) filter (where is_first_order and label = 'conversion'), 0)
  )
  from labelled;
$$;

-- Exceptional cases only. Normal exact-phone matches never appear here.
create or replace function public.website_attribution_review()
returns table (
  issue text, link_id uuid, lead_id uuid, lead_reference text, lead_kind text, lead_created_at timestamptz,
  link_method text, link_status text, customer_ref text, order_number text, staff_order_number text, detail text
)
language sql
stable
set search_path = pg_catalog, public
as $$
  select case when k.conflict is not null then k.conflict else 'name_mismatch' end,
         k.id, l.id, l.reference, l.kind, l.created_at, k.link_method, k.status, cu.customer_code, o.order_number,
         t.order_number, k.review_note
  from public.website_lead_customer_links k
  join public.website_leads l on l.id = k.lead_id
  join public.customers cu on cu.id = k.customer_id
  left join public.orders o on o.id = k.order_id
  left join public.tasks t on t.id = l.task_id
  where k.status = 'active' and (k.conflict is not null or k.name_mismatch)
  union all
  select 'staff_order_not_found', null, l.id, l.reference, l.kind, l.created_at, null, null, null, null, t.order_number, null
  from public.website_leads l
  join public.tasks t on t.id = l.task_id
  where nullif(btrim(t.order_number), '') is not null
    and not exists (select 1 from public.orders o where o.order_number = btrim(t.order_number) and o.customer_id is not null)
  union all
  -- Ops marked the task done, the window has closed, and nothing could be linked.
  select 'unresolved_lead', null, l.id, l.reference, l.kind, l.created_at, null, null, null, null, null,
         case when k.id is null then 'no_customer_with_this_phone' else 'no_order_in_window' end
  from public.website_leads l
  join public.tasks t on t.id = l.task_id
  left join public.website_lead_customer_links k on k.lead_id = l.id and k.status in ('active', 'confirmed')
  where t.status = 'done'
    and nullif(btrim(t.order_number), '') is null
    and (l.created_at at time zone 'Asia/Dhaka')::date + 14 < (now() at time zone 'Asia/Dhaka')::date
    and (k.id is null or k.window_kind = 'none')
    and l.created_at > now() - interval '120 days'
  order by 6 desc
  limit 500;
$$;

-- ---------------------------------------------------------------------------
-- Access: service_role only
-- ---------------------------------------------------------------------------
alter table public.website_leads enable row level security;
alter table public.website_lead_customer_links enable row level security;
alter table public.website_attribution_audit enable row level security;
alter table public.website_marketing_spend enable row level security;

revoke all on public.website_leads from anon, authenticated, public;
revoke all on public.website_lead_customer_links from anon, authenticated, public;
revoke all on public.website_attribution_audit from anon, authenticated, public;
revoke all on public.website_marketing_spend from anon, authenticated, public;

grant select, insert, update on public.website_leads to service_role;
grant select, insert, update on public.website_lead_customer_links to service_role;
grant select, insert on public.website_attribution_audit to service_role;
grant select, insert, update on public.website_marketing_spend to service_role;

do $$
declare f text;
begin
  foreach f in array array[
    'website_clean_attribution(jsonb)', 'website_name_mismatch(text, text)', 'website_is_late_booking(text, date, date)',
    'website_match_leads(integer)', 'website_review_link(uuid, text, text, text)',
    'website_attribution_leads(date, date)', 'website_attribution_conversions(date, date)',
    'website_attribution_totals(date, date)', 'website_attribution_review()'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end;
$$;

commit;

-- Nightly matching (production activation step, NOT run automatically):
--   select cron.schedule('website-match-leads', '30 21 * * *',   -- 03:30 Dhaka
--                        $$select public.website_match_leads()$$);
