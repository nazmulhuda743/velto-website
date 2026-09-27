-- SMS sign-in codes: durable limits for the Supabase "Send SMS" hook and the website's
-- send-code action (src/lib/sms/limits.ts). Keys are SHA-256 hashes made by the website,
-- so no phone number or IP address is stored. Service-role only.
--
-- Limits per rolling hour window:
--   phone  : 5 codes per phone number
--   ip     : 10 code requests per requester IP (website action)
--   global : 300 codes for the whole site (ceiling on the SMS bill)
--   verify : 10 code checks per phone number (with 6 digits and a 5-minute code, guessing is hopeless)
--   photo  : 20 booking photo uploads per IP (docs/technical/sql/website_booking_photos.sql)
--
-- Idempotent; safe to re-run.

begin;

create table if not exists public.website_otp_rate_limits (
  bucket text not null check (bucket in ('phone', 'ip', 'global', 'verify', 'photo')),
  rate_key text not null check (rate_key ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz not null default now(),
  attempts integer not null default 0 check (attempts >= 0),
  updated_at timestamptz not null default now(),
  primary key (bucket, rate_key)
);
alter table public.website_otp_rate_limits enable row level security;
revoke all on public.website_otp_rate_limits from public, anon, authenticated, service_role;

create or replace function public.website_otp_rate_limit(p_bucket text, p_rate_key text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_limit integer;
  v_attempts integer;
  v_started timestamptz;
begin
  if p_bucket not in ('phone', 'ip', 'global', 'verify', 'photo') or p_rate_key !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  v_limit := case p_bucket when 'phone' then 5 when 'ip' then 10 when 'verify' then 10 when 'photo' then 20 else 300 end;

  insert into public.website_otp_rate_limits as rl (bucket, rate_key, window_started_at, attempts, updated_at)
  values (p_bucket, p_rate_key, now(), 1, now())
  on conflict (bucket, rate_key) do update
  set window_started_at = case when rl.window_started_at <= now() - interval '1 hour' then now() else rl.window_started_at end,
      attempts = case when rl.window_started_at <= now() - interval '1 hour' then 1 else least(rl.attempts + 1, 2147483647) end,
      updated_at = now()
  returning attempts, window_started_at into v_attempts, v_started;

  if random() < 0.02 then
    delete from public.website_otp_rate_limits where updated_at < now() - interval '1 day';
  end if;

  return jsonb_build_object(
    'ok', true,
    'allowed', v_attempts <= v_limit,
    'retry_after_seconds', case when v_attempts <= v_limit then 0
      else greatest(1, ceil(extract(epoch from ((v_started + interval '1 hour') - clock_timestamp())))::integer) end
  );
end;
$$;
revoke all on function public.website_otp_rate_limit(text, text) from public, anon, authenticated;
grant execute on function public.website_otp_rate_limit(text, text) to service_role;

-- Sign-in SMS failures show up in Command Center → Health.
alter table public.website_server_events drop constraint if exists website_server_events_kind_check;
alter table public.website_server_events add constraint website_server_events_kind_check check (kind in (
  'booking_error', 'quote_error', 'pricing_error', 'tracking_error',
  'not_found', 'media_upload_error', 'content_save_error', 'otp_error'));

commit;
