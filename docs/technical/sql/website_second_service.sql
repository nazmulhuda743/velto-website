-- The Second Service ladder (docs/technical/SECOND-SERVICE.md).
--
-- A customer who uses one Velto service is worth ৳366–996; two services, ৳2,400–2,700; all three,
-- ৳4,673 (prod, 2026-10-02). The delivered invoice page (website_invoices.sql) becomes the moment
-- to add the next one:
--   website_invoice_get()      + isFirst, servicesEver, rating (replaces the one in website_invoices.sql)
--   website_invoice_rate()     "How did it go?" by link: the same customer_order_feedback the account
--                              writes, so it shows in Admin → Customer feedback; 1–3 opens a board task
--   website_invoice_routine()  "Pick your day" (dry cleaning → everyday): an Ops call task, Ops confirms
--   website_invoice_addon()    "Add to my next pickup" (everyday → dry cleaning / wash): an Ops call task
--   website_service_mix()      Admin → Today: which service to ask an ironing regular about
--   website_second_service_stats()  Admin → Reminders: one-service customers who added a second
--
-- Requires website_invoices.sql, website_customer_extras.sql (customer_order_feedback, board tasks).
-- Every function is service_role only. Idempotent.

/* ---------- link feedback goes into the account's feedback table ---------- */

alter table public.customer_order_feedback alter column auth_user_id drop not null;
alter table public.customer_order_feedback add column if not exists via_link text
  check (via_link is null or via_link ~ '^[A-Za-z0-9_-]{8}$');
comment on column public.customer_order_feedback.via_link is
  'Set when the rating came from the invoice link (no sign-in); auth_user_id is then null.';

/* ---------- requests made from the invoice page ---------- */

create table if not exists public.website_link_requests (
  id           uuid primary key default gen_random_uuid(),
  code         text not null references public.website_invoice_links (code) on delete cascade,
  order_id     uuid not null references public.orders (id) on delete cascade,
  customer_id  uuid references public.customers (id) on delete set null,
  kind         text not null check (kind in ('routine', 'addon')),
  service      text not null check (service in ('dry-cleaning', 'wash-and-iron', 'ironing')),
  weekday      smallint check (weekday is null or weekday between 0 and 6),
  time_window  text check (time_window is null or time_window in ('morning', 'afternoon', 'evening')),
  task_id      uuid,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (order_id, kind, service)
);

comment on table public.website_link_requests is
  'What a customer asked for from the delivered invoice page: a weekly pickup, or a service added to the next pickup. Each one is an Ops call task.';

alter table public.website_link_requests enable row level security;
revoke all on table public.website_link_requests from public, anon, authenticated, service_role;

/* ---------- helpers ---------- */

-- Which services a customer has ever used (non-cancelled orders), and how many orders.
create or replace function public.website_customer_mix(p_customer uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'orders', count(*),
    'ironing', coalesce(bool_or('Ironing' = any (o.service_category)), false),
    'wash', coalesce(bool_or('Wash + Iron' = any (o.service_category)), false),
    'dryCleaning', coalesce(bool_or('Dry Cleaning' = any (o.service_category)), false))
  from public.orders o
  where o.customer_id = p_customer and o.order_status is distinct from 'Cancelled';
$$;

-- The link, its order and customer, for the actions below (Delivered orders, links within 120 days).
create or replace function public.website_link_order(p_code text)
returns public.orders
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  o public.orders;
begin
  if p_code is null or p_code !~ '^[A-Za-z0-9_-]{8}$' then
    return null;
  end if;
  select ord.* into o from public.website_invoice_links l join public.orders ord on ord.id = l.order_id where l.code = p_code;
  if o.id is null or o.order_status <> 'Delivered' or coalesce(o.order_date, o.created_at::date) < current_date - 120 then
    return null;
  end if;
  return o;
end;
$$;

/* ---------- the invoice, with what the delivered page needs ---------- */

