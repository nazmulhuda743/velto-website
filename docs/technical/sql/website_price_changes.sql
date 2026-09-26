-- Price list changes with Owner approval.
--
-- Managers (and Owners) propose adding, editing or removing a price from the
-- website admin panel. Nothing touches Velto Ops until an Owner approves; then
-- the change is written to public.price_list in one transaction, so the website
-- and Ops billing always use the same prices (owner decision, 2026-09-26).
--
-- - Remove is a soft delete (active = false, is_active = false): Ops keeps the
--   row for its history and the website stops showing it. Restore undoes it.
-- - An edit or remove is refused at approval time if the Ops row changed after
--   the request was made (someone edited it in Ops meanwhile).
-- - One open request per price row at a time.
-- - Roles are enforced by the website server (only Owners reach the decide
--   function); the database records who asked and who decided.
--
-- Everything is service_role only.
--
-- Status: applied to STAGING (ekgdefcdqcsqvpbqponv) and tested with
-- docs/technical/sql/tests/website_price_changes_test.sql; production only
-- with the owner's approval.

begin;

do $$
begin
  if exists (
    select 1
    from (values
      ('price_list', 'id'), ('price_list', 'item_no'), ('price_list', 'category'), ('price_list', 'item_name'),
      ('price_list', 'service_category'), ('price_list', 'price'), ('price_list', 'unit'), ('price_list', 'price_type'),
      ('price_list', 'hanger'), ('price_list', 'note'), ('price_list', 'active'), ('price_list', 'is_active'),
      ('price_list', 'sort_order'), ('price_list', 'updated_at'), ('price_list', 'item_group'), ('price_list', 'is_popular')
    ) as req(tbl, col)
    where not exists (
      select 1 from information_schema.columns c
      where c.table_schema = 'public' and c.table_name = req.tbl and c.column_name = req.col
    )
  ) then
    raise exception 'website_price_changes: Ops price_list does not match the reviewed contract';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. Requests
-- ---------------------------------------------------------------------------
create table if not exists public.website_price_changes (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('add', 'edit', 'remove', 'restore')),
  price_id bigint references public.price_list(id) on delete set null,
  proposed jsonb not null default '{}'::jsonb,
  before jsonb,
  reason text check (reason is null or length(reason) <= 500),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  requested_by_id uuid,
  requested_by_name text not null check (length(requested_by_name) between 1 and 120),
  requested_by_role text not null check (length(requested_by_role) between 1 and 20),
  requested_at timestamptz not null default now(),
  decided_by_name text,
  decided_at timestamptz,
  decision_note text check (decision_note is null or length(decision_note) <= 500),
  result_price_id bigint,
  check ((kind = 'add') = (price_id is null) or status <> 'pending')
);

create index if not exists website_price_changes_status_idx on public.website_price_changes (status, requested_at desc);
create unique index if not exists website_price_changes_one_open_idx
  on public.website_price_changes (price_id) where status = 'pending' and price_id is not null;

alter table public.website_price_changes enable row level security;
revoke all on public.website_price_changes from anon, authenticated, public, service_role;
grant select on public.website_price_changes to service_role;

-- ---------------------------------------------------------------------------
-- 2. Validation (same rules as Ops' own constraints, plus sane bounds)
-- ---------------------------------------------------------------------------
create or replace function public.website_price_clean(p jsonb)
returns jsonb
language plpgsql
immutable
set search_path = pg_catalog, public
as $$
declare
  v_name text := btrim(coalesce(p->>'item_name', ''));
  v_category text := btrim(coalesce(p->>'category', ''));
  v_service text := coalesce(p->>'service_category', '');
  v_type text := coalesce(nullif(p->>'price_type', ''), 'fixed');
  v_price numeric;
  v_hanger text := nullif(p->>'hanger', '');
  v_group text := nullif(p->>'item_group', '');
  v_note text := nullif(btrim(coalesce(p->>'note', '')), '');
begin
  if length(v_name) not between 2 and 120 then raise exception 'Item name must be 2 to 120 characters.' using errcode = '22023'; end if;
  if length(v_category) not between 2 and 60 then raise exception 'Choose a category.' using errcode = '22023'; end if;
  if v_service not in ('Ironing', 'Wash + Iron', 'Dry Cleaning') then raise exception 'Choose a service.' using errcode = '22023'; end if;
  if v_type not in ('fixed', 'per_sqft', 'poa') then raise exception 'Choose a price type.' using errcode = '22023'; end if;
  if v_type = 'poa' then
    v_price := null;
  else
    begin
      v_price := round((p->>'price')::numeric, 2);
    exception when others then
      raise exception 'Enter a price in taka.' using errcode = '22023';
    end;
    if v_price is null or v_price <= 0 or v_price > 1000000 then raise exception 'Price must be between 1 and 10,00,000 taka.' using errcode = '22023'; end if;
  end if;
  if v_hanger is not null and v_hanger not in ('request', 'must') then raise exception 'Unknown hanger option.' using errcode = '22023'; end if;
  if v_group is not null and v_group not in ('Men', 'Women', 'Household', 'Special') then raise exception 'Unknown item group.' using errcode = '22023'; end if;
  if v_note is not null and length(v_note) > 200 then raise exception 'Keep the note under 200 characters.' using errcode = '22023'; end if;
  return jsonb_build_object(
    'item_name', v_name,
    'category', v_category,
    'service_category', v_service,
    'price', v_price,
    'price_type', v_type,
    'unit', case when v_type = 'per_sqft' then 'sqft' else 'item' end,
    'hanger', v_hanger,
    'item_group', v_group,
    'note', v_note,
    'is_popular', coalesce((p->>'is_popular')::boolean, false)
  );
end;
$$;

create or replace function public.website_price_row(r public.price_list)
returns jsonb
language sql
stable
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'id', r.id, 'item_no', r.item_no, 'item_name', r.item_name, 'category', r.category,
    'service_category', r.service_category, 'price', r.price, 'price_type', r.price_type, 'unit', r.unit,
    'hanger', r.hanger, 'item_group', r.item_group, 'note', r.note, 'is_popular', r.is_popular,
    'active', r.active and r.is_active, 'updated_at', r.updated_at
  );
