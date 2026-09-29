-- Smart upsell (phase 6): what Velto's customers actually send together, and what one customer
-- usually sends, read from Velto Ops orders. Read-only; no names or phone numbers leave the database
-- except to the service role for the staff card (which already shows the customer).
--
--   website_item_affinity()        service role  "Often sent with Shirt": item pairs from the last 180 days
--   portal_usual_items()           customer      "You usually send": the caller's own regular items
--   website_usual_items(phones[])  service role  "Usually sends": the same, per phone, for the booking cards
--
-- Garment services only (Dry Cleaning, Wash + Iron, Ironing): household items are quoted. Idempotent.
-- Status: applied to staging (tested) and production (2026-09-29).

begin;

-- For each item a customer sends (on a service), the items most often in the same order.
-- Only pairs seen in at least p_min_together orders and in at least p_min_share of the anchor's orders.
create or replace function public.website_item_affinity(p_days integer default 180, p_min_together integer default 8, p_min_share numeric default 0.15)
returns table (item text, service text, also_item text, also_service text, together integer, anchor_orders integer, share numeric)
language sql
stable
security definer
set search_path = ''
as $$
  with lines as (
    select distinct o.id as order_id, btrim(i.item_name) as item, i.service_category as service
      from public.order_items i
      join public.orders o on o.id = i.order_id
     where o.order_status <> 'Cancelled'
       and o.created_at > now() - make_interval(days => greatest(30, least(coalesce(p_days, 180), 730)))
       and i.service_category in ('Dry Cleaning', 'Wash + Iron', 'Ironing')
       and nullif(btrim(i.item_name), '') is not null
  ), anchors as (
    select item, service, count(*)::int as n from lines group by item, service
  ), pairs as (
    select a.item, a.service, b.item as also_item, b.service as also_service, count(*)::int as together
      from lines a
      join lines b on b.order_id = a.order_id and (b.item, b.service) <> (a.item, a.service)
     group by a.item, a.service, b.item, b.service
  ), ranked as (
    select p.*, x.n as anchor_orders, round(p.together::numeric / x.n, 3) as share,
           row_number() over (partition by p.item, p.service order by p.together desc, p.also_item) as rn
      from pairs p join anchors x on x.item = p.item and x.service = p.service
     where p.together >= greatest(3, coalesce(p_min_together, 8))
       and p.together::numeric / x.n >= greatest(0.05, coalesce(p_min_share, 0.15))
  )
  select item, service, also_item, also_service, together, anchor_orders, share
    from ranked where rn <= 4
   order by anchor_orders desc, item, service, rn;
$$;

-- Items in at least 2 of a customer's last 10 orders (most frequent first), on the service they used.
create or replace function public.website_usual_items_for(p_customer uuid, p_phone text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with recent as (
    select o.id from public.orders o
     where o.order_status <> 'Cancelled'
       and ((p_customer is not null and o.customer_id = p_customer) or (p_customer is null and p_phone is not null and o.phone_snapshot = p_phone))
     order by o.created_at desc
     limit 10
  ), counted as (
    select btrim(i.item_name) as item, i.service_category as service, count(distinct i.order_id)::int as orders
      from public.order_items i join recent r on r.id = i.order_id
     where i.service_category in ('Dry Cleaning', 'Wash + Iron', 'Ironing') and nullif(btrim(i.item_name), '') is not null
     group by 1, 2
    having count(distinct i.order_id) >= 2
  )
  select coalesce(jsonb_agg(jsonb_build_object('item', item, 'service', service, 'orders', orders) order by orders desc, item), '[]'::jsonb)
    from (select * from counted order by orders desc, item limit 6) t;
$$;

create or replace function public.portal_usual_items()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_acc public.customer_accounts;
begin
  v_acc := public.portal_caller();
  if v_acc.customer_id is null or v_acc.link_status <> 'linked' then return '[]'::jsonb; end if;
  return public.website_usual_items_for(v_acc.customer_id, null);
end;
$$;

create or replace function public.website_usual_items(p_phones text[])
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(p, public.website_usual_items_for(null, p)), '{}'::jsonb)
    from (select distinct unnest(p_phones[1:200]) as p) x
   where p ~ '^01[3-9][0-9]{8}$';
$$;

revoke all on function public.website_item_affinity(integer, integer, numeric) from public, anon, authenticated;
revoke all on function public.website_usual_items_for(uuid, text) from public, anon, authenticated;
revoke all on function public.portal_usual_items() from public, anon;
revoke all on function public.website_usual_items(text[]) from public, anon, authenticated;
grant execute on function public.website_item_affinity(integer, integer, numeric) to service_role;
grant execute on function public.portal_usual_items() to authenticated;
grant execute on function public.website_usual_items(text[]) to service_role;

commit;