create or replace function public.website_invoice_get(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  l public.website_invoice_links;
  o public.orders;
begin
  if p_code is null or p_code !~ '^[A-Za-z0-9_-]{8}$' then
    return jsonb_build_object('ok', false, 'reason', 'unknown');
  end if;
  select * into l from public.website_invoice_links where code = p_code;
  if l.code is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown');
  end if;
  select * into o from public.orders where id = l.order_id;
  if o.id is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown');
  end if;
  update public.website_invoice_links
     set opened_at = coalesce(opened_at, now()), open_count = open_count + 1
   where code = p_code;
  if coalesce(o.order_date, o.created_at::date) < current_date - 120 then
    return jsonb_build_object('ok', false, 'reason', 'expired', 'orderNumber', o.order_number);
  end if;
  return jsonb_build_object('ok', true) || public.portal_order_json(o) || jsonb_build_object(
    'firstName', public.portal_first_name((select c.name from public.customers c where c.id = o.customer_id)),
    'expressFee', coalesce(o.express_fee, 0),
    'lines', coalesce((
      select jsonb_agg(jsonb_build_object(
        'item', i.item_name,
        'service', i.service_category,
        'quantity', i.quantity,
        'price', coalesce(i.quoted_price, i.reference_price)
      ) order by i.created_at)
      from public.order_items i where i.order_id = o.id
    ), '[]'::jsonb),
    'payments', coalesce((
      select jsonb_agg(jsonb_build_object('amount', p.amount, 'method', p.method, 'on', p.paid_at) order by p.paid_at, p.created_at)
      from public.payments p where p.order_id = o.id
    ), '[]'::jsonb),
    -- The customer's first order (nothing non-cancelled before it).
    'isFirst', o.customer_id is not null and not exists (
      select 1 from public.orders p
       where p.customer_id = o.customer_id and p.order_status is distinct from 'Cancelled'
         and (p.created_at < o.created_at or (p.created_at = o.created_at and p.id < o.id))),
    'servicesEver', case when o.customer_id is null then null else public.website_customer_mix(o.customer_id) end,
    'rating', (select f.rating from public.customer_order_feedback f where f.customer_id = o.customer_id and f.order_number = o.order_number),
    'asked', coalesce((
      select jsonb_agg(jsonb_build_object('kind', r.kind, 'service', r.service, 'weekday', r.weekday, 'window', r.time_window))
      from public.website_link_requests r where r.order_id = o.id
    ), '[]'::jsonb)
  );
end;
$$;

/* ---------- "How did it go?" by link ---------- */

create or replace function public.website_invoice_rate(p_code text, p_rating integer, p_issues text[] default '{}', p_comment text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.orders;
  v_comment text := nullif(btrim(coalesce(p_comment, '')), '');
  v_issues text[];
  v_prev public.customer_order_feedback;
  v_row public.customer_order_feedback;
  v_task uuid;
  v_labels text;
  v_position double precision;
begin
  o := public.website_link_order(p_code);
  if o.id is null or o.customer_id is null then
    return jsonb_build_object('ok', false, 'error', 'closed');
  end if;
  if p_rating is null or p_rating not between 1 and 5 or char_length(coalesce(v_comment, '')) > 1000 then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  select coalesce(array_agg(distinct i order by i), '{}') into v_issues
    from unnest(coalesce(p_issues, '{}')) i
   where i = any (array['missing_item', 'damage', 'stain', 'ironing', 'smell', 'late', 'service', 'other']);

  select * into v_prev from public.customer_order_feedback where customer_id = o.customer_id and order_number = o.order_number;
  if v_prev.id is not null and v_prev.created_at < now() - interval '14 days' then
    return jsonb_build_object('ok', false, 'error', 'closed');
  end if;

  insert into public.customer_order_feedback (auth_user_id, customer_id, order_number, rating, issues, comment, via_link)
  values (null, o.customer_id, o.order_number, p_rating, v_issues, v_comment, p_code)
  on conflict (customer_id, order_number) do update
    set rating = excluded.rating, issues = excluded.issues, comment = excluded.comment, updated_at = now()
  returning * into v_row;

  -- Same as portal_feedback_save: an unhappy customer is a board task (no name or phone on the board).
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
        format('Customer feedback: %s rated %s of 5', o.order_number, p_rating),
        concat_ws(E'\n',
          format('Rating: %s of 5 (from the invoice link on WhatsApp)', p_rating),
          case when v_labels is not null then 'What went wrong: ' || v_labels end,
          case when v_comment is not null then 'Customer wrote: ' || v_comment end,
          'Who and how to reach them: Customer feedback in the dashboard (Owner, Manager, Support). Please contact the customer within 24 hours.'),
        'todo', case when p_rating <= 2 then 'urgent' else 'high' end, array['feedback'], v_position,
        'Website (invoice link)')
      returning id into v_task;
      update public.customer_order_feedback set task_id = v_task where id = v_row.id;
    else
      insert into public.website_board_comments (task_id, author_name, body)
      values (v_row.task_id, 'Website (invoice link)',
              left(concat_ws(E'\n', format('The customer changed the rating to %s of 5.', p_rating),
                             case when v_labels is not null then 'What went wrong: ' || v_labels end,
                             case when v_comment is not null then 'Customer wrote: ' || v_comment end), 2000));
    end if;
  end if;
  return jsonb_build_object('ok', true, 'rating', p_rating);
end;
$$;

/* ---------- "Pick your day" and "Add to my next pickup": Ops call tasks ---------- */

create or replace function public.website_link_request(p_code text, p_kind text, p_service text, p_weekday integer, p_window text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.orders;
  cu public.customers;
  v_req public.website_link_requests;
  v_task uuid;
  v_service_name text;
  v_day text;
  v_title text;
  v_body text;
begin
  o := public.website_link_order(p_code);
  if o.id is null or o.customer_id is null then
    return jsonb_build_object('ok', false, 'error', 'closed');
  end if;
  if p_kind not in ('routine', 'addon') or p_service is null or p_service not in ('dry-cleaning', 'wash-and-iron', 'ironing')
     or (p_kind = 'routine' and (p_weekday is null or p_weekday not between 0 and 6 or p_window is null or p_window not in ('morning', 'afternoon', 'evening'))) then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  select * into cu from public.customers where id = o.customer_id;
  v_service_name := case p_service when 'dry-cleaning' then 'Dry Cleaning' when 'wash-and-iron' then 'Wash + Iron' else 'Ironing' end;
  v_day := case when p_kind = 'routine' then
    (array['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'])[p_weekday + 1] || ' ' || p_window end;

  insert into public.website_link_requests (code, order_id, customer_id, kind, service, weekday, time_window)
  values (p_code, o.id, o.customer_id, p_kind, p_service, case when p_kind = 'routine' then p_weekday end, case when p_kind = 'routine' then p_window end)
  on conflict (order_id, kind, service) do update
    set weekday = excluded.weekday, time_window = excluded.time_window, updated_at = now()
  returning * into v_req;

  if v_req.task_id is not null then
    -- Asked again (another day): keep the one task, note the change on it while it is open.
    update public.tasks
       set description = description || E'\n' || 'Changed on the website: ' || coalesce(v_day, 'asked again')
     where id = v_req.task_id and status = 'open';
    return jsonb_build_object('ok', true, 'again', true);
  end if;

  if p_kind = 'routine' then
    v_title := left('Call ' || coalesce(nullif(btrim(cu.name), ''), 'customer') || ' · wants a weekly ' || v_service_name || ' pickup', 200);
    v_body := concat_ws(E'\n',
      'Asked on the delivered invoice page (Velto website): a weekly pickup.',
      'Name: ' || coalesce(cu.name, ''),
      'Phone: ' || coalesce(cu.phone, o.phone_snapshot, ''),
      'Wants: ' || v_service_name || ', every ' || v_day,
      'After order: ' || o.order_number,
      'Call to confirm the day and time, then set up the weekly pickup.');
  else
    v_title := left('Call ' || coalesce(nullif(btrim(cu.name), ''), 'customer') || ' · add ' || v_service_name || ' to the next pickup', 200);
    v_body := concat_ws(E'\n',
      'Asked on the delivered invoice page (Velto website): add ' || v_service_name || ' to the next pickup.',
      'Name: ' || coalesce(cu.name, ''),
      'Phone: ' || coalesce(cu.phone, o.phone_snapshot, ''),
      'After order: ' || o.order_number,
      'When you next confirm their pickup, ask what to bring for ' || v_service_name || '. Nothing is charged until it is counted.');
  end if;

  insert into public.tasks (title, type, priority, status, due_at, outlet_code, description, assigned_by_name, source, source_ref, dedupe_key)
  values (v_title, 'call', 'normal', 'open',
          greatest(((now() at time zone 'Asia/Dhaka')::date + time '18:00') at time zone 'Asia/Dhaka', now() + interval '2 hours'),
          o.outlet_code, v_body, 'Velto website', 'website_second_service', o.order_number,
          'second-' || p_kind || '-' || p_service || '-' || o.id)
  on conflict do nothing
  returning id into v_task;
  update public.website_link_requests set task_id = v_task where id = v_req.id;
  return jsonb_build_object('ok', true, 'again', false);
end;
$$;

/* ---------- Admin → Today: what to ask an existing customer about ---------- */

create or replace function public.website_service_mix(p_phones text[])
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('phone', p.phone) || public.website_customer_mix(c.id)), '[]'::jsonb)
  from (select distinct right(regexp_replace(x, '[^0-9]', '', 'g'), 11) phone from unnest(coalesce(p_phones, '{}')) x limit 200) p
  join lateral (
    select cu.id from public.customers cu
     where right(regexp_replace(coalesce(cu.phone, ''), '[^0-9]', '', 'g'), 11) = p.phone
     order by (select count(*) from public.orders o where o.customer_id = cu.id) desc limit 1
  ) c on true
  where p.phone ~ '^01[3-9][0-9]{8}$';
