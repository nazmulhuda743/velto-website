-- The customer's own pickup & delivery plan, from the dispatch board (website_dispatch.sql),
-- for the account: "Delivery: Tue 29 Sept, Evening (5–9 PM) · Rakib".
--
-- Same rules as customer_portal.sql: the caller is auth.uid() via portal_caller(); only a linked
-- customer gets rows, and only their own: deliveries by their orders' numbers, pickups by their
-- verified phone. Only planned stops (a day set) that are still open, from yesterday on.
-- Requires customer_portal.sql and website_dispatch.sql. Idempotent.
-- Status: applied on staging and on production (owner-approved, 2026-09-28).

begin;

create or replace function public.portal_dispatch_plans()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_acc public.customer_accounts;
  v_today date := (now() at time zone 'Asia/Dhaka')::date;
  v_key text;
begin
  v_acc := public.portal_caller();
  if v_acc.customer_id is null or v_acc.link_status <> 'linked' then
    return '[]'::jsonb;
  end if;
  v_key := public.website_dispatch_phone_key(v_acc.verified_phone);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'kind', j.kind,
      'orderNumber', j.order_number,
      'slotDate', j.slot_date,
      'slot', j.slot,
      'assigneeName', j.assignee_name
    ) order by j.slot_date, j.kind)
    from public.website_dispatch_jobs j
    where j.stage in ('assigned', 'scheduled')
      and j.slot_date is not null
      and j.slot_date >= v_today - 1
      and (
        (j.kind = 'delivery' and j.order_number is not null
          and exists (select 1 from public.orders o where o.order_number = j.order_number and o.customer_id = v_acc.customer_id))
        or (j.kind = 'pickup' and v_key is not null and j.phone_key = v_key)
      )
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.portal_dispatch_plans() from public, anon;
grant execute on function public.portal_dispatch_plans() to authenticated;

commit;
