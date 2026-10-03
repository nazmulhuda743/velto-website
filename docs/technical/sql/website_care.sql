-- Customer care approvals on the website (design doc P07/P08; docs/technical/PUSH-NOTIFICATIONS.md).
--
-- Velto Ops flags garments at risk at intake (public.order_risks: garment, risk type, note,
-- photos in the order-photos bucket) and sets orders.advisory_status = 'pending': processing is
-- blocked until the customer decides. Today staff send a care advisory on WhatsApp and tap
-- Approved / Declined in Ops when the customer replies. This adds the website path, alongside it:
--
-- 1. portal_care_get(order)     the signed-in customer's own order: status, flagged garments.
-- 2. portal_care_decide(order, approved|declined)  writes orders.advisory_status (what Ops reads),
--    only while it is still 'pending', and records the decision (website_care_decisions).
-- 3. portal_care_pending()      the customer's orders waiting for a decision (account home).
-- 4. website_push_care_events() for the 10-minute push run: P07 when an order becomes pending,
--    one reminder after 4 hours, one the next morning (then it stops and the order waits), and
--    P08 when the decision was recorded outside the website (Ops, phone, WhatsApp).
--
-- Requires customer_portal.sql (portal_caller, portal_local_phone) and website_push.sql.
-- Tables and push functions: service role only. Idempotent.
-- Apply to staging, run tests/website_care_test.sql, then production.

begin;

create table if not exists public.website_care_decisions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  decision text not null check (decision in ('approved', 'declined')),
  channel text not null default 'website' check (channel in ('website')),
  auth_user_id uuid,
  decided_at timestamptz not null default now()
);
create index if not exists website_care_decisions_order_idx on public.website_care_decisions (order_id, decided_at desc);
alter table public.website_care_decisions enable row level security;
revoke all on public.website_care_decisions from public, anon, authenticated;
grant select, insert on public.website_care_decisions to service_role;

-- Which care pushes went out (one row per order and step), so nothing is sent twice.
create table if not exists public.website_push_care_sent (
  order_id uuid not null references public.orders (id) on delete cascade,
  step text not null check (step in ('pending', 'reminder1', 'reminder2', 'decided')),
  sent_at timestamptz not null default now(),
  primary key (order_id, step)
);
alter table public.website_push_care_sent enable row level security;
revoke all on public.website_push_care_sent from public, anon, authenticated, service_role;

/* ---------- the customer's side ---------- */

-- The caller's own order (same rule as portal_order_get): its care status and flagged garments.
-- Null when the order isn't theirs or has nothing to decide.
create or replace function public.portal_care_get(p_order_number text)
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
  d public.website_care_decisions;
begin
  v_acc := public.portal_caller();
  if v_number !~ '^VELR?-[0-9]{5}$' or v_acc.customer_id is null or v_acc.link_status <> 'linked' then
    return null;
  end if;
  select * into o from public.orders
   where order_number = v_number and customer_id = v_acc.customer_id
   order by created_at desc limit 1;
  if o.id is null or o.advisory_status is null then
    return null;
  end if;
  select * into d from public.website_care_decisions where order_id = o.id order by decided_at desc limit 1;
  return jsonb_build_object(
    'orderNumber', o.order_number,
    'status', o.advisory_status,
    'decidedOnWebsite', d.id is not null,
    'decidedAt', d.decided_at,
    'risks', coalesce((
      select jsonb_agg(jsonb_build_object('item', r.item_name, 'type', r.risk_type, 'note', r.note, 'photos', coalesce(to_jsonb(r.photo_paths), '[]'::jsonb)) order by r.created_at)
        from public.order_risks r where r.order_id = o.id
    ), '[]'::jsonb)
  );
end;
$$;

-- The customer decides. Only while Ops still waits ('pending'); a second press, or a decision
-- already made by phone or WhatsApp, changes nothing and says what stands.
create or replace function public.portal_care_decide(p_order_number text, p_decision text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_acc public.customer_accounts;
  v_number text := upper(btrim(coalesce(p_order_number, '')));
  o public.orders;
begin
  v_acc := public.portal_caller();
  if p_decision not in ('approved', 'declined') then
    raise exception 'invalid decision' using errcode = '22023';
  end if;
  if v_number !~ '^VELR?-[0-9]{5}$' or v_acc.customer_id is null or v_acc.link_status <> 'linked' then
    raise exception 'order not found' using errcode = 'P0002';
  end if;
  select * into o from public.orders
   where order_number = v_number and customer_id = v_acc.customer_id
   order by created_at desc limit 1
   for update;
  if o.id is null or o.advisory_status is null then
    raise exception 'order not found' using errcode = 'P0002';
  end if;
  if o.advisory_status <> 'pending' then
    return jsonb_build_object('ok', true, 'changed', false, 'status', o.advisory_status);
  end if;
  update public.orders set advisory_status = p_decision where id = o.id;
  insert into public.website_care_decisions (order_id, decision, auth_user_id) values (o.id, p_decision, (select auth.uid()));
  return jsonb_build_object('ok', true, 'changed', true, 'status', p_decision);
end;
$$;

-- The caller's orders waiting for their decision (newest first), for the account home.
create or replace function public.portal_care_pending()
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
    select jsonb_agg(jsonb_build_object('orderNumber', o.order_number, 'items', (select count(*) from public.order_risks r where r.order_id = o.id)) order by o.created_at desc)
      from public.orders o
     where o.customer_id = v_acc.customer_id and o.advisory_status = 'pending'
       and o.order_status not in ('Delivered', 'Cancelled')
       and exists (select 1 from public.order_risks r where r.order_id = o.id)
  ), '[]'::jsonb);
