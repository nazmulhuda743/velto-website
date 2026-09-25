-- Velto Customer Portal V1: Ops authorization hardening + customer identity bridge.
--
-- Apply to STAGING first. Production only after the Ops app has been regression-tested
-- against hardened staging (see docs/technical/CUSTOMER-PORTAL.md, "Production activation").
--
-- Why part 1 exists: Velto Ops grants many tables to every `authenticated` user with
-- USING (true). That was safe while only staff could hold a session. Customer sign-up puts
-- customers in the same `authenticated` role, so every Ops policy must require an active
-- staff profile first. Part 1 is idempotent: it only rewrites policies that do not already
-- check the caller.
--
-- Everything the portal needs goes through SECURITY DEFINER functions that derive the
-- caller from auth.uid(). Customers get no direct table access.

begin;

-------------------------------------------------------------------------------
-- 1. Ops authorization hardening
-------------------------------------------------------------------------------

-- 1a/1b. Every policy that applies to logged-in users (public schema + storage.objects)
--        must start with an active-staff check. Wrapping costs staff nothing (they are
--        active staff) and closes policies that are `true`, own-row only, or that OR a
--        staff check with something else (e.g. tasks_insert). Policies already starting
--        with is_active_staff() are left alone, so this block is safe to re-run.
do $$
declare
  p record;
  wrapped constant text := '^\(*is_active_staff\(\)';
begin
  for p in
    select schemaname, tablename, policyname, cmd, qual, with_check
    from pg_policies
    where (schemaname = 'public' or (schemaname = 'storage' and tablename = 'objects'))
      and ('authenticated' = any (roles) or 'public' = any (roles))
      and tablename <> 'customer_accounts'
  loop
    if p.qual is not null and p.qual !~ wrapped then
      execute format('alter policy %I on %I.%I using (public.is_active_staff() and (%s))',
        p.policyname, p.schemaname, p.tablename, p.qual);
      raise notice 'hardened USING %.% %', p.tablename, p.policyname, p.cmd;
    end if;
    if p.with_check is not null and p.with_check !~ wrapped then
      execute format('alter policy %I on %I.%I with check (public.is_active_staff() and (%s))',
        p.policyname, p.schemaname, p.tablename, p.with_check);
      raise notice 'hardened CHECK %.% %', p.tablename, p.policyname, p.cmd;
    end if;
  end loop;
end $$;

-- 1c. cockpit_stats() is SECURITY DEFINER with no caller check. Keep its body untouched,
--     move it aside, and put a staff-gated wrapper in its place.
do $$
begin
  if exists (select 1 from pg_proc where proname = 'cockpit_stats' and pronamespace = 'public'::regnamespace)
     and not exists (select 1 from pg_proc where proname = 'cockpit_stats_unguarded' and pronamespace = 'public'::regnamespace) then
    alter function public.cockpit_stats() rename to cockpit_stats_unguarded;
    revoke all on function public.cockpit_stats_unguarded() from public, anon, authenticated;
  end if;
end $$;

create or replace function public.cockpit_stats()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_active_staff() then
    raise exception 'access denied' using errcode = '42501';
  end if;
  return public.cockpit_stats_unguarded();
end;
$$;
revoke all on function public.cockpit_stats() from public, anon;
grant execute on function public.cockpit_stats() to authenticated;

-------------------------------------------------------------------------------
-- 2. Customer identity bridge
-------------------------------------------------------------------------------

create table if not exists public.customer_accounts (
  auth_user_id      uuid primary key references auth.users (id) on delete cascade,
  customer_id       uuid unique references public.customers (id) on delete set null,
  full_name         text not null check (char_length(btrim(full_name)) between 2 and 80),
  phone             text not null check (phone ~ '^01[3-9][0-9]{8}$'),
  verified_phone    text check (verified_phone is null or verified_phone ~ '^01[3-9][0-9]{8}$'),
  address           text check (address is null or char_length(address) <= 300),
  area              text check (area is null or char_length(area) <= 40),
  link_status       text not null default 'none' check (link_status in ('none', 'pending', 'linked', 'rejected')),
  link_requested_at timestamptz,
  link_decided_at   timestamptz,
  link_decided_by   text,
  link_method       text check (link_method is null or link_method in ('staff_callback', 'sms_otp')),
  terms_version     smallint not null,
  terms_accepted_at timestamptz not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  last_login_at     timestamptz,
  constraint customer_accounts_link_consistent
    check ((link_status = 'linked') = (customer_id is not null and verified_phone is not null))
);

