-- Admin dashboard content + order tracking. Applied to staging; apply to
-- production before switching the website to the production project.

create table if not exists public.website_content (
  key text primary key check (key ~ '^[a-z][a-z0-9_:.-]{0,63}$'),
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text
);
alter table public.website_content enable row level security;
revoke all on public.website_content from anon, authenticated, public;
grant select, insert, update, delete on public.website_content to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('website-media', 'website-media', true, 8388608, array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.website_track_order(p_order_number text, p_phone text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_raw text := upper(regexp_replace(coalesce(left(p_order_number, 32), ''), '[^A-Za-z0-9]', '', 'g'));
  v_digits text := regexp_replace(v_raw, '\D', '', 'g');
  v_candidates text[];
  v_phone_digits text := regexp_replace(coalesce(left(p_phone, 32), ''), '\D', '', 'g');
  v_phone text;
  o record;
begin
  if v_digits = '' or length(v_digits) > 7 or v_raw !~ '^(VELR?)?[0-9]+$' then
    return jsonb_build_object('found', false);
  end if;
  v_digits := lpad(v_digits::bigint::text, 5, '0');
  v_candidates := case
    when v_raw like 'VELR%' then array['VELR-' || v_digits]
    when v_raw like 'VEL%' then array['VEL-' || v_digits]
    else array['VEL-' || v_digits, 'VELR-' || v_digits] end;
  v_phone := case
    when v_phone_digits ~ '^8801[0-9]{9}$' then substr(v_phone_digits, 3)
    when v_phone_digits ~ '^008801[0-9]{9}$' then substr(v_phone_digits, 5)
    else v_phone_digits end;
  if v_phone !~ '^01[0-9]{9}$' then
    return jsonb_build_object('found', false);
  end if;

  select order_number, order_status, order_date, pickup_date, delivery_date, v2_promised_at,
         total_items, service_category, express, total_amount, due, payment_status, outlet_code, delivered_at
    into o
  from orders
  where order_number = any(v_candidates)
    and (case
          when regexp_replace(coalesce(phone_snapshot, ''), '\D', '', 'g') ~ '^8801[0-9]{9}$'
            then substr(regexp_replace(phone_snapshot, '\D', '', 'g'), 3)
          else regexp_replace(coalesce(phone_snapshot, ''), '\D', '', 'g') end) = v_phone
  order by created_at desc
  limit 1;

  if not found then
    return jsonb_build_object('found', false);
  end if;

  return jsonb_build_object('found', true, 'order', jsonb_build_object(
    'orderNumber', o.order_number, 'status', o.order_status, 'orderDate', o.order_date,
    'pickupDate', o.pickup_date, 'deliveryDate', o.delivery_date, 'promisedAt', o.v2_promised_at,
    'deliveredAt', o.delivered_at, 'items', o.total_items, 'services', o.service_category,
    'express', o.express, 'total', o.total_amount, 'due', o.due,
    'paymentStatus', o.payment_status, 'outlet', o.outlet_code
  ));
end;
$$;
revoke all on function public.website_track_order(text, text) from public, anon, authenticated;
grant execute on function public.website_track_order(text, text) to service_role;
