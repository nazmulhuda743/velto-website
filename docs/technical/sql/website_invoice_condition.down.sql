-- Undo website_invoice_condition.sql: website_invoice_get() back to the 2026-11-13 body exactly (as read from staging and
-- production, md5 8a32aa6fb3f887effc50c33abb24884e), without 'condition'. The page shows no condition section then.
begin;
CREATE OR REPLACE FUNCTION public.website_invoice_get(p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  l public.website_invoice_links;
  o public.orders;
begin
  if p_code is null or p_code !~ '^[A-Za-z0-9_-]{8}$' then
    return jsonb_build_object('ok', false, 'reason', 'unknown');
  end if;
  select * into l from public.website_invoice_links where code = p_code;
  if l.code is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown');
  end if;
  select * into o from public.orders where id = l.order_id;
  if o.id is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown');
  end if;
  update public.website_invoice_links
     set opened_at = coalesce(opened_at, now()), open_count = open_count + 1
   where code = p_code;
  if coalesce(o.order_date, o.created_at::date) < current_date - 120 then
    return jsonb_build_object('ok', false, 'reason', 'expired', 'orderNumber', o.order_number);
  end if;
  return jsonb_build_object('ok', true) || public.portal_order_json(o) || jsonb_build_object(
    'firstName', public.portal_first_name((select c.name from public.customers c where c.id = o.customer_id)),
    'expressFee', coalesce(o.express_fee, 0),
    'lines', coalesce((
      select jsonb_agg(jsonb_build_object(
        'item', i.item_name, 'service', i.service_category, 'quantity', i.quantity,
        'price', coalesce(i.quoted_price, i.reference_price)
      ) order by i.created_at)
      from public.order_items i where i.order_id = o.id
    ), '[]'::jsonb),
    'payments', coalesce((
      select jsonb_agg(jsonb_build_object('amount', p.amount, 'method', p.method, 'on', p.paid_at) order by p.paid_at, p.created_at)
      from public.payments p where p.order_id = o.id
    ), '[]'::jsonb),
    'isFirst', o.customer_id is not null and not exists (
      select 1 from public.orders p
       where p.customer_id = o.customer_id and p.order_status is distinct from 'Cancelled'
         and (p.created_at < o.created_at or (p.created_at = o.created_at and p.id < o.id))),
    'servicesEver', case when o.customer_id is null then null else public.website_customer_mix(o.customer_id) end,
    'rating', (select f.rating from public.customer_order_feedback f where f.customer_id = o.customer_id and f.order_number = o.order_number),
    'asked', coalesce((
      select jsonb_agg(jsonb_build_object('kind', r.kind, 'service', r.service, 'weekday', r.weekday, 'window', r.time_window))
      from public.website_link_requests r where r.order_id = o.id
    ), '[]'::jsonb)
  );
end;
$function$;

revoke all on function public.website_invoice_get(text) from public, anon, authenticated;
grant execute on function public.website_invoice_get(text) to service_role;

do $$
begin
  if md5(pg_get_functiondef('public.website_invoice_get(text)'::regprocedure)) <> '8a32aa6fb3f887effc50c33abb24884e' then
    raise exception 'undo did not restore the 2026-11-13 body';
  end if;
end $$;

commit;
