-- Deliveries taken off the board stay off (website Command Center, /admin/dispatch).
--
-- A delivery job closed with a reason ("Customer will collect from the outlet", "Couldn't reach
-- the customer", ...) is not brought back by the next sync unless the order changes again in
-- Velto Ops after that (then it is worth another look). Before this, a closed delivery of an
-- order still Ready came straight back.
--
-- Requires website_dispatch_stages.sql. Service role only. Idempotent.
-- Status: applied and tested on staging; applied on production 2026-09-28.
--
-- SUPERSEDED for website_dispatch_sync(): website_today.sql now owns that function (weekly routine
-- pickups, one sync at a time, Ready orders from the last 30 days). Do not re-apply this file's
-- definition (nor the older ones in website_dispatch.sql / website_dispatch_stages.sql) after it.

begin;

create or replace function public.website_dispatch_sync()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_new_pickups integer;
  v_new_deliveries integer;
  v_closed integer;
  v_today date := (now() at time zone 'Asia/Dhaka')::date;
begin
  -- Website bookings and quotes from the last 30 days that aren't on the board yet.
  insert into public.website_dispatch_jobs (kind, task_id, source, customer_name, phone, phone_key, address, area, outlet_code, requested, stage, picked_at)
  select 'pickup', t.id, t.source,
         left(public.website_dispatch_line(t.description, 'Name'), 120),
         left(public.website_dispatch_line(t.description, 'Phone'), 32),
         coalesce(public.website_dispatch_phone_key(public.website_dispatch_line(t.description, 'Phone')), left(t.source_ref, 20)),
         left(public.website_dispatch_line(t.description, 'Address'), 500),
         left(public.website_dispatch_line(t.description, 'Area'), 120),
         t.outlet_code,
         left(public.website_dispatch_line(t.description, 'Preferred pickup'), 160),
         case when t.status = 'done' then 'picked' else 'new' end,
         case when t.status = 'done' then coalesce(t.done_at, now()) end
    from public.tasks t
   where t.source in ('website_booking', 'website_quote')
     and t.created_at > now() - interval '30 days'
     and not exists (select 1 from public.website_dispatch_jobs j where j.task_id = t.id);
  get diagnostics v_new_pickups = row_count;

  -- Orders that are Ready (or already out) with no live delivery job: only those that became
  -- Ready in the last 7 days or are due from yesterday on. Older ones are left to Ops.
  insert into public.website_dispatch_jobs (kind, order_number, source, customer_name, phone, phone_key, address, area, outlet_code, requested, stage)
  select 'delivery', o.order_number, 'ops_order',
         left(o.name_snapshot, 120), left(o.phone_snapshot, 32), public.website_dispatch_phone_key(o.phone_snapshot),
         left(o.address_snapshot, 500), left(o.zone_snapshot, 120), o.outlet_code,
         case when o.delivery_date is not null then 'Delivery date ' || to_char(o.delivery_date, 'Dy DD Mon') end,
         'new'
    from public.orders o
   where o.order_status in ('Ready', 'Out for Delivery')
     and o.order_number ~ '^VELR?-[0-9]{3,6}$'
     and (o.updated_at > now() - interval '7 days' or o.delivery_date >= v_today - 1)
     -- No live job, and none taken off the board since the order last changed in Ops.
     and not exists (
       select 1 from public.website_dispatch_jobs j
        where j.kind = 'delivery' and j.order_number = o.order_number
          and (j.stage not in ('cancelled', 'merged') or (j.stage = 'cancelled' and j.updated_at >= o.updated_at)));
  get diagnostics v_new_deliveries = row_count;

  -- Close jobs that Ops finished: order delivered or cancelled; pickup task done in Ops = picked.
  with closed as (
    update public.website_dispatch_jobs j
       set stage = case when o.order_status = 'Cancelled' then 'cancelled' else 'done' end,
           reason = case when o.order_status = 'Cancelled' then 'Order cancelled in Velto Ops' else j.reason end,
           history = j.history || jsonb_build_array(jsonb_build_object('at', now(), 'by', 'Velto Ops',
             'action', case when o.order_status = 'Cancelled' then 'cancelled' else 'delivered' end)),
           updated_at = now()
      from public.orders o
     where j.kind = 'delivery' and j.stage in ('new', 'confirmed', 'assigned', 'scheduled')
       and o.order_number = j.order_number and o.order_status in ('Delivered', 'Cancelled')
    returning j.id
  ), pickups as (
    update public.website_dispatch_jobs j
       set stage = 'picked',
           picked_at = coalesce(t.done_at, now()),
           history = j.history || jsonb_build_array(jsonb_build_object('at', now(), 'by', coalesce(t.done_by_name, 'Velto Ops'), 'action', 'picked up (done in Ops)')),
           updated_at = now()
      from public.tasks t
     where j.kind = 'pickup' and j.stage in ('new', 'confirmed', 'assigned', 'scheduled')
       and t.id = j.task_id and t.status = 'done'
    returning j.id
  )
  select (select count(*) from closed) + (select count(*) from pickups) into v_closed;

  -- A delivery that was done or cancelled closes its delivery task too.
  update public.tasks t
     set status = 'done', done_at = coalesce(t.done_at, now()), done_by_name = coalesce(t.done_by_name, 'Velto Ops')
    from public.website_dispatch_jobs j
   where j.kind = 'delivery' and j.task_id = t.id and j.stage in ('done', 'cancelled') and t.status <> 'done';

  return jsonb_build_object('pickups', v_new_pickups, 'deliveries', v_new_deliveries, 'closed', v_closed);
end;
$$;

revoke all on function public.website_dispatch_sync() from public, anon, authenticated;
grant execute on function public.website_dispatch_sync() to service_role;

commit;
