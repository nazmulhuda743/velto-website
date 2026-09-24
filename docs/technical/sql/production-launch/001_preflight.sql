-- Velto website production launch preflight. READ ONLY except temporary DO execution state.
-- Audited against production erutxtnepbejdxkoimeo on 2026-09-25.
-- Run before any later migration in this directory.

do $$
declare
  v_table text;
  v_column text;
begin
  foreach v_table in array array['price_list','tasks','orders','customers','profiles'] loop
    if to_regclass('public.' || v_table) is null then
      raise exception 'launch preflight: missing public.%', v_table;
    end if;
  end loop;

  if to_regclass('storage.buckets') is null then
    raise exception 'launch preflight: storage.buckets is unavailable';
  end if;

  foreach v_column in array array['item_name','service_category','price','unit','price_type','active','is_active'] loop
    if not exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='price_list' and column_name=v_column
    ) then raise exception 'launch preflight: price_list missing %', v_column; end if;
  end loop;

  foreach v_column in array array[
    'id','title','type','priority','status','due_at','outlet_code','description',
    'assigned_by_name','source','source_ref','dedupe_key','created_at'
  ] loop
    if not exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='tasks' and column_name=v_column
    ) then raise exception 'launch preflight: tasks missing %', v_column; end if;
  end loop;

  foreach v_column in array array[
    'order_number','phone_snapshot','order_status','order_date','pickup_date','delivery_date',
    'total_items','service_category','express','total_amount','due','payment_status',
    'outlet_code','delivered_at','created_at'
  ] loop
    if not exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='orders' and column_name=v_column
    ) then raise exception 'launch preflight: orders missing %', v_column; end if;
  end loop;

  foreach v_column in array array['id','name','email','role','active'] loop
    if not exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='profiles' and column_name=v_column
    ) then raise exception 'launch preflight: profiles missing %', v_column; end if;
  end loop;

  if not exists (
    select 1 from pg_catalog.pg_indexes
    where schemaname='public' and tablename='tasks' and indexname='tasks_dedupe_uidx'
      and indexdef ilike 'create unique index%' and indexdef ilike '%(dedupe_key)%'
  ) then
    raise exception 'launch preflight: unique tasks_dedupe_uidx is required';
  end if;
end;
$$;

select
  current_database() as database_name,
  to_regclass('public.website_pricing_public') is not null as pricing_view_exists,
  to_regclass('public.website_content') is not null as website_content_exists,
  to_regclass('public.website_track_rate_limits') is not null as tracking_limiter_table_exists,
  to_regprocedure('public.website_create_request(text,text,jsonb)') is not null as booking_rpc_exists,
  to_regprocedure('public.website_track_order(text,text)') is not null as tracking_rpc_exists,
  to_regprocedure('public.website_track_rate_limit(text,text)') is not null as tracking_limiter_rpc_exists;
