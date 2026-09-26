-- Website Command Center: role-based access and an activity log.
--
-- Website-only objects. Nothing here reads or writes Velto Ops data except a
-- read of profiles (to recognise Ops admins and deactivated staff) and of
-- auth.users (to find an existing login by email). People given a website
-- role are NOT given a profiles row, so they get no access to Ops tables
-- (every Ops policy requires public.is_active_staff()).
--
-- Everything is service_role only: the admin server reads and writes it; the
-- anon and authenticated keys cannot.
--
-- The activity log is append-only for the website (select + insert only).
--
-- Status: applied to STAGING (ekgdefcdqcsqvpbqponv) and tested with
-- docs/technical/sql/tests/website_admin_access_test.sql; production only
-- with the owner's approval.

begin;

-- ---------------------------------------------------------------------------
-- 1. Members: one website role per login
-- ---------------------------------------------------------------------------
create table if not exists public.website_admin_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null check (length(email) between 3 and 254),
  name text not null check (length(name) between 1 and 80),
  role text not null check (role in ('owner', 'manager', 'marketing', 'designer', 'support')),
  active boolean not null default true,
  -- 'website' = login created from the Access page; 'existing' = an account that already existed.
  origin text not null default 'existing' check (origin in ('website', 'existing')),
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_by text,
  updated_at timestamptz not null default now()
);

alter table public.website_admin_members enable row level security;
revoke all on public.website_admin_members from anon, authenticated, public, service_role;
grant select, insert, update on public.website_admin_members to service_role;

-- ---------------------------------------------------------------------------
-- 2. Activity log: who changed what, and when
-- ---------------------------------------------------------------------------
create table if not exists public.website_admin_activity (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_id uuid,
  actor_name text not null check (length(actor_name) between 1 and 120),
  actor_role text not null check (length(actor_role) between 1 and 20),
  section text not null check (length(section) between 1 and 30),
  action text not null check (length(action) between 1 and 40),
  target text check (target is null or length(target) <= 200),
  summary text not null check (length(summary) between 1 and 300),
  detail jsonb not null default '{}'::jsonb check (octet_length(detail::text) <= 8192)
);

create index if not exists website_admin_activity_at_idx on public.website_admin_activity (at desc);
create index if not exists website_admin_activity_actor_idx on public.website_admin_activity (actor_id, at desc);
create index if not exists website_admin_activity_section_idx on public.website_admin_activity (section, at desc);

alter table public.website_admin_activity enable row level security;
revoke all on public.website_admin_activity from anon, authenticated, public, service_role;
grant select, insert on public.website_admin_activity to service_role;

-- ---------------------------------------------------------------------------
-- 3. Access for one login (one call per dashboard request)
-- ---------------------------------------------------------------------------
create or replace function public.website_admin_access_for(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'profile', (
      select jsonb_build_object('name', p.name, 'email', p.email, 'role', p.role, 'active', p.active)
      from public.profiles p where p.id = p_user_id
    ),
    'member', (
      select jsonb_build_object('name', m.name, 'email', m.email, 'role', m.role, 'active', m.active)
      from public.website_admin_members m where m.user_id = p_user_id
    )
  );
$$;

-- ---------------------------------------------------------------------------
-- 4. Find an existing login by email (Access page, owner only in the app)
-- ---------------------------------------------------------------------------
create or replace function public.website_admin_find_user(p_email text)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select jsonb_build_object(
    'id', u.id,
    'email', u.email,
    'opsRole', p.role,
    'opsActive', p.active
  )
  from auth.users u
  left join public.profiles p on p.id = u.id
  where lower(u.email) = lower(btrim(p_email))
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- 5. Everyone with dashboard access, for the Access page
-- ---------------------------------------------------------------------------
-- Ops admins (implicit owners) plus website members, newest activity first.
create or replace function public.website_admin_people()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with people as (
    select p.id as user_id, coalesce(nullif(p.name, ''), p.email) as name, p.email, 'owner' as role,
           p.active, 'ops_admin' as origin, null::text as created_by, null::timestamptz as created_at
    from public.profiles p
    where p.role = 'admin'
    union all
    select m.user_id, m.name, m.email, m.role, m.active and coalesce(p.active, true), m.origin, m.created_by, m.created_at
    from public.website_admin_members m
    left join public.profiles p on p.id = m.user_id
    where not exists (select 1 from public.profiles a where a.id = m.user_id and a.role = 'admin')
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'userId', x.user_id,
    'name', x.name,
    'email', x.email,
    'role', x.role,
    'active', x.active,
    'origin', x.origin,
    'createdBy', x.created_by,
    'createdAt', x.created_at,
    'lastSeen', (select max(a.at) from public.website_admin_activity a where a.actor_id = x.user_id)
  ) order by x.origin <> 'ops_admin', x.active desc, x.name), '[]'::jsonb)
  from people x;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'website_admin_access_for(uuid)',
    'website_admin_find_user(text)',
    'website_admin_people()'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end;
$$;

commit;
