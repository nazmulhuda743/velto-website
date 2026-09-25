-- Velto Website Command Center — first-party analytics, consent and health.
--
-- Same Supabase project as Velto Ops; website-owned tables only. Nothing here
-- stores a name, phone, email, raw IP, precise location or form content.
-- Every object is service_role only: the browser never reads or writes these
-- tables directly (writes go through /api/collect, reads through /admin).
--
-- Retention (see docs/technical/COMMAND-CENTER.md):
--   raw behavioral events ............ 90 days
--   daily aggregates .................. 25 months
--   consent decisions ................. 13 months
--   server/health events .............. 90 days
--
-- Status: applied to STAGING (ekgdefcdqcsqvpbqponv) for testing only.
-- Do not apply to production until the production activation plan is approved.

begin;

-- ---------------------------------------------------------------------------
-- 1. Raw behavioral events (analytics consent only)
-- ---------------------------------------------------------------------------
create table if not exists public.website_analytics_events (
  id              bigint generated always as identity primary key,
  occurred_at     timestamptz not null default now(),
  visitor_id      uuid not null,                  -- random, first-party, per browser
  session_id      uuid not null,                  -- random, 30-minute inactivity window
  event           text not null check (event ~ '^[a-z][a-z_]{2,39}$'),
  path            text not null check (path ~ '^/' and char_length(path) <= 300),
  service         text check (char_length(service) <= 60),
  placement       text check (char_length(placement) <= 60),
  detail          text check (char_length(detail) <= 80),   -- e.g. selected price item slug; never free text
  landing_page    text check (char_length(landing_page) <= 300),
  referrer_host   text check (char_length(referrer_host) <= 120), -- host only, never the full URL
  utm_source      text check (char_length(utm_source) <= 120),
  utm_medium      text check (char_length(utm_medium) <= 120),
  utm_campaign    text check (char_length(utm_campaign) <= 120),
  utm_content     text check (char_length(utm_content) <= 120),
  utm_term        text check (char_length(utm_term) <= 120),
  click_id        text check (click_id in ('fbclid', 'gclid')), -- presence only, never the value
  device          text not null check (device in ('mobile', 'tablet', 'desktop')),
  is_new_visitor  boolean not null default false,
  consent_marketing boolean not null default false
);

create index if not exists website_analytics_events_occurred_idx
  on public.website_analytics_events (occurred_at desc);
create index if not exists website_analytics_events_session_idx
  on public.website_analytics_events (session_id, occurred_at);
create index if not exists website_analytics_events_event_idx
  on public.website_analytics_events (event, occurred_at desc);

-- ---------------------------------------------------------------------------
-- 2. Consent decisions (anonymous; no visitor or session id)
-- ---------------------------------------------------------------------------
create table if not exists public.website_consent_events (
  id              bigint generated always as identity primary key,
  occurred_at     timestamptz not null default now(),
  action          text not null check (action in ('banner_view', 'accept_all', 'reject_nonessential', 'preferences_saved')),
  analytics       boolean not null default false,
  marketing       boolean not null default false,
  policy_version  smallint not null check (policy_version between 1 and 999),
  device          text not null check (device in ('mobile', 'tablet', 'desktop'))
);

create index if not exists website_consent_events_occurred_idx
  on public.website_consent_events (occurred_at desc);

-- ---------------------------------------------------------------------------
-- 3. Server / website health events (no identifiers, no payloads)
-- ---------------------------------------------------------------------------
create table if not exists public.website_server_events (
  id              bigint generated always as identity primary key,
  occurred_at     timestamptz not null default now(),
  kind            text not null check (kind in (
                    'booking_error', 'quote_error', 'pricing_error', 'tracking_error',
                    'not_found', 'media_upload_error', 'content_save_error')),
  route           text check (char_length(route) <= 120),
  code            text check (char_length(code) <= 60),
  path            text check (char_length(path) <= 300)
);

create index if not exists website_server_events_occurred_idx
  on public.website_server_events (kind, occurred_at desc);

-- ---------------------------------------------------------------------------
-- 4. Health check memory (last successful check per dashboard check)
-- ---------------------------------------------------------------------------
create table if not exists public.website_health_checks (
  check_id        text primary key check (check_id ~ '^[a-z][a-z_]{2,39}$'),
  status          text not null check (status in ('healthy', 'warning', 'error')),
  last_checked_at timestamptz not null default now(),
  last_ok_at      timestamptz
);

