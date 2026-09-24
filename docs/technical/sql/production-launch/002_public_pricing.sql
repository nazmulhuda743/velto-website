-- Normalize the server-only public-safe pricing projection.
-- Does not modify price_list data.

create or replace view public.website_pricing_public
with (security_invoker = true)
as
select
  trim(both '-' from regexp_replace(lower(item_name), '[^a-z0-9]+', '-', 'g')) as item_slug,
  item_name,
  case service_category
    when 'Wash + Iron' then 'wash-and-iron'
    when 'Dry Cleaning' then 'dry-cleaning'
    when 'Ironing' then 'ironing'
    else null
  end as service_slug,
  case service_category
    when 'Wash + Iron' then 'Wash & Iron'
    else service_category
  end as service_name,
  case
    when price_type = 'poa' then null::integer
    else round(price * 100)::integer
  end as price_amount_minor,
  'BDT'::text as currency,
  case when unit = 'sqft' then 'per sq ft' else null::text end as unit_label
from public.price_list
where active and is_active;

-- Do not change operational price_list permissions here. The website reads the
-- projection with the server-side service role only.
revoke all on public.website_pricing_public from public, anon, authenticated, service_role;
grant select on public.website_pricing_public to service_role;
