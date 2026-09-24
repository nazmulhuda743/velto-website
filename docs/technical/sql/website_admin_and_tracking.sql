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

-- Durable tracking throttles. The public endpoint hashes the Vercel requester IP
-- and normalized order number before calling the service-role-only limiter, so
-- raw IP addresses and phone numbers are not stored here.
create table if not exists public.website_track_rate_limits (
  bucket text not null check (bucket in ('ip', 'order')),
  rate_key text not null check (rate_key ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz not null default now(),
  attempts integer not null default 0 check (attempts >= 0),
  updated_at timestamptz not null default now(),
  primary key (bucket, rate_key)
);
alter table public.website_track_rate_limits enable row level security;
revoke all on public.website_track_rate_limits from public, anon, authenticated, service_role;
create index if not exists website_track_rate_limits_updated_idx
  on public.website_track_rate_limits (updated_at);

create or replace function public.website_track_rate_limit(p_bucket text, p_rate_key text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_limit integer;
  v_attempts integer;
  v_started timestamptz;
  v_retry integer;
begin
  if p_bucket not in ('ip', 'order') or p_rate_key !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;

  -- Per-IP limits stop one requester from brute forcing across orders. The
  -- per-order limit also slows distributed phone guessing against one order.
  v_limit := case when p_bucket = 'ip' then 12 else 20 end;

  insert into public.website_track_rate_limits as rl (
    bucket,
    rate_key,
    window_started_at,
    attempts,
    updated_at
  )
  values (
    p_bucket,
    p_rate_key,
    now(),
    1,
    now()
  )
  on conflict (bucket, rate_key) do update
  set
    window_started_at = case
      when rl.window_started_at <= now() - interval '10 minutes' then now()
      else rl.window_started_at
    end,
    attempts = case
      when rl.window_started_at <= now() - interval '10 minutes' then 1
      else least(rl.attempts + 1, 2147483647)
    end,
    updated_at = now()
  returning attempts, window_started_at into v_attempts, v_started;

  -- Opportunistic bounded-retention cleanup. The lookup path never needs
  -- historical limiter rows after their window expires.
  if random() < 0.01 then
    delete from public.website_track_rate_limits
    where updated_at < now() - interval '1 day';
  end if;

  if v_attempts <= v_limit then
    return jsonb_build_object(
      'ok', true,
      'allowed', true,
      'retry_after_seconds', 0
    );
  end if;

  v_retry := greatest(
    1,
    ceil(extract(epoch from ((v_started + interval '10 minutes') - clock_timestamp())))::integer
  );
  return jsonb_build_object(
    'ok', true,
    'allowed', false,
    'retry_after_seconds', v_retry
  );
end;
$$;
revoke all on function public.website_track_rate_limit(text, text)
  from public, anon, authenticated;
grant execute on function public.website_track_rate_limit(text, text)
  to service_role;

-- Production and staging currently differ: staging has orders.v2_promised_at,
-- while production does not. Reading the matched row as JSON keeps that field
-- optional without weakening the order-number + phone match requirement.
do $$
begin
  if to_regclass('public.orders') is null then
    raise exception 'website_track_order requires public.orders';
  end if;

  if exists (
    select required.column_name
    from (values
      ('order_number'), ('phone_snapshot'), ('order_status'), ('order_date'),
      ('pickup_date'), ('delivery_date'), ('total_items'), ('service_category'),
      ('express'), ('total_amount'), ('due'), ('payment_status'), ('outlet_code'),
      ('delivered_at'), ('created_at')
    ) as required(column_name)
    where not exists (
      select 1
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = 'orders'
        and c.column_name = required.column_name
    )
  ) then
    raise exception 'website_track_order orders schema does not match the reviewed contract';
  end if;
end;
$$;

create or replace function public.website_track_order(p_order_number text, p_phone text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_raw text := upper(regexp_replace(coalesce(left(p_order_number, 32), ''), '[^A-Za-z0-9]', '', 'g'));
  v_digits text := regexp_replace(v_raw, '\D', '', 'g');
  v_candidates text[];
  v_phone_digits text := regexp_replace(coalesce(left(p_phone, 32), ''), '\D', '', 'g');
  v_phone text;
  v_order jsonb;
begin
  if v_digits = '' or length(v_digits) > 7 or v_raw !~ '^(VELR?)?[0-9]+$' then
    return jsonb_build_object('found', false);
  end if;

  v_digits := lpad(v_digits::bigint::text, 5, '0');
  v_candidates := case
    when v_raw like 'VELR%' then array['VELR-' || v_digits]
    when v_raw like 'VEL%' then array['VEL-' || v_digits]
    else array['VEL-' || v_digits, 'VELR-' || v_digits]
  end;

  v_phone := case
    when v_phone_digits ~ '^8801[0-9]{9}$' then substr(v_phone_digits, 3)
    when v_phone_digits ~ '^008801[0-9]{9}$' then substr(v_phone_digits, 5)
    else v_phone_digits
  end;
  if v_phone !~ '^01[0-9]{9}$' then
    return jsonb_build_object('found', false);
  end if;

  select to_jsonb(o)
    into v_order
  from public.orders as o
  where o.order_number = any(v_candidates)
    and (case
      when regexp_replace(coalesce(o.phone_snapshot, ''), '\D', '', 'g') ~ '^8801[0-9]{9}$'
        then substr(regexp_replace(o.phone_snapshot, '\D', '', 'g'), 3)
      when regexp_replace(coalesce(o.phone_snapshot, ''), '\D', '', 'g') ~ '^008801[0-9]{9}$'
        then substr(regexp_replace(o.phone_snapshot, '\D', '', 'g'), 5)
      else regexp_replace(coalesce(o.phone_snapshot, ''), '\D', '', 'g')
    end) = v_phone
  order by o.created_at desc
  limit 1;

  if v_order is null then
    return jsonb_build_object('found', false);
  end if;

  return jsonb_build_object('found', true, 'order', jsonb_build_object(
    'orderNumber', v_order->'order_number',
    'status', v_order->'order_status',
    'orderDate', v_order->'order_date',
    'pickupDate', v_order->'pickup_date',
    'deliveryDate', v_order->'delivery_date',
    'promisedAt', v_order->'v2_promised_at',
    'deliveredAt', v_order->'delivered_at',
    'items', v_order->'total_items',
    'services', v_order->'service_category',
    'express', v_order->'express',
    'total', v_order->'total_amount',
    'due', v_order->'due',
    'paymentStatus', v_order->'payment_status',
    'outlet', v_order->'outlet_code'
  ));
end;
$$;
revoke all on function public.website_track_order(text, text) from public, anon, authenticated;
grant execute on function public.website_track_order(text, text) to service_role;