-- ---------------------------------------------------------------------------
-- 5. Daily aggregates (long-term reporting after raw events expire)
-- ---------------------------------------------------------------------------
create table if not exists public.website_analytics_daily (
  day             date not null,
  event           text not null,
  path            text not null default '',
  service         text not null default '',
  device          text not null default '',
  utm_source      text not null default '',
  utm_medium      text not null default '',
  utm_campaign    text not null default '',
  referrer_host   text not null default '',
  events          integer not null default 0,
  sessions        integer not null default 0,
  visitors        integer not null default 0,
  primary key (day, event, path, service, device, utm_source, utm_medium, utm_campaign, referrer_host)
);

-- ---------------------------------------------------------------------------
-- Access: service_role only
-- ---------------------------------------------------------------------------
alter table public.website_analytics_events enable row level security;
alter table public.website_consent_events  enable row level security;
alter table public.website_server_events   enable row level security;
alter table public.website_health_checks   enable row level security;
alter table public.website_analytics_daily enable row level security;

revoke all on public.website_analytics_events from anon, authenticated, public;
revoke all on public.website_consent_events  from anon, authenticated, public;
revoke all on public.website_server_events   from anon, authenticated, public;
revoke all on public.website_health_checks   from anon, authenticated, public;
revoke all on public.website_analytics_daily from anon, authenticated, public;

grant select, insert, delete on public.website_analytics_events to service_role;
grant select, insert, delete on public.website_consent_events  to service_role;
grant select, insert, delete on public.website_server_events   to service_role;
grant select, insert, update, delete on public.website_health_checks   to service_role;
grant select, insert, update, delete on public.website_analytics_daily to service_role;

-- ---------------------------------------------------------------------------
-- Read model: one compact row per session in a time window.
-- The dashboard aggregates these in the server (src/lib/admin/insights.ts).
-- ---------------------------------------------------------------------------
create or replace function public.website_analytics_sessions(
  p_from  timestamptz,
  p_to    timestamptz,
  p_limit integer default 20000
)
returns table (
  session_id     uuid,
  visitor_id     uuid,
  started_at     timestamptz,
  ended_at       timestamptz,
  is_new         boolean,
  device         text,
  landing_page   text,
  referrer_host  text,
  utm_source     text,
  utm_medium     text,
  utm_campaign   text,
  utm_content    text,
  utm_term       text,
  click_id       text,
  marketing      boolean,
  event_count    integer,
  pageviews      integer,
  paths          text[],
  events_seen    text[],
  services       text[],
  searches       text[]
)
language sql
stable
set search_path = public, pg_temp
as $$
  with scoped as (
    select *
    from website_analytics_events e
    where e.occurred_at >= p_from and e.occurred_at < p_to
  ),
  firsts as (
    select distinct on (s.session_id) s.*
    from scoped s
    order by s.session_id, s.occurred_at, s.id
  )
  select
    f.session_id,
    f.visitor_id,
    min(s.occurred_at),
    max(s.occurred_at),
    bool_or(s.is_new_visitor),
    f.device,
    coalesce(f.landing_page, f.path),
    f.referrer_host,
    f.utm_source, f.utm_medium, f.utm_campaign, f.utm_content, f.utm_term,
    f.click_id,
    bool_or(s.consent_marketing),
    count(*)::int,
    (count(*) filter (where s.event = 'page_view'))::int,
    (array_agg(s.path order by s.occurred_at, s.id) filter (where s.event = 'page_view'))[1:15],
    array_agg(distinct s.event),
    coalesce(array_agg(distinct s.service) filter (where s.service is not null), '{}'),
    coalesce((array_agg(s.detail order by s.occurred_at) filter (where s.event = 'pricing_search' and s.detail is not null))[1:10], '{}')
  from scoped s
  join firsts f using (session_id)
  group by f.session_id, f.visitor_id, f.device, f.landing_page, f.path, f.referrer_host,
           f.utm_source, f.utm_medium, f.utm_campaign, f.utm_content, f.utm_term, f.click_id
  order by min(s.occurred_at) desc
  limit least(greatest(p_limit, 1), 50000);
$$;

-- Tracking health: when did each important signal last arrive?
create or replace function public.website_analytics_health()
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'last_event_at',           (select max(occurred_at) from website_analytics_events),
    'last_page_view_at',       (select max(occurred_at) from website_analytics_events where event = 'page_view'),
    'last_booking_success_at', (select max(occurred_at) from website_analytics_events where event = 'booking_success'),
    'last_quote_success_at',   (select max(occurred_at) from website_analytics_events where event = 'quote_success'),
    'last_consent_at',         (select max(occurred_at) from website_consent_events where action <> 'banner_view'),
    'events_24h',              (select count(*) from website_analytics_events where occurred_at > now() - interval '24 hours'),
    'marketing_events_24h',    (select count(*) from website_analytics_events where occurred_at > now() - interval '24 hours' and consent_marketing)
  );
