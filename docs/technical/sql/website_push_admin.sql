-- Staff view of phone notifications (Admin → Customer accounts): which phones have them on, when
-- the last one was delivered to the push service, failures, and a "Send test notification" for one
-- phone. Requires website_push.sql. Service role only; the subscription keys never leave the server.
-- Idempotent. Applied to staging and production 2026-10-01.

begin;

-- Every saved phone/browser, newest first (no endpoint or keys).
create or replace function public.website_push_admin_list(p_limit integer default 100)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(q.x order by q.at desc), '[]'::jsonb)
  from (
    select s.updated_at as at, jsonb_build_object(
      'phone', s.phone, 'lang', s.lang, 'device', left(s.user_agent, 160), 'active', s.active,
      'orderUpdates', s.order_updates, 'reminders', s.reminders, 'failures', s.failures,
      'createdAt', s.created_at, 'lastSentAt', s.last_sent_at) as x
    from public.website_push_subs s
    order by s.updated_at desc
    limit least(greatest(coalesce(p_limit, 100), 1), 500)
  ) q
$$;

-- Where to send a test for one phone (01XXXXXXXXX): its active browsers, at most 5.
create or replace function public.website_push_targets_for_phone(p_phone text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth, 'lang', s.lang)), '[]'::jsonb)
  from (
    select * from public.website_push_subs
     where active and phone = public.website_dispatch_phone_key(p_phone)
     order by updated_at desc limit 5
  ) s
$$;

revoke all on function public.website_push_admin_list(integer) from public, anon, authenticated;
revoke all on function public.website_push_targets_for_phone(text) from public, anon, authenticated;
grant execute on function public.website_push_admin_list(integer) to service_role;
grant execute on function public.website_push_targets_for_phone(text) to service_role;

commit;
