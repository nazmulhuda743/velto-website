-- READ-ONLY REPORT (no changes). Orders whose status times were recorded more than 30 days after
-- the order date: old orders bulk-marked Delivered (or another status) long after the fact.
-- The customer app hides these times (src/lib/customer/app-logic.ts, trustedAt) so customers
-- don't see "Returned Mon 8 Jun, 4:17 AM" on a January order. Ops should correct the real dates.
--
-- Run in the Supabase SQL editor (production). Nothing is written.

with late as (
  select
    o.order_number,
    o.order_date,
    o.order_status,
    o.delivered_at,
    h.new_status,
    h.changed_at
  from public.orders o
  join public.order_status_history h on h.order_id = o.id
  where h.changed_at > (o.order_date::date + interval '30 days')
)
select
  order_number,
  order_date,
  order_status,
  delivered_at,
  string_agg(new_status || ' at ' || to_char(changed_at at time zone 'Asia/Dhaka', 'YYYY-MM-DD HH24:MI'), '; ' order by changed_at) as late_status_times
from late
group by order_number, order_date, order_status, delivered_at
union all
-- Delivered times on the order itself that are more than 30 days after the order date.
select o.order_number, o.order_date, o.order_status, o.delivered_at, 'delivered_at only'
from public.orders o
where o.delivered_at > (o.order_date::date + interval '30 days')
  and not exists (
    select 1 from public.order_status_history h
    where h.order_id = o.id and h.changed_at > (o.order_date::date + interval '30 days')
  )
order by order_date;
