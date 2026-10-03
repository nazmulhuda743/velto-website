-- Account offer: how many website bookings the signed-in customer already has, so the website
-- can give 10% off the first three (src/lib/account-offer.ts) and word the Ops note
-- "Account booking 2 of 3". Counts the customer's website pickup tasks under their proven phone
-- (portal_verified_phone, website_customer_pickups.sql), leaving out bookings cancelled on the
-- dispatch board. Read only; customers never see other customers' counts.
--
-- Requires customer_portal.sql, website_customer_pickups.sql and website_dispatch.sql. Idempotent.

create or replace function public.portal_website_bookings()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int
  from public.tasks t
  left join public.website_dispatch_jobs j on j.task_id = t.id
  where t.source = 'website_booking'
    and t.source_ref = public.portal_verified_phone()
    and coalesce(j.stage, '') <> 'cancelled';
$$;

revoke all on function public.portal_website_bookings() from public, anon;
grant execute on function public.portal_website_bookings() to authenticated, service_role;

-- Status: applied to staging (ekgdefcdqcsqvpbqponv) 2026-10-03. Not applied to production.
