-- Customer account extras: order feedback, loyalty counts and saved preferences.
--
-- Same rules as customer_portal.sql: customers reach their own rows only through the
-- security-definer functions below (caller = auth.uid(), via portal_caller()); tables have RLS on
-- and no API grants. Staff read feedback through service_role functions from the website admin.
--
-- Requires: customer_portal.sql (customer_accounts, portal_caller) and website_board.sql
-- (website_board_tasks, website_board_comments). Idempotent: safe to run again.

-------------------------------------------------------------------------------
-- 1. Order feedback
-------------------------------------------------------------------------------

create table if not exists public.customer_order_feedback (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid not null references auth.users (id) on delete cascade,
  customer_id   uuid not null references public.customers (id) on delete cascade,
  order_number  text not null check (order_number ~ '^VELR?-[0-9]{5}$'),
  rating        smallint not null check (rating between 1 and 5),
  issues        text[] not null default '{}' check (
    cardinality(issues) <= 8
    and issues <@ array['missing_item', 'damage', 'stain', 'ironing', 'smell', 'late', 'service', 'other']::text[]
  ),
  comment       text check (comment is null or char_length(comment) <= 1000),
  task_id       uuid references public.website_board_tasks (id) on delete set null,
  handled_at    timestamptz,
  handled_by    text check (handled_by is null or char_length(handled_by) <= 120),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (customer_id, order_number)
);

comment on table public.customer_order_feedback is
  'One rating per delivered order, written by the customer from their website account. Ratings of 3 or less also open a task on the website task board.';

create index if not exists customer_order_feedback_recent_idx on public.customer_order_feedback (created_at desc);

alter table public.customer_order_feedback enable row level security;
revoke all on table public.customer_order_feedback from public, anon, authenticated, service_role;
grant select on table public.customer_order_feedback to service_role;
grant update (handled_at, handled_by) on table public.customer_order_feedback to service_role;