end;
$$;

/* ---------- pushes (10-minute run, /api/push/run) ---------- */

-- Care steps due now, each with where to send it. Marked sent here, before sending.
--   pending    the order needs a decision (it became pending in the last 2 days)
--   reminder1  still pending 4 hours after the first push (09:00–21:00 Dhaka)
--   reminder2  still pending the next morning (from 09:00 Dhaka), then nothing more
--   decided    decided outside the website after we asked (Ops, phone, WhatsApp)
-- Only phones with care updates on (the column arrives with website_push_prefs.sql; until then
-- every active phone counts).
create or replace function public.website_push_care_events(p_limit integer default 100)
returns table (order_id uuid, step text, order_number text, decision text, targets jsonb)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_now timestamptz := now();
  v_hour integer := extract(hour from (now() at time zone 'Asia/Dhaka'));
  v_today date := (now() at time zone 'Asia/Dhaka')::date;
begin
  return query
  with first_sent as (
    select c.order_id oid, c.sent_at at from public.website_push_care_sent c where c.step = 'pending'
  ),
  due as (
    -- New: pending, recently changed, never announced.
    select o.id oid, 'pending'::text st, o.order_number num, null::text dec, o.customer_id cid, public.portal_local_phone(cu.phone) ph
      from public.orders o join public.customers cu on cu.id = o.customer_id
     where o.advisory_status = 'pending' and o.order_status not in ('Delivered', 'Cancelled')
       and o.updated_at > v_now - interval '2 days'
       and exists (select 1 from public.order_risks r where r.order_id = o.id)
       and not exists (select 1 from public.website_push_care_sent c where c.order_id = o.id and c.step = 'pending')
    union all
    -- Reminder after 4 hours, in waking hours.
    select o.id, 'reminder1', o.order_number, null, o.customer_id, public.portal_local_phone(cu.phone)
      from public.orders o join public.customers cu on cu.id = o.customer_id join first_sent f on f.oid = o.id
     where o.advisory_status = 'pending' and o.order_status not in ('Delivered', 'Cancelled')
       and f.at <= v_now - interval '4 hours' and v_hour between 9 and 20
       and not exists (select 1 from public.website_push_care_sent c where c.order_id = o.id and c.step = 'reminder1')
    union all
    -- The next morning, once; then the order waits.
    select o.id, 'reminder2', o.order_number, null, o.customer_id, public.portal_local_phone(cu.phone)
      from public.orders o join public.customers cu on cu.id = o.customer_id join first_sent f on f.oid = o.id
     where o.advisory_status = 'pending' and o.order_status not in ('Delivered', 'Cancelled')
       and (f.at at time zone 'Asia/Dhaka')::date < v_today and v_hour between 9 and 11
       and exists (select 1 from public.website_push_care_sent c where c.order_id = o.id and c.step = 'reminder1')
       and not exists (select 1 from public.website_push_care_sent c where c.order_id = o.id and c.step = 'reminder2')
    union all
    -- Decided elsewhere after we asked: tell them it is recorded (the website shows its own).
    select o.id, 'decided', o.order_number, o.advisory_status, o.customer_id, public.portal_local_phone(cu.phone)
      from public.orders o join public.customers cu on cu.id = o.customer_id join first_sent f on f.oid = o.id
     where o.advisory_status in ('approved', 'declined')
       and o.updated_at > v_now - interval '2 days'
       and not exists (select 1 from public.website_care_decisions w where w.order_id = o.id)
       and not exists (select 1 from public.website_push_care_sent c where c.order_id = o.id and c.step = 'decided')
  ),
  t as (
    select due.oid, due.st, jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth, 'lang', s.lang)) tg
      from due
      join public.website_push_subs s
        on s.active and coalesce((to_jsonb(s) ->> 'care_updates')::boolean, true)
       and (s.customer_id = due.cid or (s.phone is not null and s.phone = due.ph))
     group by due.oid, due.st
  ),
  marked as (
    insert into public.website_push_care_sent (order_id, step)
    select t.oid, t.st from t
     limit least(greatest(coalesce(p_limit, 100), 1), 500)
    on conflict do nothing
    returning website_push_care_sent.order_id mid, website_push_care_sent.step mst
  )
  select due.oid, due.st, due.num, due.dec, t.tg
    from marked m join due on due.oid = m.mid and due.st = m.mst join t on t.oid = m.mid and t.st = m.mst;
end;
$$;

revoke all on function public.portal_care_get(text) from public, anon;
revoke all on function public.portal_care_decide(text, text) from public, anon;
revoke all on function public.portal_care_pending() from public, anon;
grant execute on function public.portal_care_get(text) to authenticated;
grant execute on function public.portal_care_decide(text, text) to authenticated;
grant execute on function public.portal_care_pending() to authenticated;
revoke all on function public.website_push_care_events(integer) from public, anon, authenticated;
grant execute on function public.website_push_care_events(integer) to service_role;

commit;