$$;

-- ---------------------------------------------------------------------------
-- 3. Propose a change (manager or owner)
-- ---------------------------------------------------------------------------
create or replace function public.website_price_change_request(
  p_kind text, p_price_id bigint, p_proposed jsonb, p_reason text,
  p_by_id uuid, p_by_name text, p_by_role text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_row public.price_list;
  v_clean jsonb := '{}'::jsonb;
  v_id uuid;
begin
  if p_kind not in ('add', 'edit', 'remove', 'restore') then raise exception 'Unknown change.' using errcode = '22023'; end if;
  if p_kind = 'add' then
    v_clean := public.website_price_clean(p_proposed);
    if exists (
      select 1 from public.price_list
      where lower(item_name) = lower(v_clean->>'item_name') and service_category = v_clean->>'service_category'
    ) then
      raise exception 'This item already has a % price. Edit it instead.', v_clean->>'service_category' using errcode = '23505';
    end if;
  else
    select * into v_row from public.price_list where id = p_price_id;
    if not found then raise exception 'Price not found.' using errcode = 'P0002'; end if;
    if p_kind = 'remove' and not (v_row.active and v_row.is_active) then raise exception 'This price is already removed.' using errcode = '22023'; end if;
    if p_kind = 'restore' and (v_row.active and v_row.is_active) then raise exception 'This price is already live.' using errcode = '22023'; end if;
    if p_kind = 'edit' then
      v_clean := public.website_price_clean(p_proposed);
      if exists (
        select 1 from public.price_list
        where id <> p_price_id and lower(item_name) = lower(v_clean->>'item_name') and service_category = v_clean->>'service_category'
      ) then
        raise exception 'Another price already uses this name and service.' using errcode = '23505';
      end if;
    end if;
    if exists (select 1 from public.website_price_changes where price_id = p_price_id and status = 'pending') then
      raise exception 'This price already has a change waiting for approval.' using errcode = '23505';
    end if;
  end if;

  insert into public.website_price_changes (kind, price_id, proposed, before, reason, requested_by_id, requested_by_name, requested_by_role)
  values (
    p_kind,
    case when p_kind = 'add' then null else p_price_id end,
    v_clean,
    case when p_kind = 'add' then null else public.website_price_row(v_row) end,
    nullif(left(btrim(coalesce(p_reason, '')), 500), ''),
    p_by_id, left(p_by_name, 120), left(p_by_role, 20)
  )
  returning id into v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Decide (owners only, enforced by the website server)
-- ---------------------------------------------------------------------------
create or replace function public.website_price_change_decide(p_id uuid, p_decision text, p_by_name text, p_note text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  c public.website_price_changes;
  v_row public.price_list;
  v_new_id bigint;
  v_item_no integer;
  p jsonb;
begin
  if p_decision not in ('approve', 'reject', 'cancel') then raise exception 'Unknown decision.' using errcode = '22023'; end if;
  select * into c from public.website_price_changes where id = p_id for update;
  if not found then raise exception 'Request not found.' using errcode = 'P0002'; end if;
  if c.status <> 'pending' then raise exception 'This request was already %.', c.status using errcode = '55000'; end if;

  if p_decision in ('reject', 'cancel') then
    update public.website_price_changes
       set status = case when p_decision = 'reject' then 'rejected' else 'cancelled' end,
           decided_by_name = left(p_by_name, 120), decided_at = now(),
           decision_note = nullif(left(btrim(coalesce(p_note, '')), 500), '')
     where id = p_id;
    return jsonb_build_object('status', case when p_decision = 'reject' then 'rejected' else 'cancelled' end);
  end if;

  -- Re-validate what will be written (a remove writes no fields).
  if c.kind in ('add', 'edit') then p := public.website_price_clean(c.proposed); end if;
  if c.kind = 'add' then
    if exists (
      select 1 from public.price_list
      where lower(item_name) = lower(p->>'item_name') and service_category = p->>'service_category'
    ) then
      raise exception 'This item now already exists for %; reject this request and edit the existing price.', p->>'service_category' using errcode = '23505';
    end if;
    -- The same item in another service shares its item number; a new item gets the next one.
    select item_no into v_item_no from public.price_list where lower(item_name) = lower(p->>'item_name') and item_no is not null limit 1;
    if v_item_no is null then select coalesce(max(item_no), 0) + 1 into v_item_no from public.price_list; end if;
    insert into public.price_list (item_no, category, item_name, service_category, price, unit, price_type, hanger, note, item_group, is_popular, active, is_active, sort_order)
    values (
      v_item_no, p->>'category', p->>'item_name', p->>'service_category', (p->>'price')::numeric, p->>'unit', p->>'price_type',
      p->>'hanger', p->>'note', p->>'item_group', (p->>'is_popular')::boolean, true, true,
      (select coalesce(max(sort_order), 0) + 1 from public.price_list)
    )
    returning id into v_new_id;
  else
    select * into v_row from public.price_list where id = c.price_id for update;
    if not found then raise exception 'This price no longer exists in Ops.' using errcode = 'P0002'; end if;
    -- Changed in Ops since the request (by content or by its touch timestamp)?
    if (public.website_price_row(v_row) - 'updated_at') is distinct from (c.before - 'updated_at')
       or v_row.updated_at is distinct from (c.before->>'updated_at')::timestamptz then
      raise exception 'This price was changed in Ops after the request was made. Reject it and ask for a fresh request.' using errcode = '40001';
    end if;
    if c.kind = 'edit' then
      update public.price_list set
        category = p->>'category', item_name = p->>'item_name', service_category = p->>'service_category',
        price = (p->>'price')::numeric, unit = p->>'unit', price_type = p->>'price_type', hanger = p->>'hanger',
        note = p->>'note', item_group = p->>'item_group', is_popular = (p->>'is_popular')::boolean
      where id = c.price_id;
    elsif c.kind = 'remove' then
      update public.price_list set active = false, is_active = false where id = c.price_id;
    else
      update public.price_list set active = true, is_active = true where id = c.price_id;
    end if;
    v_new_id := c.price_id;
  end if;

  update public.website_price_changes
     set status = 'approved', decided_by_name = left(p_by_name, 120), decided_at = now(),
         decision_note = nullif(left(btrim(coalesce(p_note, '')), 500), ''), result_price_id = v_new_id
   where id = p_id;
  return jsonb_build_object('status', 'approved', 'priceId', v_new_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Lists for the admin panel
-- ---------------------------------------------------------------------------
-- Every price row (active and removed) with any open request, for the Prices editor.
create or replace function public.website_price_admin_list()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select coalesce(jsonb_agg(public.website_price_row(p) || jsonb_build_object(
    'pending', (select jsonb_build_object('id', c.id, 'kind', c.kind, 'by', c.requested_by_name, 'at', c.requested_at)
                from public.website_price_changes c where c.price_id = p.id and c.status = 'pending')
  ) order by p.category, p.item_name, p.service_category), '[]'::jsonb)
  from public.price_list p;
$$;

create or replace function public.website_price_change_list(p_status text, p_limit integer default 100)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select coalesce(jsonb_agg(to_jsonb(c) || jsonb_build_object(
    'current', (select public.website_price_row(p) from public.price_list p where p.id = c.price_id)
  ) order by c.requested_at desc), '[]'::jsonb)
  from (
    select * from public.website_price_changes
    where p_status = 'all' or status = p_status
    order by requested_at desc
    limit least(greatest(coalesce(p_limit, 100), 1), 500)
  ) c;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'website_price_clean(jsonb)',
    'website_price_row(public.price_list)',
    'website_price_change_request(text, bigint, jsonb, text, uuid, text, text)',
    'website_price_change_decide(uuid, text, text, text)',
    'website_price_admin_list()',
    'website_price_change_list(text, integer)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end;
$$;

commit;
