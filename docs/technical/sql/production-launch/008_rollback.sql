-- SAFE EMERGENCY DATABASE ROLLBACK.
-- Run only after setting VELTO_OPS_WRITES_ENABLED=false in Vercel.
-- This file intentionally does NOT delete orders, tasks, website content,
-- uploaded media, price data, or limiter history.

-- Stop every website RPC from being callable by the website service role.
revoke execute on function public.website_create_request(text, text, jsonb) from service_role;
revoke execute on function public.website_track_order(text, text) from service_role;
revoke execute on function public.website_track_rate_limit(text, text) from service_role;
revoke execute on function public.website_launch_state() from service_role;

-- Keep anon/authenticated blocked explicitly.
revoke all on function public.website_create_request(text, text, jsonb) from public, anon, authenticated;
revoke all on function public.website_track_order(text, text) from public, anon, authenticated;
revoke all on function public.website_track_rate_limit(text, text) from public, anon, authenticated;
revoke all on function public.website_launch_state() from public, anon, authenticated;

-- The pricing view and website_content stay intact so read-only site recovery is
-- possible. To restore previous RPC behavior, use the definitions captured in
-- the launch change record before applying 004/005. Never reconstruct them from memory.

select
  'website RPC execution disabled; operational orders/tasks/content preserved' as rollback_status,
  now() as rolled_back_at;