comment on table public.customer_accounts is
  'Website customer identity bridge: one Supabase Auth user -> at most one Ops customer, linked only after verification. Ops customers remain the source of truth.';
comment on column public.customer_accounts.phone is
  'Phone the customer typed. Unverified; it never grants access to Ops data by itself.';
comment on column public.customer_accounts.verified_phone is
  'Ops customer phone confirmed by staff callback or SMS OTP when the link was approved.';

create index if not exists customer_accounts_pending_idx
  on public.customer_accounts (link_requested_at) where link_status = 'pending';

alter table public.customer_accounts enable row level security;
-- No policies on purpose: customers reach their row only through the functions below.
revoke all on table public.customer_accounts from public, anon, authenticated;

-------------------------------------------------------------------------------
-- 3. Customer-facing functions (role: authenticated; caller = auth.uid())
-------------------------------------------------------------------------------

-- Internal helpers; never granted to API roles.

-- 01XXXXXXXXX from any Bangladeshi mobile format, else null. Portal-owned copy of the Ops v2
-- helper (velto_v2_local_phone), which exists on staging but not on production.
create or replace function public.portal_local_phone(p_raw text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when d ~ '^01[0-9]{9}$' then d
    when d ~ '^8801[0-9]{9}$' then substr(d, 3)
    when d ~ '^008801[0-9]{9}$' then substr(d, 5)
    else null end
  from (select regexp_replace(coalesce(p_raw, ''), '\D', '', 'g') as d) x;
$$;

create or replace function public.portal_status_label(p_status text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_status
    when 'New' then 'Booked'
    when 'Picked' then 'Collected'
    when 'In Velto Facility' then 'Being cleaned'
    when 'Ready' then 'Ready'
    when 'Delivered' then 'Delivered'
    when 'Cancelled' then 'Cancelled'
    else 'In progress'
  end;
$$;

create or replace function public.portal_order_json(o public.orders)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'orderNumber', o.order_number,
    'status', o.order_status,
    'statusLabel', public.portal_status_label(o.order_status),
    'active', o.order_status not in ('Delivered', 'Cancelled'),
    'orderDate', o.order_date,
    'pickupDate', o.pickup_date,
    'deliveryDate', o.delivery_date,
    -- v2_promised_at exists on staging only; read it through JSON so production works too.
    'promisedAt', to_jsonb(o) -> 'v2_promised_at',
    'deliveredAt', o.delivered_at,
    'services', to_jsonb(o.service_category),
    'items', o.total_items,
    'express', coalesce(o.express, false),
    'total', o.total_amount,
    'paid', o.amount_paid,
    'due', greatest(coalesce(o.due, o.total_amount - o.amount_paid), 0),
    'paymentStatus', o.payment_status,
    'outlet', (select jsonb_build_object('code', ot.code, 'name', ot.name) from public.outlets ot where ot.code = o.outlet_code)
  );
$$;

-- The caller's account row, or an exception for staff / anonymous callers.
create or replace function public.portal_caller()
returns public.customer_accounts
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_row public.customer_accounts;
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'staff account' using errcode = '42501';
  end if;
  select * into v_row from public.customer_accounts where auth_user_id = v_uid;
  return v_row; -- null row when the customer hasn't completed their profile yet
end;
$$;

-- Account home data. Creates the account row from sign-up metadata on first call.
create or replace function public.portal_me()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_acc public.customer_accounts;
  v_meta jsonb;
  v_email text;
  v_name text;
  v_phone text;
  v_terms smallint;
  v_customer jsonb;
begin
  v_acc := public.portal_caller();
  select raw_user_meta_data, email into v_meta, v_email from auth.users where id = v_uid;

  if v_acc.auth_user_id is null then
    -- Metadata is user-editable: use it only to prefill the customer's own profile.
    v_name := btrim(coalesce(v_meta ->> 'full_name', ''));
    v_phone := public.portal_local_phone(v_meta ->> 'phone');
    v_terms := case when (v_meta ->> 'terms_version') ~ '^[0-9]{1,3}$' then (v_meta ->> 'terms_version')::smallint end;
    if char_length(v_name) between 2 and 80 and v_phone ~ '^01[3-9][0-9]{8}$' and v_terms is not null then
      insert into public.customer_accounts (auth_user_id, full_name, phone, terms_version, terms_accepted_at, last_login_at)
      values (v_uid, v_name, v_phone, v_terms, coalesce((v_meta ->> 'terms_accepted_at')::timestamptz, now()), now())
      on conflict (auth_user_id) do nothing;
      select * into v_acc from public.customer_accounts where auth_user_id = v_uid;
    else
      return jsonb_build_object('state', 'incomplete', 'email', v_email);
    end if;
  end if;

  if v_acc.link_status = 'linked' then
    select jsonb_build_object('name', c.name, 'phone', c.phone, 'address', c.address, 'zone', c.zone)
      into v_customer from public.customers c where c.id = v_acc.customer_id;
  end if;

  return jsonb_build_object(
    'state', 'ready',
    'email', v_email,
    'fullName', v_acc.full_name,
    'phone', v_acc.phone,
    'address', v_acc.address,
    'area', v_acc.area,
    'link', jsonb_build_object(
      'status', v_acc.link_status,
      'requestedAt', v_acc.link_requested_at,
      'decidedAt', v_acc.link_decided_at,
      'verifiedPhone', v_acc.verified_phone
    ),
    'veltoProfile', v_customer
  );
end;
$$;

-- Create or update the customer's own portal profile. The phone is locked while a link
-- request is pending or once linked: changing it would change what staff verified.
create or replace function public.portal_profile_save(
  p_full_name text,
  p_phone text,
  p_address text,
  p_area text,
  p_terms_version smallint default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_acc public.customer_accounts;
  v_name text := btrim(coalesce(p_full_name, ''));
  v_phone text := public.portal_local_phone(p_phone);
  v_address text := nullif(btrim(coalesce(p_address, '')), '');
  v_area text := nullif(btrim(coalesce(p_area, '')), '');
begin
  v_acc := public.portal_caller();
  if char_length(v_name) not between 2 and 80 then
    raise exception 'invalid name' using errcode = '22023';
  end if;
  if v_phone is null or v_phone !~ '^01[3-9][0-9]{8}$' then
    raise exception 'invalid phone' using errcode = '22023';
  end if;
  if v_address is not null and char_length(v_address) > 300 or v_area is not null and char_length(v_area) > 40 then
    raise exception 'invalid address' using errcode = '22023';
  end if;

  if v_acc.auth_user_id is null then
    if p_terms_version is null then
      raise exception 'terms not accepted' using errcode = '22023';
    end if;
    insert into public.customer_accounts (auth_user_id, full_name, phone, address, area, terms_version, terms_accepted_at, last_login_at)
    values (v_uid, v_name, v_phone, v_address, v_area, p_terms_version, now(), now());
  else
    if v_phone <> v_acc.phone and v_acc.link_status in ('pending', 'linked') then
      raise exception 'phone locked' using errcode = '42501';
    end if;
    update public.customer_accounts
       set full_name = v_name,
           phone = v_phone,
           address = v_address,
           area = v_area,
           -- A new phone after a rejected request starts from scratch.
           link_status = case when link_status = 'rejected' and v_phone <> phone then 'none' else link_status end,
           updated_at = now()
     where auth_user_id = v_uid;
  end if;
  return public.portal_me();
end;
$$;

-- Ask Velto to connect existing order history. Staff verify by calling the phone on the
-- Ops customer record (or, once configured, by SMS OTP). Nothing is linked here.
create or replace function public.portal_request_link()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_acc public.customer_accounts;
begin
  v_acc := public.portal_caller();
  if v_acc.auth_user_id is null then
    raise exception 'profile incomplete' using errcode = '22023';
  end if;
  if v_acc.link_status in ('none', 'rejected') then
    update public.customer_accounts
       set link_status = 'pending', link_requested_at = now(), link_decided_at = null, link_decided_by = null, updated_at = now()
     where auth_user_id = v_acc.auth_user_id;
  end if;
  return public.portal_me();
end;
$$;

create or replace function public.portal_touch_login()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.customer_accounts set last_login_at = now() where auth_user_id = (select auth.uid());
end;
$$;

-- Orders for the caller's linked Ops customer. Unlinked accounts get an empty list.
create or replace function public.portal_orders(p_limit integer default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_acc public.customer_accounts;
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
begin
  v_acc := public.portal_caller();
  if v_acc.customer_id is null or v_acc.link_status <> 'linked' then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(public.portal_order_json(o) order by o.order_date desc, o.created_at desc)
    from (
      select * from public.orders
      where customer_id = v_acc.customer_id
      order by order_date desc, created_at desc
      limit v_limit
    ) o
  ), '[]'::jsonb);
end;
$$;

-- One order, only if it belongs to the caller's linked customer. Returns null otherwise:
-- "not yours" and "doesn't exist" look the same.
create or replace function public.portal_order_get(p_order_number text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_acc public.customer_accounts;
  v_number text := upper(btrim(coalesce(p_order_number, '')));
  o public.orders;
begin
  v_acc := public.portal_caller();
  if v_number !~ '^VELR?-[0-9]{5}$' or v_acc.customer_id is null or v_acc.link_status <> 'linked' then
    return null;
  end if;
  select * into o from public.orders
   where order_number = v_number and customer_id = v_acc.customer_id
   order by created_at desc limit 1;
  if o.id is null then
    return null;
  end if;
  return public.portal_order_json(o) || jsonb_build_object(
    'lines', coalesce((
      select jsonb_agg(jsonb_build_object('item', i.item_name, 'service', i.service_category, 'quantity', i.quantity) order by i.created_at)
      from public.order_items i where i.order_id = o.id
    ), '[]'::jsonb),
    'timeline', coalesce((
      select jsonb_agg(jsonb_build_object('status', h.new_status, 'label', public.portal_status_label(h.new_status), 'at', h.changed_at) order by h.changed_at)
      from public.order_status_history h
      -- v2_corrected_by_event_id exists on staging only (same JSON read as promisedAt).
      where h.order_id = o.id and (to_jsonb(h) ->> 'v2_corrected_by_event_id') is null
    ), '[]'::jsonb)
  );
end;
$$;

-------------------------------------------------------------------------------
-- 4. Staff link verification (role: service_role, via the website admin dashboard)
-------------------------------------------------------------------------------

create or replace function public.portal_link_requests(p_status text default 'pending')
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'authUserId', a.auth_user_id,
    'email', u.email,
    'fullName', a.full_name,
    'phone', a.phone,
    'area', a.area,
    'status', a.link_status,
    'requestedAt', a.link_requested_at,
    'decidedAt', a.link_decided_at,
    'decidedBy', a.link_decided_by,
    'linkedCustomer', (select jsonb_build_object('id', c.id, 'name', c.name, 'phone', c.phone) from public.customers c where c.id = a.customer_id),
    -- Only the Ops customer whose phone equals the claimed phone can be linked.
    'candidate', (
      select jsonb_build_object(
        'id', c.id, 'name', c.name, 'phone', c.phone, 'code', c.customer_code, 'zone', c.zone,
        'orders', (select count(*) from public.orders o where o.customer_id = c.id),
        'lastOrder', (select max(o.order_date) from public.orders o where o.customer_id = c.id),
        'alreadyLinked', exists (select 1 from public.customer_accounts x where x.customer_id = c.id)
      )
      from public.customers c where c.phone = a.phone
    )
  ) order by a.link_requested_at nulls last), '[]'::jsonb)
  from public.customer_accounts a
  join auth.users u on u.id = a.auth_user_id
  where p_status = 'all' or a.link_status = p_status;
