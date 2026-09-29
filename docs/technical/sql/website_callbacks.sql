-- Abandoned booking recovery, "Get a call back" (phase 5).
--
-- A visitor who gets stuck on the booking form can tap "Get a call back": only then are their name,
-- phone and what they had already filled in sent to Velto. (Nothing is collected from a form that is
-- simply left: the unsent booking stays as a draft in the visitor's own browser.) Staff see the
-- request on Command Center → Bookings & quotes → Call-back requests, call or WhatsApp once, and
-- close it with an outcome.
--
-- Written and read only by the website server (service role). Idempotent.
-- Status: applied to staging (tested) and production (2026-09-29).

begin;

create table if not exists public.website_callbacks (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  dedupe_key    text not null unique check (dedupe_key ~ '^[A-Za-z0-9._:-]{16,128}$'),
  name          text not null check (char_length(btrim(name)) between 2 and 100),
  phone         text not null check (phone ~ '^01[3-9][0-9]{8}$'),
  area          text check (area is null or char_length(area) <= 120),
  -- What they had filled in before asking (their own words and choices), for the call.
  what          text check (what is null or char_length(what) <= 300),
  services      text check (services is null or char_length(services) <= 120),
  preferred     text check (preferred is null or char_length(preferred) <= 120),
  -- Where they came from (the same allowlisted fields as a booking's attribution).
  utm_source    text check (utm_source is null or char_length(utm_source) <= 100),
  utm_medium    text check (utm_medium is null or char_length(utm_medium) <= 100),
  utm_campaign  text check (utm_campaign is null or char_length(utm_campaign) <= 150),
  landing_page  text check (landing_page is null or char_length(landing_page) <= 200),
  referrer_host text check (referrer_host is null or char_length(referrer_host) <= 120),
  device        text check (device is null or device in ('mobile', 'tablet', 'desktop')),
  status        text not null default 'open' check (status in ('open', 'done')),
  outcome       text check (outcome is null or outcome in ('booked', 'will_book', 'not_interested', 'no_answer', 'wrong_number', 'spam')),
  note          text check (note is null or char_length(note) <= 300),
  handled_by    text,
  handled_at    timestamptz
);

comment on table public.website_callbacks is
  'Website "Get a call back" requests from visitors stuck on the booking form. Sent only when the visitor taps the button.';

create index if not exists website_callbacks_open_idx on public.website_callbacks (created_at) where status = 'open';
create index if not exists website_callbacks_phone_idx on public.website_callbacks (phone, created_at);

alter table public.website_callbacks enable row level security;
revoke all on table public.website_callbacks from public, anon, authenticated;

-- Create one request. Same dedupe key → the same request (a retried tap). At most 3 per phone a day,
-- and a phone with an open request just gets that one back (no pile of duplicates for staff).
create or replace function public.website_callback_create(p_dedupe_key text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.website_callbacks;
  v_phone text := p_payload ->> 'phone';
  s text;
begin
  if p_dedupe_key is null or p_dedupe_key !~ '^[A-Za-z0-9._:-]{16,128}$' or v_phone is null or v_phone !~ '^01[3-9][0-9]{8}$' then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  select * into v_row from public.website_callbacks where dedupe_key = p_dedupe_key;
  if v_row.id is not null then return jsonb_build_object('ok', true, 'id', v_row.id, 'existing', true); end if;
  select * into v_row from public.website_callbacks where phone = v_phone and status = 'open' order by created_at desc limit 1;
  if v_row.id is not null then return jsonb_build_object('ok', true, 'id', v_row.id, 'existing', true); end if;
  if (select count(*) from public.website_callbacks where phone = v_phone and created_at > now() - interval '1 day') >= 3 then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;

  s := nullif(btrim(coalesce(p_payload ->> 'device', '')), '');
  insert into public.website_callbacks
    (dedupe_key, name, phone, area, what, services, preferred, utm_source, utm_medium, utm_campaign, landing_page, referrer_host, device)
  values
    (p_dedupe_key,
     left(btrim(p_payload ->> 'name'), 100), v_phone,
     left(nullif(btrim(coalesce(p_payload ->> 'area', '')), ''), 120),
     left(nullif(btrim(coalesce(p_payload ->> 'what', '')), ''), 300),
     left(nullif(btrim(coalesce(p_payload ->> 'services', '')), ''), 120),
     left(nullif(btrim(coalesce(p_payload ->> 'preferred', '')), ''), 120),
     left(nullif(btrim(coalesce(p_payload ->> 'utm_source', '')), ''), 100),
     left(nullif(btrim(coalesce(p_payload ->> 'utm_medium', '')), ''), 100),
     left(nullif(btrim(coalesce(p_payload ->> 'utm_campaign', '')), ''), 150),
     left(nullif(btrim(coalesce(p_payload ->> 'landing_page', '')), ''), 200),
     left(nullif(btrim(coalesce(p_payload ->> 'referrer_host', '')), ''), 120),
     case when s in ('mobile', 'tablet', 'desktop') then s end)
  returning * into v_row;
  return jsonb_build_object('ok', true, 'id', v_row.id, 'existing', false);
exception when check_violation then
  return jsonb_build_object('ok', false, 'error', 'invalid');
end;
$$;

-- Open requests (oldest first) and the last 14 days of handled ones, with how many Ops orders the
-- phone already has (a returning customer who got stuck is worth knowing about).
create or replace function public.website_callback_list()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(to_jsonb(x) order by x.status = 'open' desc, case when x.status = 'open' then x.created_at end asc, x.created_at desc), '[]'::jsonb)
    from (
      select c.id, c.created_at, c.name, c.phone, c.area, c.what, c.services, c.preferred,
             c.utm_source, c.utm_medium, c.utm_campaign, c.landing_page, c.referrer_host, c.device,
             c.status, c.outcome, c.note, c.handled_by, c.handled_at,
             (select count(*) from public.orders o
               where o.phone_snapshot = c.phone and o.order_status <> 'Cancelled') as orders
        from public.website_callbacks c
       where c.status = 'open' or c.handled_at > now() - interval '14 days'
       order by c.created_at desc
       limit 300
    ) x;
$$;

create or replace function public.website_callback_close(p_id uuid, p_outcome text, p_note text, p_actor text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.website_callbacks;
begin
  if p_outcome is null or p_outcome not in ('booked', 'will_book', 'not_interested', 'no_answer', 'wrong_number', 'spam') then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  select * into v_row from public.website_callbacks where id = p_id for update;
  if v_row.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if v_row.status <> 'open' then return jsonb_build_object('ok', false, 'error', 'closed'); end if;
  update public.website_callbacks
     set status = 'done', outcome = p_outcome, note = left(nullif(btrim(coalesce(p_note, '')), ''), 300),
         handled_by = left(nullif(btrim(coalesce(p_actor, '')), ''), 120), handled_at = now()
   where id = p_id;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.website_callback_create(text, jsonb) from public, anon, authenticated;
revoke all on function public.website_callback_list() from public, anon, authenticated;
revoke all on function public.website_callback_close(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.website_callback_create(text, jsonb) to service_role;
grant execute on function public.website_callback_list() to service_role;
grant execute on function public.website_callback_close(uuid, text, text, text) to service_role;

commit;