-- Customer: rate a delivered order (or change the rating within 14 days of first rating it).
create or replace function public.portal_feedback_save(
  p_order_number text,
  p_rating integer,
  p_issues text[] default '{}',
  p_comment text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_acc public.customer_accounts;
  v_number text := upper(btrim(coalesce(p_order_number, '')));
  v_comment text := nullif(btrim(coalesce(p_comment, '')), '');
  v_issues text[];
  v_status text;
  v_prev public.customer_order_feedback;
  v_row public.customer_order_feedback;
  v_task uuid;
  v_labels text;
  v_position double precision;
begin
  v_acc := public.portal_caller();
  if v_acc.customer_id is null or v_acc.link_status <> 'linked' then
    raise exception 'not linked' using errcode = '42501';
  end if;
  if v_number !~ '^VELR?-[0-9]{5}$' then
    raise exception 'invalid order' using errcode = '22023';
  end if;
  if p_rating is null or p_rating not between 1 and 5 then
    raise exception 'invalid rating' using errcode = '22023';
  end if;
  if v_comment is not null and char_length(v_comment) > 1000 then
    raise exception 'comment too long' using errcode = '22023';
  end if;

  select o.order_status into v_status from public.orders o
   where o.order_number = v_number and o.customer_id = v_acc.customer_id
   order by o.created_at desc limit 1;
  if v_status is null then
    raise exception 'order not found' using errcode = 'P0002';
  end if;
  if v_status <> 'Delivered' then
    raise exception 'order not delivered' using errcode = '22023';
  end if;

  select coalesce(array_agg(distinct i order by i), '{}') into v_issues
    from unnest(coalesce(p_issues, '{}')) i
   where i = any (array['missing_item', 'damage', 'stain', 'ironing', 'smell', 'late', 'service', 'other']);

  select * into v_prev from public.customer_order_feedback
   where customer_id = v_acc.customer_id and order_number = v_number;
  if v_prev.id is not null and v_prev.created_at < now() - interval '14 days' then
    raise exception 'feedback closed' using errcode = '42501';
  end if;

  insert into public.customer_order_feedback (auth_user_id, customer_id, order_number, rating, issues, comment)
  values (v_acc.auth_user_id, v_acc.customer_id, v_number, p_rating, v_issues, v_comment)
  on conflict (customer_id, order_number) do update
    set rating = excluded.rating, issues = excluded.issues, comment = excluded.comment,
        auth_user_id = excluded.auth_user_id, updated_at = now()
  returning * into v_row;

  -- An unhappy customer becomes a task for the team. No name or phone on the board (every
  -- dashboard role can see it); staff look the customer up on Customer feedback.
  if p_rating <= 3 then
    select string_agg(case i
      when 'missing_item' then 'Item missing' when 'damage' then 'Damaged' when 'stain' then 'Stain not removed'
      when 'ironing' then 'Ironing / folding' when 'smell' then 'Smell' when 'late' then 'Late'
      when 'service' then 'Staff / service' else 'Other' end, ', ') into v_labels
      from unnest(v_issues) i;
    if v_row.task_id is null then
      select coalesce(max(t.position), 0) + 1024 into v_position
        from public.website_board_tasks t where t.status = 'todo' and not t.archived;
      insert into public.website_board_tasks (title, description, status, priority, labels, position, created_by_name)
      values (
        format('Customer feedback: %s rated %s of 5', v_number, p_rating),
        concat_ws(E'\n',
          format('Rating: %s of 5', p_rating),
          case when v_labels is not null then 'What went wrong: ' || v_labels end,
          case when v_comment is not null then 'Customer wrote: ' || v_comment end,
          'Who and how to reach them: Customer feedback in the dashboard (Owner, Manager, Support). Please contact the customer.'
        ),
        'todo',
        case when p_rating <= 2 then 'urgent' else 'high' end,
        array['feedback'],
        v_position,
        'Website (customer feedback)'
      )
      returning id into v_task;
      update public.customer_order_feedback set task_id = v_task where id = v_row.id;
      v_row.task_id := v_task;
    elsif v_prev.id is not null then
      insert into public.website_board_comments (task_id, author_name, body)
      values (v_row.task_id, 'Website (customer feedback)',
              left(concat_ws(E'\n', format('The customer changed the rating to %s of 5.', p_rating),
                             case when v_labels is not null then 'What went wrong: ' || v_labels end,
                             case when v_comment is not null then 'Customer wrote: ' || v_comment end), 2000));
    end if;
  elsif v_row.task_id is not null and v_prev.id is not null and v_prev.rating <= 3 then
    insert into public.website_board_comments (task_id, author_name, body)
    values (v_row.task_id, 'Website (customer feedback)', format('The customer changed the rating to %s of 5.', p_rating));
  end if;

  return jsonb_build_object(
    'orderNumber', v_row.order_number, 'rating', v_row.rating, 'issues', to_jsonb(v_row.issues),
    'comment', v_row.comment, 'createdAt', v_row.created_at,
    'editable', v_row.created_at >= now() - interval '14 days'
  );
end;
$$;

-- Customer: their ratings (so the account shows which orders are rated).
create or replace function public.portal_feedback_list()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_acc public.customer_accounts;
begin
  v_acc := public.portal_caller();
  if v_acc.customer_id is null or v_acc.link_status <> 'linked' then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'orderNumber', f.order_number, 'rating', f.rating, 'issues', to_jsonb(f.issues), 'comment', f.comment,
      'createdAt', f.created_at, 'editable', f.created_at >= now() - interval '14 days'
    ) order by f.created_at desc)
    from (select * from public.customer_order_feedback where customer_id = v_acc.customer_id order by created_at desc limit 200) f
  ), '[]'::jsonb);
end;
$$;

-- Staff: recent feedback with who left it (website admin, Customer feedback page).
create or replace function public.website_feedback_list(p_limit integer default 200)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(r order by (r ->> 'createdAt') desc), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id', f.id, 'orderNumber', f.order_number, 'rating', f.rating, 'issues', to_jsonb(f.issues),
      'comment', f.comment, 'createdAt', f.created_at, 'updatedAt', f.updated_at,
      'handledAt', f.handled_at, 'handledBy', f.handled_by, 'taskId', f.task_id,
      'customerName', cu.name, 'customerPhone', cu.phone
    ) as r
    from public.customer_order_feedback f
    left join public.customers cu on cu.id = f.customer_id
    order by f.created_at desc
    limit least(greatest(coalesce(p_limit, 200), 1), 500)
  ) x;
