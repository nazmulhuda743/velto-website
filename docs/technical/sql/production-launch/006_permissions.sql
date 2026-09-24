-- Final website-object permissions plus a service-role-only READ-ONLY launch-state RPC.
-- website_launch_state is STABLE and performs catalog SELECTs only, allowing the
-- external verifier to inspect ACL/index/search-path state without a DB URL.

revoke all on public.website_pricing_public from public, anon, authenticated, service_role;
grant select on public.website_pricing_public to service_role;

revoke all on public.website_content from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.website_content to service_role;

revoke all on public.website_track_rate_limits from public, anon, authenticated, service_role;

revoke all on function public.website_create_request(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.website_create_request(text, text, jsonb) to service_role;
revoke all on function public.website_track_order(text, text) from public, anon, authenticated;
grant execute on function public.website_track_order(text, text) to service_role;
revoke all on function public.website_track_rate_limit(text, text) from public, anon, authenticated;
grant execute on function public.website_track_rate_limit(text, text) to service_role;

create or replace function public.website_launch_state()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'pricing_view', to_regclass('public.website_pricing_public') is not null,
    'website_content', to_regclass('public.website_content') is not null,
    'tracking_limiter_table', to_regclass('public.website_track_rate_limits') is not null,
    'tasks_dedupe_index', exists (
      select 1 from pg_catalog.pg_indexes
      where schemaname='public' and tablename='tasks' and indexname='tasks_dedupe_uidx'
        and indexdef ilike 'create unique index%'
    ),
    'pricing_service_select', has_table_privilege('service_role','public.website_pricing_public','SELECT'),
    'pricing_anon_select', has_table_privilege('anon','public.website_pricing_public','SELECT'),
    'pricing_authenticated_select', has_table_privilege('authenticated','public.website_pricing_public','SELECT'),
    'content_service_select', has_table_privilege('service_role','public.website_content','SELECT'),
    'content_service_insert', has_table_privilege('service_role','public.website_content','INSERT'),
    'content_anon_select', has_table_privilege('anon','public.website_content','SELECT'),
    'limiter_service_direct_select', has_table_privilege('service_role','public.website_track_rate_limits','SELECT'),
    'create_request_service_execute', has_function_privilege('service_role','public.website_create_request(text,text,jsonb)','EXECUTE'),
    'create_request_anon_execute', has_function_privilege('anon','public.website_create_request(text,text,jsonb)','EXECUTE'),
    'track_order_service_execute', has_function_privilege('service_role','public.website_track_order(text,text)','EXECUTE'),
    'track_order_anon_execute', has_function_privilege('anon','public.website_track_order(text,text)','EXECUTE'),
    'track_limit_service_execute', has_function_privilege('service_role','public.website_track_rate_limit(text,text)','EXECUTE'),
    'track_limit_anon_execute', has_function_privilege('anon','public.website_track_rate_limit(text,text)','EXECUTE'),
    'create_request_search_path', coalesce((
      select p.proconfig from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname='website_create_request'
        and pg_get_function_identity_arguments(p.oid)='p_kind text, p_dedupe_key text, p_payload jsonb'
      limit 1
    ), array[]::text[]),
    'track_order_search_path', coalesce((
      select p.proconfig from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname='website_track_order'
      limit 1
    ), array[]::text[]),
    'track_limit_search_path', coalesce((
      select p.proconfig from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname='website_track_rate_limit'
      limit 1
    ), array[]::text[]),
    'website_media', exists (
      select 1 from storage.buckets
      where id='website-media' and public=true and file_size_limit=8388608
        and allowed_mime_types @> array['image/jpeg','image/png','image/webp','image/avif']::text[]
    )
  );
$$;

revoke all on function public.website_launch_state() from public, anon, authenticated;
grant execute on function public.website_launch_state() to service_role;
