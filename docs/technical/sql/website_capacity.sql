-- Velto Scheduling Engine, phase 1: one pickup & delivery capacity shared by the website, the
-- Command Center (Ops) and staff-created orders.
--
-- The rule: if the website shows a window as available, the capacity for it is already reserved
-- when the customer confirms. Every booking path (website, staff for a WhatsApp customer,
-- the dispatch board) reserves through capacity_reserve(), which locks the slot row, so two
-- people can never take the last place at the same time.
--
--   capacity_config        one row: switched on for the website, days ahead, booking cutoff
--   capacity_windows       Morning 9–12, Afternoon 12–4, Evening 4–8, Night 8–10 (off)
--   capacity_zones         sectors grouped into zones (S1–8, S9–12, S13–18, and "other")
--   capacity_defaults      capacity per kind × zone × window, used unless a day overrides it
--   capacity_slots         a day's override: capacity, blocked, note (created on first use)
--   capacity_reservations  who holds a place: a website/staff booking or a planned stop
--
-- Capacity is counted in points (1 per booking for now; bigger jobs can weigh more later).
-- Manager actions (set / block / override) come from the admin server, which checks who may do
-- them and logs them. Service role for writes; active Ops staff may read (RLS, is_active_staff()).
--
-- Requires website_create_request.sql, website_dispatch.sql and website_dispatch_stages.sql (the
-- 'confirmed' and 'picked' stages). Run it AFTER website_dispatch_stages.sql: both define
-- website_dispatch_plan, and this one (the stages rules + capacity + p_override) must win. If
-- website_dispatch_stages.sql is ever run again, run this file again after it.
-- Works with website_customer_pickups.sql: a customer's change or cancel frees the place through
-- the capacity_job_changed trigger. Idempotent: safe to run again.
-- Status: STAGING only until the owner approves production.

begin;

/* ---------- configuration ---------- */

create table if not exists public.capacity_config (
  id boolean primary key default true check (id),
  -- Off: the website shows windows as a preference and Velto confirms by phone (the old way).
  enabled boolean not null default false,
  days_ahead smallint not null default 7 check (days_ahead between 1 and 30),
  -- A window can be booked until this many minutes before it ends.
  cutoff_minutes smallint not null default 120 check (cutoff_minutes between 0 and 600),
  updated_by text check (updated_by is null or char_length(updated_by) <= 120),
  updated_at timestamptz not null default now()
);
insert into public.capacity_config (id) values (true) on conflict do nothing;

create table if not exists public.capacity_windows (
  id text primary key check (id in ('morning', 'afternoon', 'evening', 'night')),
  starts_at time not null,
  ends_at time not null,
  active boolean not null default true,
  sort smallint not null,
  check (ends_at > starts_at)
);
insert into public.capacity_windows (id, starts_at, ends_at, active, sort) values
  ('morning', '09:00', '12:00', true, 1),
  ('afternoon', '12:00', '16:00', true, 2),
  ('evening', '16:00', '20:00', true, 3),
  ('night', '20:00', '22:00', false, 4)
on conflict (id) do nothing;

create table if not exists public.capacity_zones (
  id text primary key check (id ~ '^[a-z0-9-]{1,20}$'),
  name text not null check (char_length(name) between 1 and 40),
  sectors smallint[] not null default '{}',
  sort smallint not null default 0,
  active boolean not null default true
);
-- A starting split, edited on the Capacity board. "other" holds stops with no known sector.
insert into public.capacity_zones (id, name, sectors, sort) values
  ('s1-8', 'Sectors 1–8', '{1,2,3,4,5,6,7,8}', 1),
  ('s9-12', 'Sectors 9–12', '{9,10,11,12}', 2),
  ('s13-18', 'Sectors 13–18', '{13,14,15,16,17,18}', 3),
  ('other', 'Other / no sector', '{}', 9)
on conflict (id) do nothing;

create table if not exists public.capacity_defaults (
  kind text not null check (kind in ('pickup', 'delivery')),
  zone_id text not null references public.capacity_zones (id) on delete cascade,
  window_id text not null references public.capacity_windows (id),
  capacity smallint not null check (capacity between 0 and 200),
  primary key (kind, zone_id, window_id)
);
-- Proposed starting numbers (one rider per zone): Morning 6, Afternoon 6, Evening 7, Night 0.
insert into public.capacity_defaults (kind, zone_id, window_id, capacity)
select k, z.id, w.id, case w.id when 'morning' then 6 when 'afternoon' then 6 when 'evening' then 7 else 0 end
from unnest(array['pickup', 'delivery']) k, public.capacity_zones z, public.capacity_windows w
on conflict do nothing;