$$;

create or replace function public.website_feedback_handle(p_id uuid, p_staff text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.customer_order_feedback
     set handled_at = now(), handled_by = left(btrim(coalesce(p_staff, 'Staff')), 120)
   where id = p_id and handled_at is null;
  return found;
end;
$$;

-------------------------------------------------------------------------------
-- 2. Loyalty counts (tiers and rewards themselves are website settings)
-------------------------------------------------------------------------------

-- Customer: how many (not cancelled) orders in the last p_months, and in total.
create or replace function public.portal_loyalty(p_months integer default 12)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_acc public.customer_accounts;
  v_months integer := least(greatest(coalesce(p_months, 12), 1), 36);
begin
  v_acc := public.portal_caller();
  if v_acc.customer_id is null or v_acc.link_status <> 'linked' then
    return jsonb_build_object('linked', false);
  end if;
  return (
    select jsonb_build_object(
      'linked', true,
      'recent', count(*) filter (where o.order_date >= (now() at time zone 'Asia/Dhaka')::date - make_interval(months => v_months)),
      'total', count(*),
      'first', min(o.order_date),
      'last', max(o.order_date)
    )
    from public.orders o
    where o.customer_id = v_acc.customer_id and o.order_status is distinct from 'Cancelled' and o.order_date is not null
  );
end;
$$;

-- Staff: how many customers fall in each tier (p_mins = the minimum orders of each tier, ascending).
create or replace function public.website_loyalty_distribution(p_months integer, p_mins integer[])
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with c as (
    select o.customer_id, count(*) as n, sum(coalesce(o.total_amount, 0)) as spend
    from public.orders o
    where o.customer_id is not null and o.order_status is distinct from 'Cancelled' and o.order_date is not null
      and o.order_date >= (now() at time zone 'Asia/Dhaka')::date - make_interval(months => least(greatest(coalesce(p_months, 12), 1), 36))
    group by o.customer_id
  ),
  t as (
    select c.*, (select count(*) from unnest(p_mins) m where c.n >= m) as tier from c
  )
  select jsonb_build_object(
    'customers', (select count(*) from t),
    'spend', (select coalesce(sum(spend), 0) from t),
    'tiers', coalesce((
      select jsonb_agg(jsonb_build_object('tier', g.tier, 'customers', g.customers, 'spend', g.spend) order by g.tier)
      from (select tier, count(*) as customers, sum(spend) as spend from t group by tier) g
    ), '[]'::jsonb)
  );
$$;

-------------------------------------------------------------------------------
-- 3. Saved preferences: garment care and pickup addresses
-------------------------------------------------------------------------------

create table if not exists public.customer_preferences (
  auth_user_id uuid primary key references auth.users (id) on delete cascade,
  care         jsonb not null default '{}'::jsonb check (jsonb_typeof(care) = 'object' and pg_column_size(care) <= 2000),
  addresses    jsonb not null default '[]'::jsonb check (jsonb_typeof(addresses) = 'array' and jsonb_array_length(addresses) <= 3),
  updated_at   timestamptz not null default now()
);

comment on table public.customer_preferences is
  'Website customer choices: how they like garments handled and up to three saved pickup addresses. Added to their booking request as a note; Ops is not changed.';

alter table public.customer_preferences enable row level security;
revoke all on table public.customer_preferences from public, anon, authenticated, service_role;

create or replace function public.portal_prefs_get()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_row public.customer_preferences;
begin
  perform public.portal_caller();
  select * into v_row from public.customer_preferences where auth_user_id = v_uid;
  return jsonb_build_object('care', coalesce(v_row.care, '{}'::jsonb), 'addresses', coalesce(v_row.addresses, '[]'::jsonb));
end;
$$;

-- Only known keys and values are kept; anything else is dropped, not stored.
create or replace function public.portal_prefs_save(p_care jsonb, p_addresses jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_acc public.customer_accounts;
  v_care jsonb := '{}'::jsonb;
  v_addresses jsonb := '[]'::jsonb;
  v_item jsonb;
  v_note text;
  v_label text;
  v_address text;
  v_area text;
begin
  v_acc := public.portal_caller();
  if v_acc.auth_user_id is null then
    raise exception 'profile required' using errcode = '42501';
  end if;
  if p_care is not null and jsonb_typeof(p_care) = 'object' then
    if p_care ->> 'shirts' in ('hanger', 'folded') then v_care := v_care || jsonb_build_object('shirts', p_care ->> 'shirts'); end if;
    if p_care ->> 'starch' in ('none', 'light', 'regular') then v_care := v_care || jsonb_build_object('starch', p_care ->> 'starch'); end if;
    if p_care ->> 'fragrance' in ('none', 'regular') then v_care := v_care || jsonb_build_object('fragrance', p_care ->> 'fragrance'); end if;
    if p_care ->> 'separate' = 'true' then v_care := v_care || jsonb_build_object('separate', true); end if;
    v_note := nullif(btrim(coalesce(p_care ->> 'note', '')), '');
    if v_note is not null then
      if char_length(v_note) > 300 then raise exception 'note too long' using errcode = '22023'; end if;
      v_care := v_care || jsonb_build_object('note', v_note);
    end if;
  end if;
  if p_addresses is not null and jsonb_typeof(p_addresses) = 'array' then
    if jsonb_array_length(p_addresses) > 3 then raise exception 'too many addresses' using errcode = '22023'; end if;
    for v_item in select * from jsonb_array_elements(p_addresses) loop
      continue when jsonb_typeof(v_item) <> 'object';
      v_label := nullif(btrim(coalesce(v_item ->> 'label', '')), '');
      v_address := nullif(btrim(coalesce(v_item ->> 'address', '')), '');
      v_area := nullif(btrim(coalesce(v_item ->> 'area', '')), '');
      continue when v_address is null;
      if char_length(coalesce(v_label, '')) > 30 or char_length(v_address) > 300 or (v_area is not null and v_area !~ '^([1-9]|1[0-8]|outside)$') then
        raise exception 'invalid address' using errcode = '22023';
      end if;
      v_addresses := v_addresses || jsonb_build_array(jsonb_build_object('label', coalesce(v_label, ''), 'address', v_address, 'area', coalesce(v_area, '')));
    end loop;
  end if;
  insert into public.customer_preferences (auth_user_id, care, addresses, updated_at)
  values (v_acc.auth_user_id, v_care, v_addresses, now())
  on conflict (auth_user_id) do update set care = excluded.care, addresses = excluded.addresses, updated_at = now();
  return jsonb_build_object('care', v_care, 'addresses', v_addresses);
end;
$$;

-------------------------------------------------------------------------------
-- 4. Grants
-------------------------------------------------------------------------------

revoke all on function public.portal_feedback_save(text, integer, text[], text) from public, anon;
revoke all on function public.portal_feedback_list() from public, anon;
revoke all on function public.portal_loyalty(integer) from public, anon;
revoke all on function public.portal_prefs_get() from public, anon;
revoke all on function public.portal_prefs_save(jsonb, jsonb) from public, anon;
revoke all on function public.website_feedback_list(integer) from public, anon, authenticated;
revoke all on function public.website_feedback_handle(uuid, text) from public, anon, authenticated;
revoke all on function public.website_loyalty_distribution(integer, integer[]) from public, anon, authenticated;

grant execute on function public.portal_feedback_save(text, integer, text[], text) to authenticated;
grant execute on function public.portal_feedback_list() to authenticated;
grant execute on function public.portal_loyalty(integer) to authenticated;
grant execute on function public.portal_prefs_get() to authenticated;
grant execute on function public.portal_prefs_save(jsonb, jsonb) to authenticated;
grant execute on function public.website_feedback_list(integer) to service_role;
grant execute on function public.website_feedback_handle(uuid, text) to service_role;
grant execute on function public.website_loyalty_distribution(integer, integer[]) to service_role;
