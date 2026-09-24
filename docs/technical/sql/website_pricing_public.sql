-- Public-safe pricing projection for the Velto website.
-- Audited against production and staging on 2026-09-25.
--
-- The website reads this view server-side with the Supabase secret/service role
-- key. The browser never receives that key and never queries price_list directly.
-- The view deliberately exposes only the seven fields validated by
-- src/lib/integrations/pricing/validation.ts.

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
  case
    when unit = 'sqft' then 'per sq ft'
    else null::text
  end as unit_label
from public.price_list
where active and is_active;

-- Supabase 2026 Data API defaults require explicit grants. Keep the underlying
-- operational table private from website callers and expose the projection only
-- to the server-side service role.
grant select on public.price_list to service_role;
revoke all on public.website_pricing_public from public, anon, authenticated, service_role;
grant select on public.website_pricing_public to service_role;
