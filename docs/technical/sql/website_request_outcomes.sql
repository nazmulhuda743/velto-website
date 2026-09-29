-- What happened after each website request (Command Center → Funnel, "After the request").
--
-- One row per website booking or quote (website_leads) in a Dhaka date range, with where it got:
--   picked     the request's pickup was collected: its dispatch job is "picked" (or "done"),
--              or an Ops order is linked to it
--   order      the Ops order made from it: the one staff linked on the booking card
--              (website_dispatch_stages.sql), else the attribution link (website_revenue_attribution.sql)
--   delivered  that order is Delivered in Velto Ops
--   ordered_again  the same customer placed another order (not cancelled) after that one
--   returning_customer  the customer already had an order before the request (existing vs new customer)
-- plus the request's source fields, for "by source". Read-only; no names or phone numbers leave
-- the database. Requires website_revenue_attribution.sql and website_dispatch_stages.sql.
-- Service role only. Idempotent.
-- Status: applied to staging and production (2026-09-28).

begin;

create or replace function public.website_request_outcomes(p_from date, p_to date)
returns table (
  lead_id uuid, created_at timestamptz, kind text, service text, device text,
  utm_source text, utm_medium text, utm_campaign text, referrer_host text, click_id text, landing_page text,
  cancelled boolean, picked boolean, order_number text, delivered boolean, ordered_again boolean, returning_customer boolean
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with leads as (
    select l.*
      from public.website_leads l
     where l.created_at >= (p_from::timestamp at time zone 'Asia/Dhaka')
       and l.created_at < ((p_to + 1)::timestamp at time zone 'Asia/Dhaka')
     order by l.created_at desc
     limit 5000
  ), joined as (
    select l.*, j.stage, j.phone_key,
           coalesce(o1.id, o2.id) as order_id,
           coalesce(o1.order_number, o2.order_number) as order_no,
           coalesce(o1.order_status, o2.order_status) as order_status,
           coalesce(o1.customer_id, o2.customer_id) as customer_id,
           coalesce(o1.created_at, o2.created_at) as order_created_at
      from leads l
      left join public.website_dispatch_jobs j on j.task_id = l.task_id and j.kind = 'pickup'
      left join public.orders o1 on o1.order_number = j.order_number
      left join public.website_lead_customer_links k on k.lead_id = l.id and k.status in ('active', 'confirmed') and k.order_id is not null
      left join public.orders o2 on o2.id = k.order_id and o1.id is null
  )
  select x.id, x.created_at, x.kind, x.service, x.device,
         x.utm_source, x.utm_medium, x.utm_campaign, x.referrer_host, x.click_id, x.landing_page,
         coalesce(x.stage in ('cancelled', 'merged'), false),
         coalesce(x.stage in ('picked', 'done'), false) or x.order_id is not null,
         x.order_no,
         coalesce(x.order_status = 'Delivered', false),
         x.order_id is not null and exists (
           select 1 from public.orders o
            where o.customer_id = x.customer_id and o.id <> x.order_id
              and o.created_at > x.order_created_at and o.order_status <> 'Cancelled'),
         case
           when x.customer_id is not null then exists (
             select 1 from public.orders o
              where o.customer_id = x.customer_id and o.created_at < x.created_at - interval '1 day' and o.order_status <> 'Cancelled')
           when x.phone_key is not null then exists (
             select 1 from public.orders o
              where o.phone_snapshot = x.phone_key and o.created_at < x.created_at - interval '1 day' and o.order_status <> 'Cancelled')
           else null
         end
    from joined x
   order by x.created_at desc;
$$;

revoke all on function public.website_request_outcomes(date, date) from public, anon, authenticated;
grant execute on function public.website_request_outcomes(date, date) to service_role;

commit;