$$;

create or replace function public.portal_link_decide(
  p_auth_user_id uuid,
  p_decision text,
  p_decided_by text,
  p_method text default 'staff_callback'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_acc public.customer_accounts;
  v_customer public.customers;
  v_by text := left(btrim(coalesce(p_decided_by, '')), 120);
begin
  if v_by = '' then
    raise exception 'decided_by required' using errcode = '22023';
  end if;
  select * into v_acc from public.customer_accounts where auth_user_id = p_auth_user_id for update;
  if v_acc.auth_user_id is null then
    raise exception 'account not found' using errcode = 'P0002';
  end if;

  if p_decision = 'approve' then
    if v_acc.link_status <> 'pending' then
      raise exception 'no pending request' using errcode = '22023';
    end if;
    if p_method not in ('staff_callback', 'sms_otp') then
      raise exception 'invalid method' using errcode = '22023';
    end if;
    select * into v_customer from public.customers where phone = v_acc.phone;
    if v_customer.id is null then
      raise exception 'no Velto customer with this phone' using errcode = 'P0002';
    end if;
    if exists (select 1 from public.customer_accounts where customer_id = v_customer.id and auth_user_id <> v_acc.auth_user_id) then
      raise exception 'customer already linked to another account' using errcode = '23505';
    end if;
    update public.customer_accounts
       set customer_id = v_customer.id, verified_phone = v_customer.phone, link_status = 'linked',
           link_method = p_method, link_decided_at = now(), link_decided_by = v_by, updated_at = now()
     where auth_user_id = v_acc.auth_user_id;
  elsif p_decision = 'reject' then
    update public.customer_accounts
       set link_status = 'rejected', customer_id = null, verified_phone = null, link_method = null,
           link_decided_at = now(), link_decided_by = v_by, updated_at = now()
     where auth_user_id = v_acc.auth_user_id;
  elsif p_decision = 'unlink' then
    update public.customer_accounts
       set link_status = 'none', customer_id = null, verified_phone = null, link_method = null,
           link_requested_at = null, link_decided_at = now(), link_decided_by = v_by, updated_at = now()
     where auth_user_id = v_acc.auth_user_id;
  else
    raise exception 'invalid decision' using errcode = '22023';
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

-------------------------------------------------------------------------------
-- 5. Grants: customers call only their own functions; staff linking is server-only.
-------------------------------------------------------------------------------

revoke all on function public.portal_local_phone(text) from public, anon, authenticated;
revoke all on function public.portal_status_label(text) from public, anon, authenticated;
revoke all on function public.portal_order_json(public.orders) from public, anon, authenticated;
revoke all on function public.portal_caller() from public, anon, authenticated;

revoke all on function public.portal_me() from public, anon;
revoke all on function public.portal_profile_save(text, text, text, text, smallint) from public, anon;
revoke all on function public.portal_request_link() from public, anon;
revoke all on function public.portal_touch_login() from public, anon;
revoke all on function public.portal_orders(integer) from public, anon;
revoke all on function public.portal_order_get(text) from public, anon;
grant execute on function public.portal_me() to authenticated;
grant execute on function public.portal_profile_save(text, text, text, text, smallint) to authenticated;
grant execute on function public.portal_request_link() to authenticated;
grant execute on function public.portal_touch_login() to authenticated;
grant execute on function public.portal_orders(integer) to authenticated;
grant execute on function public.portal_order_get(text) to authenticated;

revoke all on function public.portal_link_requests(text) from public, anon, authenticated;
revoke all on function public.portal_link_decide(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.portal_link_requests(text) to service_role;
grant execute on function public.portal_link_decide(uuid, text, text, text) to service_role;

commit;

-------------------------------------------------------------------------------
-- 6. Verification (run after applying; every row should read as expected)
-------------------------------------------------------------------------------

-- a) Every policy for logged-in users starts with the staff gate (expect 0 rows):
-- select schemaname, tablename, policyname, cmd, qual, with_check
-- from pg_policies
-- where (schemaname = 'public' or (schemaname = 'storage' and tablename = 'objects'))
--   and ('authenticated' = any (roles) or 'public' = any (roles))
--   and tablename <> 'customer_accounts'
--   and (coalesce(qual, 'is_active_staff()') !~ '^\(*is_active_staff\(\)'
--     or coalesce(with_check, 'is_active_staff()') !~ '^\(*is_active_staff\(\)');

-- b) Customers cannot read customer_accounts directly (expect false, false):
-- select has_table_privilege('authenticated', 'public.customer_accounts', 'SELECT'),
--        has_table_privilege('anon', 'public.customer_accounts', 'SELECT');

-- c) Staff linking functions are not callable by API roles (expect false x4):
-- select has_function_privilege('authenticated', 'public.portal_link_decide(uuid,text,text,text)', 'EXECUTE'),
--        has_function_privilege('anon', 'public.portal_link_decide(uuid,text,text,text)', 'EXECUTE'),
--        has_function_privilege('authenticated', 'public.portal_link_requests(text)', 'EXECUTE'),
--        has_function_privilege('anon', 'public.portal_link_requests(text)', 'EXECUTE');