$$;

-- Consent decisions in a window.
create or replace function public.website_consent_summary(p_from timestamptz, p_to timestamptz)
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'banner_views',        count(*) filter (where action = 'banner_view'),
    'decisions',           count(*) filter (where action <> 'banner_view'),
    'accept_all',          count(*) filter (where action = 'accept_all'),
    'reject_nonessential', count(*) filter (where action = 'reject_nonessential'),
    'custom',              count(*) filter (where action = 'preferences_saved'),
    'analytics_granted',   count(*) filter (where action <> 'banner_view' and analytics),
    'marketing_granted',   count(*) filter (where action <> 'banner_view' and marketing),
    'by_device',           coalesce((
      select jsonb_object_agg(device, n) from (
        select device, count(*) n from website_consent_events
        where occurred_at >= p_from and occurred_at < p_to and action <> 'banner_view'
        group by device) d), '{}'::jsonb)
  )
  from website_consent_events
  where occurred_at >= p_from and occurred_at < p_to;
$$;

-- Roll one Dhaka calendar day of raw events into daily aggregates (idempotent).
create or replace function public.website_analytics_rollup(p_day date)
returns integer
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_rows integer;
  v_from timestamptz := (p_day::timestamp at time zone 'Asia/Dhaka');
  v_to   timestamptz := ((p_day + 1)::timestamp at time zone 'Asia/Dhaka');
begin
  delete from website_analytics_daily where day = p_day;
  insert into website_analytics_daily
    (day, event, path, service, device, utm_source, utm_medium, utm_campaign, referrer_host, events, sessions, visitors)
  select p_day, e.event, e.path, coalesce(e.service, ''), e.device,
         coalesce(e.utm_source, ''), coalesce(e.utm_medium, ''), coalesce(e.utm_campaign, ''), coalesce(e.referrer_host, ''),
         count(*), count(distinct e.session_id), count(distinct e.visitor_id)
  from website_analytics_events e
  where e.occurred_at >= v_from and e.occurred_at < v_to
  group by 1, 2, 3, 4, 5, 6, 7, 8, 9;
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

-- Retention: roll up yesterday, then delete expired rows. Safe to run daily.
create or replace function public.website_analytics_purge()
returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_today  date := (now() at time zone 'Asia/Dhaka')::date;
  v_raw    integer;
  v_consent integer;
  v_server integer;
  v_daily  integer;
  v_day    date;
begin
  -- Make sure every day about to expire has been aggregated first.
  for v_day in
    select distinct (occurred_at at time zone 'Asia/Dhaka')::date
    from website_analytics_events
    where occurred_at < now() - interval '89 days'
  loop
    perform website_analytics_rollup(v_day);
  end loop;
  perform website_analytics_rollup(v_today - 1);

  delete from website_analytics_events where occurred_at < now() - interval '90 days';
  get diagnostics v_raw = row_count;
  delete from website_consent_events where occurred_at < now() - interval '13 months';
  get diagnostics v_consent = row_count;
  delete from website_server_events where occurred_at < now() - interval '90 days';
  get diagnostics v_server = row_count;
  delete from website_analytics_daily where day < v_today - interval '25 months';
  get diagnostics v_daily = row_count;

  return jsonb_build_object('raw_events', v_raw, 'consent_events', v_consent, 'server_events', v_server, 'daily_rows', v_daily);
end;
$$;

revoke all on function public.website_analytics_sessions(timestamptz, timestamptz, integer) from public, anon, authenticated;
revoke all on function public.website_analytics_health() from public, anon, authenticated;
revoke all on function public.website_consent_summary(timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.website_analytics_rollup(date) from public, anon, authenticated;
revoke all on function public.website_analytics_purge() from public, anon, authenticated;

grant execute on function public.website_analytics_sessions(timestamptz, timestamptz, integer) to service_role;
grant execute on function public.website_analytics_health() to service_role;
grant execute on function public.website_consent_summary(timestamptz, timestamptz) to service_role;
grant execute on function public.website_analytics_rollup(date) to service_role;
grant execute on function public.website_analytics_purge() to service_role;

commit;

-- Daily retention job (production activation step, NOT run automatically):
--   select cron.schedule('website-analytics-retention', '15 21 * * *',  -- 03:15 Dhaka
--                        $$select public.website_analytics_purge()$$);