$$;

/* ---------- Admin → Reminders: did they add a second service? ---------- */

-- Customers who used exactly one service before the window started, and whether they ordered a new
-- service in the window. A = Dry Cleaning only → an everyday service; B = everyday only → the other.
create or replace function public.website_second_service_stats(p_days integer default 60)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with since as (select now() - make_interval(days => least(greatest(coalesce(p_days, 60), 7), 365)) as d),
  before as (
    select o.customer_id,
      bool_or('Ironing' = any (o.service_category) or 'Wash + Iron' = any (o.service_category)) everyday,
      bool_or('Dry Cleaning' = any (o.service_category)) dc,
      bool_or('Wash + Iron' = any (o.service_category)) wash
    from public.orders o, since
    where o.customer_id is not null and o.order_status is distinct from 'Cancelled' and o.created_at < since.d
    group by 1),
  after as (
    select o.customer_id,
      bool_or('Ironing' = any (o.service_category) or 'Wash + Iron' = any (o.service_category)) everyday,
      bool_or('Dry Cleaning' = any (o.service_category)) dc
    from public.orders o, since
    where o.customer_id is not null and o.order_status is distinct from 'Cancelled' and o.created_at >= since.d
    group by 1)
  select jsonb_build_object(
    'days', least(greatest(coalesce(p_days, 60), 7), 365),
    'dcOnly', count(*) filter (where b.dc and not b.everyday),
    'dcOnlyAdded', count(*) filter (where b.dc and not b.everyday and a.everyday),
    'everydayOnly', count(*) filter (where b.everyday and not b.dc),
    'everydayOnlyAdded', count(*) filter (where b.everyday and not b.dc and a.dc),
    'linkRatings', (select count(*) from public.customer_order_feedback f, since where f.via_link is not null and f.created_at >= since.d),
    'routineAsks', (select count(*) from public.website_link_requests r, since where r.kind = 'routine' and r.created_at >= since.d),
    'addonAsks', (select count(*) from public.website_link_requests r, since where r.kind = 'addon' and r.created_at >= since.d))
  from before b left join after a using (customer_id);
$$;

revoke all on function public.website_customer_mix(uuid) from public, anon, authenticated, service_role;
revoke all on function public.website_link_order(text) from public, anon, authenticated, service_role;
revoke all on function public.website_invoice_get(text) from public, anon, authenticated;
revoke all on function public.website_invoice_rate(text, integer, text[], text) from public, anon, authenticated;
revoke all on function public.website_link_request(text, text, text, integer, text) from public, anon, authenticated;
revoke all on function public.website_service_mix(text[]) from public, anon, authenticated;
revoke all on function public.website_second_service_stats(integer) from public, anon, authenticated;
grant execute on function public.website_invoice_get(text) to service_role;
grant execute on function public.website_invoice_rate(text, integer, text[], text) to service_role;
grant execute on function public.website_link_request(text, text, text, integer, text) to service_role;
grant execute on function public.website_service_mix(text[]) to service_role;
grant execute on function public.website_second_service_stats(integer) to service_role;
