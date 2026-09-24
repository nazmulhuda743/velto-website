-- Post-migration READ-ONLY verification. Expected public pricing fingerprint:
-- 1ca4d69df562cf967ab64902cb3f9f30

select public.website_launch_state() as website_launch_state;

select
  count(*) as pricing_rows,
  count(distinct item_slug) as distinct_items,
  count(*) filter (where price_amount_minor is null) as poa_rows,
  count(*) filter (where unit_label='per sq ft') as sqft_rows,
  md5(string_agg(
    concat_ws('|',item_slug,item_name,service_slug,service_name,
      coalesce(price_amount_minor::text,''),currency,coalesce(unit_label,'')),
    E'\n' order by item_slug,service_slug
  )) as public_fingerprint
from public.website_pricing_public;

select
  p.proname,
  p.prosecdef as security_definer,
  p.provolatile as volatility,
  p.proconfig as function_config,
  p.proacl as acl
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and p.proname in (
    'website_create_request','website_track_order','website_track_rate_limit','website_launch_state'
  )
order by p.proname;

select indexname,indexdef
from pg_catalog.pg_indexes
where schemaname='public'
  and ((tablename='tasks' and indexname='tasks_dedupe_uidx')
    or tablename='website_track_rate_limits')
order by tablename,indexname;

select id,name,public,file_size_limit,allowed_mime_types
from storage.buckets
where id='website-media';