create table if not exists public.capacity_slots (
  slot_date date not null,
  kind text not null check (kind in ('pickup', 'delivery')),
  zone_id text not null references public.capacity_zones (id) on delete cascade,
  window_id text not null references public.capacity_windows (id),
  -- Null: the default for this kind, zone and window.
  capacity smallint check (capacity is null or capacity between 0 and 200),
  blocked boolean not null default false,
  note text check (note is null or char_length(note) <= 200),
  updated_by text check (updated_by is null or char_length(updated_by) <= 120),
  updated_at timestamptz not null default now(),
  primary key (slot_date, kind, zone_id, window_id)
);

create table if not exists public.capacity_reservations (
  id uuid primary key default gen_random_uuid(),
  -- One per booking or stop: 'booking:<idempotency key>', 'dispatch:delivery:<order>', 'dispatch:pickup:<job>'.
  ref text not null unique check (char_length(ref) between 8 and 160),
  slot_date date not null,
  kind text not null check (kind in ('pickup', 'delivery')),
  zone_id text not null,
  window_id text not null,
  points numeric(4,1) not null default 1 check (points > 0 and points <= 20),
  -- held: counts; done: counts (it happened); released: freed (cancelled, merged, moved away).
  status text not null default 'held' check (status in ('held', 'done', 'released')),
  source text not null check (source in ('website', 'staff', 'dispatch')),
  task_id uuid,
  order_number text check (order_number is null or order_number ~ '^VELR?-[0-9]{3,6}$'),
  customer_name text check (customer_name is null or char_length(customer_name) <= 120),
  area text check (area is null or char_length(area) <= 120),
  over_capacity boolean not null default false,
  override_reason text check (override_reason is null or char_length(override_reason) <= 200),
  created_by text check (created_by is null or char_length(created_by) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (slot_date, kind, zone_id, window_id) references public.capacity_slots (slot_date, kind, zone_id, window_id)
);
create index if not exists capacity_reservations_slot_idx
  on public.capacity_reservations (slot_date, kind, zone_id, window_id) where status <> 'released';
create index if not exists capacity_reservations_task_idx on public.capacity_reservations (task_id) where task_id is not null;

alter table public.capacity_config enable row level security;
alter table public.capacity_windows enable row level security;
alter table public.capacity_zones enable row level security;
alter table public.capacity_defaults enable row level security;
alter table public.capacity_slots enable row level security;
alter table public.capacity_reservations enable row level security;
revoke all on public.capacity_config, public.capacity_windows, public.capacity_zones, public.capacity_defaults,
  public.capacity_slots, public.capacity_reservations from public, anon, authenticated;
grant select on public.capacity_config, public.capacity_windows, public.capacity_zones, public.capacity_defaults,
  public.capacity_slots, public.capacity_reservations to service_role;

-- Velto Ops (signed-in active staff) can read the same capacity; writes go through the functions.
do $$
declare t text;
begin
  foreach t in array array['capacity_config', 'capacity_windows', 'capacity_zones', 'capacity_defaults', 'capacity_slots', 'capacity_reservations'] loop
    execute format('drop policy if exists %I on public.%I', t || '_staff_read', t);
    execute format('create policy %I on public.%I for select to authenticated using (is_active_staff())', t || '_staff_read', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end;
$$;

/* ---------- helpers ---------- */

-- "Uttara Sector 7", "House 4, Sector-11" → the active zone holding that sector; null if none.
create or replace function public.capacity_zone_for(p_text text)
returns text
language sql
stable
set search_path = pg_catalog, public
as $$
  select z.id
  from public.capacity_zones z
  where z.active
    and z.sectors @> array[(substring(coalesce(p_text, '') from '(?i)sec(?:tor)?\s*[-#:.]?\s*([0-9]{1,2})\M'))::smallint]
  order by z.sort
  limit 1
$$;

create or replace function public.capacity_window_bounds(p_date date, p_window text, out starts timestamptz, out ends timestamptz)
language sql
stable
set search_path = pg_catalog, public
as $$
  select (p_date + w.starts_at) at time zone 'Asia/Dhaka', (p_date + w.ends_at) at time zone 'Asia/Dhaka'
  from public.capacity_windows w where w.id = p_window
$$;

-- Capacity, points used and blocked for one slot.
create or replace function public.capacity_state(p_date date, p_kind text, p_zone text, p_window text, p_except text default null)
returns table (capacity integer, used numeric, blocked boolean, note text)
language sql
stable
set search_path = pg_catalog, public
as $$
  select
    coalesce(s.capacity, d.capacity, 0)::integer,
    coalesce((select sum(r.points) from public.capacity_reservations r
               where r.slot_date = p_date and r.kind = p_kind and r.zone_id = p_zone and r.window_id = p_window
                 and r.status <> 'released' and r.ref is distinct from p_except), 0),
    coalesce(s.blocked, false) or not coalesce(w.active, false),
    s.note
  from public.capacity_windows w
  left join public.capacity_defaults d on d.kind = p_kind and d.zone_id = p_zone and d.window_id = p_window
  left join public.capacity_slots s on s.slot_date = p_date and s.kind = p_kind and s.zone_id = p_zone and s.window_id = p_window
  where w.id = p_window
$$;

/* ---------- availability (website and staff forms) ---------- */

-- The next days for one zone: each window with its status. open / few (≤2 left) / full / closed / past.
create or replace function public.capacity_availability(p_kind text, p_zone text, p_days integer default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  c public.capacity_config;
  v_today date := (now() at time zone 'Asia/Dhaka')::date;
  v_days integer;
begin
  select * into c from public.capacity_config where id;
  if p_kind not in ('pickup', 'delivery') or not exists (select 1 from public.capacity_zones where id = p_zone and active) then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  v_days := least(greatest(coalesce(p_days, c.days_ahead), 1), 30);
  return jsonb_build_object(
    'ok', true,
    'enabled', c.enabled,
    'zone', p_zone,
    'today', v_today,
    'days', (
      select jsonb_agg(jsonb_build_object(
        'date', d::date,
        'windows', (
          select jsonb_agg(jsonb_build_object(
            'id', w.id,
            'starts', to_char(w.starts_at, 'HH24:MI'),
            'ends', to_char(w.ends_at, 'HH24:MI'),
            'left', greatest(0, floor(st.capacity - st.used))::integer,
            'status', case
              when (d::date + w.ends_at) at time zone 'Asia/Dhaka' - make_interval(mins => c.cutoff_minutes) <= now() then 'past'
              when st.blocked or st.capacity = 0 then 'closed'
              when st.capacity - st.used < 1 then 'full'
              when st.capacity - st.used <= 2 then 'few'
              else 'open' end
          ) order by w.sort)
          from public.capacity_windows w
          cross join lateral public.capacity_state(d::date, p_kind, p_zone, w.id) st
          where w.active
        )
      ) order by d)
      from generate_series(v_today, v_today + v_days - 1, interval '1 day') d
    )
  );
end;
$$;

/* ---------- reserve / release: the one place capacity is taken ---------- */

-- Takes `p_points` in one slot for `p_ref`, atomically (the slot row is locked for the rest of
-- the transaction). The same ref again is idempotent; a ref held elsewhere moves here. Full or
-- blocked slots refuse unless `p_override` gives a reason (staff and managers only; the admin
-- server decides who may). Website and staff bookings respect the booking cutoff and days ahead.
create or replace function public.capacity_reserve(
  p_ref text,
  p_kind text,
  p_date date,
  p_zone text,
  p_window text,
  p_points numeric default 1,
  p_source text default 'website',
  p_actor text default null,
  p_override text default null,
  p_task uuid default null,
  p_order text default null,
  p_customer text default null,
  p_area text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  c public.capacity_config;
  v_today date := (now() at time zone 'Asia/Dhaka')::date;
  v_ends timestamptz;
  v_prev public.capacity_reservations;
  v_cap integer; v_used numeric; v_blocked boolean;
  v_over boolean := false;
  v_reason text := nullif(left(btrim(coalesce(p_override, '')), 200), '');
  v_id uuid;
begin
  select * into c from public.capacity_config where id;
  if p_ref is null or char_length(p_ref) not between 8 and 160
     or p_kind not in ('pickup', 'delivery') or p_source not in ('website', 'staff', 'dispatch')
     or p_date is null or coalesce(p_points, 0) <= 0 or p_points > 20
     or not exists (select 1 from public.capacity_zones where id = p_zone and active)
     or not exists (select 1 from public.capacity_windows where id = p_window) then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  if p_date < v_today then
    return jsonb_build_object('ok', false, 'error', 'past');
  end if;
  if p_source in ('website', 'staff') then
    select b.ends into v_ends from public.capacity_window_bounds(p_date, p_window) b;
    if v_ends - make_interval(mins => c.cutoff_minutes) <= now() and v_reason is null then
      return jsonb_build_object('ok', false, 'error', 'past');
    end if;
    if p_date > v_today + c.days_ahead - 1 and v_reason is null then
      return jsonb_build_object('ok', false, 'error', 'too_far');
    end if;
  end if;

  -- Lock the slot (created on first use) so concurrent bookings queue here.
  insert into public.capacity_slots (slot_date, kind, zone_id, window_id)
  values (p_date, p_kind, p_zone, p_window) on conflict do nothing;
  perform 1 from public.capacity_slots
   where slot_date = p_date and kind = p_kind and zone_id = p_zone and window_id = p_window for update;

  select * into v_prev from public.capacity_reservations where ref = p_ref for update;
  if v_prev.id is not null and v_prev.status = 'held' and v_prev.slot_date = p_date and v_prev.kind = p_kind
     and v_prev.zone_id = p_zone and v_prev.window_id = p_window then
    return jsonb_build_object('ok', true, 'id', v_prev.id, 'over', v_prev.over_capacity, 'repeat', true);
  end if;

  select st.capacity, st.used, st.blocked into v_cap, v_used, v_blocked
    from public.capacity_state(p_date, p_kind, p_zone, p_window, p_ref) st;
  if v_blocked or v_used + p_points > v_cap then
    if v_reason is null or p_source = 'website' then
      return jsonb_build_object('ok', false, 'error', case when v_blocked or v_cap = 0 then 'closed' else 'full' end,
                                'capacity', v_cap, 'used', v_used);
    end if;
    v_over := true;
  end if;

  insert into public.capacity_reservations (ref, slot_date, kind, zone_id, window_id, points, status, source, task_id, order_number,
                                            customer_name, area, over_capacity, override_reason, created_by)
  values (p_ref, p_date, p_kind, p_zone, p_window, p_points, 'held', p_source, p_task, p_order,
          left(p_customer, 120), left(p_area, 120), v_over, case when v_over then v_reason end, left(p_actor, 120))
  on conflict (ref) do update
     set slot_date = excluded.slot_date, kind = excluded.kind, zone_id = excluded.zone_id, window_id = excluded.window_id,
         points = excluded.points, status = 'held', task_id = coalesce(excluded.task_id, capacity_reservations.task_id),
         order_number = coalesce(excluded.order_number, capacity_reservations.order_number),
         customer_name = coalesce(excluded.customer_name, capacity_reservations.customer_name),
         area = coalesce(excluded.area, capacity_reservations.area),
         over_capacity = excluded.over_capacity, override_reason = excluded.override_reason,
         created_by = excluded.created_by, updated_at = now()
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id, 'over', v_over);
end;
$$;

create or replace function public.capacity_release(p_ref text, p_status text default 'released')
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_n integer;
begin
  if p_status not in ('released', 'done') then return false; end if;
  update public.capacity_reservations set status = p_status, updated_at = now()
   where ref = p_ref and status = 'held';
  get diagnostics v_n = row_count;
  return v_n = 1;
end;
$$;

/* ---------- bookings: reserve + create the Ops task in one transaction ---------- */

-- The website (and staff booking for a WhatsApp customer) books a pickup window. The window is
-- reserved first; only then is the Ops pickup task created (website_create_request). If the
-- task can't be created, the reservation goes with it. The task is due at the end of the window.
-- p_slot: { "date": "2026-09-29", "window": "evening", "source": "website"|"staff", "actor": "...", "override": "..." }
create or replace function public.website_book_pickup(p_dedupe_key text, p_payload jsonb, p_slot jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_ref text := 'booking:' || coalesce(p_dedupe_key, '');
  v_zone text;
  v_date date;
  v_window text := p_slot->>'window';
  v_source text := coalesce(nullif(p_slot->>'source', ''), 'website');
  v_res jsonb;
  v_req jsonb;
  v_task uuid;
  v_ends timestamptz;
begin
  if p_dedupe_key is null or p_dedupe_key !~ '^[A-Za-z0-9._:-]{16,128}$' or jsonb_typeof(p_slot) <> 'object'
     or coalesce(p_slot->>'date', '') !~ '^\d{4}-\d{2}-\d{2}$' or v_source not in ('website', 'staff') then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  v_date := (p_slot->>'date')::date;
  v_zone := public.capacity_zone_for(p_payload->>'area');
  if v_zone is null or v_zone = 'other' then
    return jsonb_build_object('ok', false, 'error', 'no_zone');
  end if;

  v_res := public.capacity_reserve(v_ref, 'pickup', v_date, v_zone, v_window, 1, v_source,
                                   coalesce(nullif(p_slot->>'actor', ''), 'Velto website'),
                                   case when v_source = 'staff' then p_slot->>'override' end,
                                   null, null, left(btrim(p_payload->>'name'), 120), left(btrim(p_payload->>'area'), 120));
  if not (v_res->>'ok')::boolean then
    return jsonb_build_object('ok', false, 'error', 'slot_' || (v_res->>'error'));
  end if;

  v_req := public.website_create_request('booking', p_dedupe_key, p_payload);
  if not coalesce((v_req->>'ok')::boolean, false) then
    delete from public.capacity_reservations where ref = v_ref and task_id is null;
    return v_req;
  end if;

  select t.id into v_task from public.tasks t where t.dedupe_key = 'website:' || p_dedupe_key;
  select b.ends into v_ends from public.capacity_window_bounds(v_date, v_window) b;
  update public.capacity_reservations set task_id = v_task, updated_at = now() where ref = v_ref;
  update public.tasks set due_at = v_ends where id = v_task and status <> 'done';

  return v_req || jsonb_build_object('slot', jsonb_build_object('date', v_date, 'window', v_window, 'zone', v_zone,
                                                                'over', coalesce((v_res->>'over')::boolean, false)));
end;
$$;

/* ---------- the Capacity board ---------- */

create or replace function public.capacity_board(p_date date)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'date', p_date,
    'config', (select to_jsonb(c) - 'id' from public.capacity_config c where c.id),
    'windows', (select jsonb_agg(jsonb_build_object('id', w.id, 'starts', to_char(w.starts_at, 'HH24:MI'), 'ends', to_char(w.ends_at, 'HH24:MI'),
                                                    'active', w.active) order by w.sort) from public.capacity_windows w),
    'zones', (select jsonb_agg(jsonb_build_object('id', z.id, 'name', z.name, 'sectors', to_jsonb(z.sectors), 'active', z.active) order by z.sort)
              from public.capacity_zones z),
    'defaults', (select coalesce(jsonb_agg(jsonb_build_object('kind', d.kind, 'zone', d.zone_id, 'window', d.window_id, 'capacity', d.capacity)), '[]'::jsonb)
                 from public.capacity_defaults d),
    'slots', (
      select jsonb_agg(jsonb_build_object(
        'kind', k, 'zone', z.id, 'window', w.id,
        'capacity', st.capacity, 'used', st.used, 'blocked', coalesce(s.blocked, false), 'note', s.note,
        'override', s.capacity is not null,
        'reservations', coalesce((
          select jsonb_agg(jsonb_build_object(
            'ref', r.ref, 'source', r.source, 'status', r.status, 'points', r.points,
            'customerName', r.customer_name, 'area', r.area, 'orderNumber', r.order_number,
            'taskRef', case when r.task_id is not null then 'WEB-' || upper(substr(replace(r.task_id::text, '-', ''), 1, 8)) end,
            'over', r.over_capacity, 'reason', r.override_reason, 'by', r.created_by, 'at', r.created_at
          ) order by r.created_at)
          from public.capacity_reservations r
          where r.slot_date = p_date and r.kind = k and r.zone_id = z.id and r.window_id = w.id and r.status <> 'released'
        ), '[]'::jsonb)
      ))
      from unnest(array['pickup', 'delivery']) k
      cross join public.capacity_zones z
      cross join public.capacity_windows w
      left join public.capacity_slots s on s.slot_date = p_date and s.kind = k and s.zone_id = z.id and s.window_id = w.id
      cross join lateral public.capacity_state(p_date, k, z.id, w.id) st
      where z.active and w.active
    )
  )
$$;

-- A day's capacity for one slot (null capacity: back to the default), blocked, note.
create or replace function public.capacity_set_slot(p_date date, p_kind text, p_zone text, p_window text, p_capacity integer, p_blocked boolean, p_note text, p_actor text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if p_date is null or p_date < (now() at time zone 'Asia/Dhaka')::date or p_kind not in ('pickup', 'delivery')
     or not exists (select 1 from public.capacity_zones where id = p_zone)
     or not exists (select 1 from public.capacity_windows where id = p_window)
     or (p_capacity is not null and p_capacity not between 0 and 200) then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  insert into public.capacity_slots (slot_date, kind, zone_id, window_id, capacity, blocked, note, updated_by, updated_at)
  values (p_date, p_kind, p_zone, p_window, p_capacity, coalesce(p_blocked, false), nullif(left(btrim(coalesce(p_note, '')), 200), ''), left(p_actor, 120), now())
  on conflict (slot_date, kind, zone_id, window_id) do update
     set capacity = excluded.capacity, blocked = excluded.blocked, note = excluded.note, updated_by = excluded.updated_by, updated_at = now();
  return jsonb_build_object('ok', true);
end;
$$;

-- Defaults, zones, windows and the switch, from the board's settings.
create or replace function public.capacity_set_defaults(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare r jsonb;
begin
  if jsonb_typeof(p_rows) <> 'array' then return jsonb_build_object('ok', false, 'error', 'invalid'); end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    if (r->>'kind') not in ('pickup', 'delivery') or coalesce((r->>'capacity')::integer, -1) not between 0 and 200
       or not exists (select 1 from public.capacity_zones where id = r->>'zone')
       or not exists (select 1 from public.capacity_windows where id = r->>'window') then
      return jsonb_build_object('ok', false, 'error', 'invalid');
    end if;
    insert into public.capacity_defaults (kind, zone_id, window_id, capacity)
    values (r->>'kind', r->>'zone', r->>'window', (r->>'capacity')::smallint)
    on conflict (kind, zone_id, window_id) do update set capacity = excluded.capacity;
  end loop;
  return jsonb_build_object('ok', true);
end;
$$;

-- Zones: [{ id, name, sectors: [..], active }]. A sector may be in one active zone only.
create or replace function public.capacity_set_zones(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare r jsonb; v_all smallint[] := '{}'; v_s smallint[];
begin
  if jsonb_typeof(p_rows) <> 'array' then return jsonb_build_object('ok', false, 'error', 'invalid'); end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    select coalesce(array_agg(distinct x::smallint order by x::smallint), '{}') into v_s
      from jsonb_array_elements_text(coalesce(r->'sectors', '[]'::jsonb)) x where x ~ '^[0-9]{1,2}$' and x::int between 1 and 18;
    if coalesce(r->>'id', '') !~ '^[a-z0-9-]{1,20}$' or char_length(coalesce(btrim(r->>'name'), '')) not between 1 and 40 then
      return jsonb_build_object('ok', false, 'error', 'invalid');
    end if;
    if coalesce((r->>'active')::boolean, true) then
      if v_all && v_s then return jsonb_build_object('ok', false, 'error', 'overlap'); end if;
      v_all := v_all || v_s;
    end if;
    update public.capacity_zones set name = btrim(r->>'name'), sectors = v_s, active = coalesce((r->>'active')::boolean, true)
     where id = r->>'id';
    if not found then
      insert into public.capacity_zones (id, name, sectors, active, sort)
      values (r->>'id', btrim(r->>'name'), v_s, coalesce((r->>'active')::boolean, true), (select coalesce(max(sort), 0) + 1 from public.capacity_zones where id <> 'other'));
      insert into public.capacity_defaults (kind, zone_id, window_id, capacity)
      select d.kind, r->>'id', d.window_id, d.capacity from public.capacity_defaults d where d.zone_id = 's9-12' on conflict do nothing;
    end if;
  end loop;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.capacity_set_config(p_enabled boolean, p_days integer, p_cutoff integer, p_windows jsonb, p_actor text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare r jsonb;
begin
  if coalesce(p_days, 0) not between 1 and 30 or coalesce(p_cutoff, -1) not between 0 and 600 then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  if jsonb_typeof(p_windows) = 'array' then
    for r in select * from jsonb_array_elements(p_windows) loop
      if coalesce(r->>'starts', '') !~ '^\d{2}:\d{2}$' or coalesce(r->>'ends', '') !~ '^\d{2}:\d{2}$' or (r->>'ends')::time <= (r->>'starts')::time then
        return jsonb_build_object('ok', false, 'error', 'invalid');
      end if;
      update public.capacity_windows set starts_at = (r->>'starts')::time, ends_at = (r->>'ends')::time,
             active = coalesce((r->>'active')::boolean, active) where id = r->>'id';
    end loop;
  end if;
  update public.capacity_config set enabled = coalesce(p_enabled, false), days_ahead = p_days, cutoff_minutes = p_cutoff,
         updated_by = left(p_actor, 120), updated_at = now() where id;
  return jsonb_build_object('ok', true);
end;
$$;

/* ---------- dispatch: planned stops hold capacity too ---------- */

alter table public.website_dispatch_jobs drop constraint if exists website_dispatch_jobs_slot_check;
alter table public.website_dispatch_jobs add constraint website_dispatch_jobs_slot_check
  check (slot is null or slot in ('morning', 'afternoon', 'evening', 'night'));
alter table public.website_dispatch_jobs add column if not exists zone_id text;

-- The end of a window, from the windows table (the Ops reminder fires then).
create or replace function public.website_dispatch_slot_end(p_date date, p_slot text)
returns timestamptz language sql stable set search_path = pg_catalog, public as $$
  select coalesce((select b.ends from public.capacity_window_bounds(p_date, p_slot) b),
                  (p_date + time '21:00') at time zone 'Asia/Dhaka')
$$;

-- The reservation a job holds: its booking's (by task) or the one planning made.
create or replace function public.capacity_ref_for_job(p_job public.website_dispatch_jobs)
returns text language sql stable set search_path = pg_catalog, public as $$
  select coalesce(
    (select r.ref from public.capacity_reservations r where p_job.task_id is not null and r.task_id = p_job.task_id and r.kind = p_job.kind
      order by (r.status = 'held') desc, r.updated_at desc limit 1),
    case when p_job.kind = 'delivery' then 'dispatch:delivery:' || p_job.order_number else 'dispatch:pickup:' || p_job.id::text end)
$$;

-- After every sync: a website pickup that booked a window arrives on the board confirmed for that
-- day and window (website_dispatch_stages.sql: nobody needs to call; the manager gives it a person).
create or replace function public.capacity_sync_jobs()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_n integer;
begin
  update public.website_dispatch_jobs j
     set slot_date = r.slot_date, slot = r.window_id, zone_id = r.zone_id,
         stage = case when j.assignee_id is not null then 'scheduled' else 'confirmed' end,
         confirmed_at = coalesce(j.confirmed_at, r.created_at),
         confirmed_by = coalesce(j.confirmed_by, 'Website (window booked)'),
         history = j.history || jsonb_build_array(jsonb_build_object('at', now(), 'by', 'Capacity',
                    'action', 'window booked', 'detail', to_char(r.slot_date, 'Dy DD Mon') || ' ' || r.window_id)),
         updated_at = now()
    from public.capacity_reservations r
   where j.kind = 'pickup' and j.task_id is not null and r.task_id = j.task_id and r.kind = 'pickup' and r.status = 'held'
     and j.slot_date is null and j.stage in ('new', 'confirmed', 'assigned');
  get diagnostics v_n = row_count;
  -- Stops closed on the board free (cancelled, merged) or keep (picked, done) their place.
  update public.capacity_reservations r set status = case when j.stage in ('picked', 'done') then 'done' else 'released' end, updated_at = now()
    from public.website_dispatch_jobs j
   where r.status = 'held' and j.stage in ('picked', 'done', 'cancelled', 'merged') and r.ref = public.capacity_ref_for_job(j);
  return v_n;
end;
$$;

-- Whatever changes a job, its place follows (the board, Velto Ops, a phone confirmation on the
-- Requests card, or the customer changing or cancelling on the website, which set the plan
-- directly):
--   * closed (cancelled, merged) frees the place; picked or done keeps it as done;
--   * plan cleared frees it;
--   * a day + window set without a place (e.g. website_dispatch_contact 'confirmed') takes one, so
--     the website can never sell it again; if the window was already full it is marked over
--     capacity for the manager to see.
-- Idempotent with the functions here (they reserve first, so the trigger finds the place held).
create or replace function public.capacity_job_changed()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_ref text;
begin
  v_ref := public.capacity_ref_for_job(new);
  if new.stage is distinct from old.stage and new.stage in ('cancelled', 'merged') then
    perform public.capacity_release(v_ref, 'released');
  elsif new.stage is distinct from old.stage and new.stage in ('picked', 'done') then
    perform public.capacity_release(v_ref, 'done');
  elsif new.slot_date is null and old.slot_date is not null then
    perform public.capacity_release(v_ref, 'released');
  elsif new.slot_date is not null and new.stage in ('new', 'confirmed', 'assigned', 'scheduled')
        and (new.slot_date, new.slot) is distinct from (old.slot_date, old.slot)
        and not exists (select 1 from public.capacity_reservations r
                         where r.ref = v_ref and r.status = 'held' and r.slot_date = new.slot_date and r.window_id = new.slot) then
    perform public.capacity_reserve(v_ref, new.kind, new.slot_date,
                                    coalesce(new.zone_id, public.capacity_zone_for(concat_ws(' ', new.area, new.address)), 'other'),
                                    new.slot, 1, 'dispatch', 'Velto team', 'Set outside the capacity check (e.g. confirmed by phone)',
                                    new.task_id, new.order_number, new.customer_name, new.area);
  end if;
  return null;
end;
$$;

drop trigger if exists capacity_job_changed on public.website_dispatch_jobs;
create trigger capacity_job_changed
  after update of slot_date, stage on public.website_dispatch_jobs
  for each row execute function public.capacity_job_changed();

-- Planning a stop takes its place in the window (a full window needs a reason from the manager).
-- Unplanning frees it. The previous plan function is replaced by this one (new p_override).
drop function if exists public.website_dispatch_plan(uuid, uuid, text, date, text, text);
create or replace function public.website_dispatch_plan(
  p_job uuid,
  p_assignee_id uuid,
  p_assignee_name text,
  p_slot_date date,
  p_slot text,
  p_actor text,
  p_override text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  j public.website_dispatch_jobs;
  v_due timestamptz;
  v_task uuid;
  v_name text := nullif(left(btrim(coalesce(p_assignee_name, '')), 120), '');
  v_ref text;
  v_zone text;
  v_res jsonb;
begin
  select * into j from public.website_dispatch_jobs where id = p_job for update;
  if j.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if j.stage not in ('new', 'confirmed', 'assigned', 'scheduled') then return jsonb_build_object('ok', false, 'error', 'closed'); end if;
  if (p_slot_date is null) <> (p_slot is null) or (p_slot is not null and not exists (select 1 from public.capacity_windows where id = p_slot)) then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  if p_assignee_id is not null and not exists (select 1 from public.profiles where id = p_assignee_id and active) then
    return jsonb_build_object('ok', false, 'error', 'assignee');
  end if;
  if p_slot_date is not null and p_slot_date < (now() at time zone 'Asia/Dhaka')::date then
    return jsonb_build_object('ok', false, 'error', 'past');
  end if;

  -- Capacity first: nothing changes unless the window has room (or the manager overrides).
  v_ref := public.capacity_ref_for_job(j);
  v_zone := coalesce(j.zone_id, public.capacity_zone_for(concat_ws(' ', j.area, j.address)), 'other');
  if p_slot_date is not null then
    v_res := public.capacity_reserve(v_ref, j.kind, p_slot_date, v_zone, p_slot, 1, 'dispatch', p_actor, p_override,
                                     j.task_id, j.order_number, j.customer_name, j.area);
    if not (v_res->>'ok')::boolean then
      return jsonb_build_object('ok', false, 'error', 'slot_' || (v_res->>'error'), 'capacity', v_res->'capacity', 'used', v_res->'used');
    end if;
  else
    perform public.capacity_release(v_ref, 'released');
  end if;

  v_due := case when p_slot_date is not null then public.website_dispatch_slot_end(p_slot_date, p_slot) end;

  update public.website_dispatch_jobs
     set assignee_id = p_assignee_id,
         assignee_name = case when p_assignee_id is null then null else v_name end,
         slot_date = p_slot_date,
         slot = p_slot,
         zone_id = v_zone,
         stage = case when p_assignee_id is not null and p_slot_date is not null then 'scheduled'
                      when j.confirmed_at is not null and p_slot_date is not null then 'confirmed'
                      when p_assignee_id is not null or p_slot_date is not null then 'assigned'
                      else 'new' end,
         updated_at = now()
   where id = p_job;

  if j.kind = 'pickup' then
    update public.tasks
       set assigned_to = p_assignee_id,
           assigned_to_name = case when p_assignee_id is null then null else v_name end,
           assignee_ids = case when p_assignee_id is null then '{}'::uuid[] else array[p_assignee_id] end,
           assignee_names = case when p_assignee_id is null then '{}'::text[] else array[v_name] end,
           assigned_by_name = left(p_actor, 120),
           due_at = coalesce(v_due, due_at),
           reminded = false
     where id = j.task_id and status <> 'done';
  elsif p_assignee_id is not null then
    insert into public.tasks (title, type, priority, status, due_at, outlet_code, description, order_number,
                              assigned_to, assigned_to_name, assignee_ids, assignee_names, assigned_by_name,
                              source, source_ref, dedupe_key)
    values (left('Deliver ' || j.order_number || coalesce(' - ' || j.customer_name, ''), 200), 'delivery', 'normal', 'open',
            coalesce(v_due, now() + interval '4 hours'), j.outlet_code,
            concat_ws(' · ', 'Delivery planned in the website Command Center', 'Phone: ' || j.phone, 'Address: ' || j.address, 'Area: ' || j.area),
            j.order_number, p_assignee_id, v_name, array[p_assignee_id], array[v_name], left(p_actor, 120),
            'website_dispatch', j.order_number, 'website-dispatch:delivery:' || j.order_number)
    on conflict (dedupe_key) where dedupe_key is not null do update
       set assigned_to = excluded.assigned_to, assigned_to_name = excluded.assigned_to_name,
           assignee_ids = excluded.assignee_ids, assignee_names = excluded.assignee_names,
           assigned_by_name = excluded.assigned_by_name, due_at = excluded.due_at,
           status = 'open', done_at = null, done_by_name = null, reminded = false
    returning id into v_task;
    update public.website_dispatch_jobs set task_id = v_task where id = p_job;
  elsif j.task_id is not null then
    update public.tasks set status = 'done', done_at = now(), done_by_name = 'Unassigned: ' || left(p_actor, 100)
     where id = j.task_id and status <> 'done';
  end if;

  perform public.website_dispatch_log(p_job, p_actor, 'planned',
    concat_ws(', ', coalesce(v_name, 'unassigned'), to_char(p_slot_date, 'Dy DD Mon') || ' ' || p_slot,
              case when (v_res->>'over')::boolean then 'over capacity: ' || left(p_override, 120) end));
  return jsonb_build_object('ok', true, 'over', coalesce((v_res->>'over')::boolean, false));
end;
$$;

/* ---------- grants: service role only (active staff read the tables through RLS) ---------- */

do $$
declare f text;
begin
  foreach f in array array[
    'public.capacity_zone_for(text)',
    'public.capacity_window_bounds(date,text)',
    'public.capacity_state(date,text,text,text,text)',
    'public.capacity_availability(text,text,integer)',
    'public.capacity_reserve(text,text,date,text,text,numeric,text,text,text,uuid,text,text,text)',
    'public.capacity_release(text,text)',
    'public.website_book_pickup(text,jsonb,jsonb)',
    'public.capacity_board(date)',
    'public.capacity_set_slot(date,text,text,text,integer,boolean,text,text)',
    'public.capacity_set_defaults(jsonb)',
    'public.capacity_set_zones(jsonb)',
    'public.capacity_set_config(boolean,integer,integer,jsonb,text)',
    'public.website_dispatch_slot_end(date,text)',
    'public.capacity_ref_for_job(public.website_dispatch_jobs)',
    'public.capacity_sync_jobs()',
    'public.capacity_job_changed()',
    'public.website_dispatch_plan(uuid,uuid,text,date,text,text,text)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;

commit;
