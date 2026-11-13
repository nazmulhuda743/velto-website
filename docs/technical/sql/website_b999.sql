-- B999 blanket package (docs/technical/B999.md): 3 Regular/Medium blankets for ৳999.
--
--   website_b999_book()     the landing page's booking: fixed offer values, daily cap under a lock,
--                           the same Ops pickup task + lead as every website booking
--                           (website_create_request), one website_b999_bookings row
--   website_b999_days()     bookings per pickup day (the date picker hides full days)
--   website_b999_list()     Admin → Blanket ৳999
--   website_b999_flag()     staff: price confirmation required (heavy/extra), total unchanged
--   website_b999_decide()   staff: the customer approved or declined, recorded with who/when/how
--   website_b999_link_order(), website_b999_cancel()
--
-- The offer values are CHECK constraints: a row can only ever say B999-WEB, 3 blankets, ৳999.
-- The first-order 10% and coupons are never added (the Ops task says not to apply them).
-- Requires website_create_request.sql (+ website_clean_attribution) and Ops orders/tasks.
-- Every function is service_role only. Idempotent.

create table if not exists public.website_b999_bookings (
  id                  uuid primary key default gen_random_uuid(),
  dedupe_key          text not null unique check (dedupe_key ~ '^[A-Za-z0-9._:-]{16,128}$'),
  task_id             uuid,
  reference           text not null,
  offer_code          text not null default 'B999-WEB' check (offer_code = 'B999-WEB'),
  package             text not null default 'B999' check (package = 'B999'),
  service             text not null default 'Blanket Cleaning' check (service = 'Blanket Cleaning'),
  item_type           text not null default 'Regular Blanket' check (item_type = 'Regular Blanket'),
  quantity            smallint not null default 3 check (quantity = 3),
  package_price       integer not null default 999 check (package_price = 999),
  currency            text not null default 'BDT' check (currency = 'BDT'),
  acquisition_source  text not null default 'WEBSITE' check (acquisition_source = 'WEBSITE'),
  campaign_family     text not null default 'BLANKET' check (campaign_family = 'BLANKET'),
  payment_method      text not null default 'Pay at delivery' check (payment_method = 'Pay at delivery'),
  name                text not null check (char_length(name) between 2 and 100),
  phone               text not null check (phone ~ '^01[3-9][0-9]{8}$'),
  sector              smallint not null check (sector between 1 and 18),
  address             text not null check (char_length(address) between 5 and 500),
  pickup_date         date not null,
  utm_source          text, utm_medium text, utm_campaign text, utm_content text, utm_term text,
  click_id            text check (click_id is null or click_id in ('fbclid', 'gclid')),
  landing_page        text,
  status              text not null default 'booked' check (status in ('booked', 'cancelled')),
  -- Reclassification (heavy/large or extra blankets): the price changes only with recorded approval.
  price_status        text not null default 'locked' check (price_status in ('locked', 'confirmation_required', 'approved', 'declined')),
  proposed_regular    smallint, proposed_heavy smallint, proposed_extra_regular smallint, proposed_extra_heavy smallint,
  proposed_total      integer check (proposed_total is null or proposed_total between 0 and 100000),
  approved_total      integer check (approved_total is null or approved_total between 0 and 100000),
  declined_heavy      smallint,
  decision_channel    text check (decision_channel is null or decision_channel in ('phone', 'whatsapp', 'in_person')),
  flagged_by          text, flagged_at timestamptz,
  decided_by          text, decided_at timestamptz,
  staff_note          text check (staff_note is null or char_length(staff_note) <= 500),
  order_number        text,
  cancelled_by        text, cancelled_at timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on table public.website_b999_bookings is
  'B999-WEB blanket package bookings (3 Regular/Medium blankets, ৳999). Offer values are fixed by CHECK constraints; price changes need recorded customer approval.';

create index if not exists website_b999_bookings_day_idx on public.website_b999_bookings (pickup_date) where status = 'booked';
alter table public.website_b999_bookings enable row level security;
revoke all on table public.website_b999_bookings from public, anon, authenticated, service_role;

/* ---------- booking ---------- */

-- p_cap and p_days come from the website's rules file (src/lib/campaigns/b999.ts), on the server.
create or replace function public.website_b999_book(p_dedupe_key text, p_payload jsonb, p_cap integer, p_days date[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.website_b999_bookings;
  v_name text := left(btrim(coalesce(p_payload->>'name', '')), 100);
  v_digits text := regexp_replace(coalesce(p_payload->>'phone', ''), '[^0-9]', '', 'g');
  v_phone text;
  v_sector smallint;
  v_address text := left(btrim(regexp_replace(coalesce(p_payload->>'address', ''), '\s+', ' ', 'g')), 500);
  v_date date;
  v_count integer;
  v_attr jsonb;
  v_r jsonb;
  v_task uuid;
  v_label text;
begin
  if p_dedupe_key is null or p_dedupe_key !~ '^[A-Za-z0-9._:-]{16,128}$' or p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  -- A reload or a second click with the same key: the same booking, never a second one.
  select * into b from public.website_b999_bookings where dedupe_key = p_dedupe_key;
  if b.id is not null then
    return jsonb_build_object('ok', true, 'duplicate', true, 'reference', b.reference, 'pickupDate', b.pickup_date);
  end if;

  v_phone := case when v_digits ~ '^8801[3-9][0-9]{8}$' then substr(v_digits, 3)
                  when v_digits ~ '^008801[3-9][0-9]{8}$' then substr(v_digits, 5)
                  else v_digits end;
  begin
    v_sector := (p_payload->>'sector')::smallint;
    v_date := (p_payload->>'pickupDate')::date;
  exception when others then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end;
  if char_length(v_name) < 2 then return jsonb_build_object('ok', false, 'error', 'invalid', 'field', 'name'); end if;
  if v_phone !~ '^01[3-9][0-9]{8}$' then return jsonb_build_object('ok', false, 'error', 'invalid', 'field', 'phone'); end if;
  if v_sector is null or v_sector not between 1 and 18 then return jsonb_build_object('ok', false, 'error', 'outside_area'); end if;
  if char_length(v_address) < 5 then return jsonb_build_object('ok', false, 'error', 'invalid', 'field', 'address'); end if;
  if v_date is null or p_days is null or not (v_date = any (p_days)) then return jsonb_build_object('ok', false, 'error', 'invalid', 'field', 'date'); end if;
  if p_cap is null or p_cap not between 1 and 50 then return jsonb_build_object('ok', false, 'error', 'invalid'); end if;

  -- The daily cap: one booking at a time per pickup day, so two submits for the last place can't
  -- both succeed (the second waits here, then counts the first).
  perform pg_advisory_xact_lock(hashtextextended('website_b999:' || v_date::text, 0));
  select * into b from public.website_b999_bookings where dedupe_key = p_dedupe_key;
  if b.id is not null then
    return jsonb_build_object('ok', true, 'duplicate', true, 'reference', b.reference, 'pickupDate', b.pickup_date);
  end if;
  select count(*) into v_count from public.website_b999_bookings where pickup_date = v_date and status = 'booked';
  if v_count >= p_cap then
    return jsonb_build_object('ok', false, 'error', 'day_full');
  end if;

  v_label := to_char(v_date, 'Dy DD Mon YYYY');
  -- The same Ops pickup task and lead as every website booking (Today, dispatch, attribution,
  -- the per-phone rate limit). Service, notes and price are fixed here, never from the browser.
  v_r := public.website_create_request('booking', p_dedupe_key, jsonb_build_object(
    'name', v_name,
    'phone', v_phone,
    'area', 'Uttara Sector ' || v_sector,
    'address', v_address,
    'preferredPickup', v_label || ' (B999 package, time to confirm)',
    'service', 'blanket-comforter-cleaning',
    'notes', concat_ws(' ',
      'Offer: B999-WEB · 3 Regular/Medium blankets · ৳999 fixed · Pay at delivery (cash or bKash).',
      'Do NOT apply the first-order 10% or any coupon.',
      'Heavy/large blankets: confirm the price with the customer BEFORE processing (+৳50 each in the pack). Never increase without approval; a declined heavy blanket is returned unprocessed.',
      'Record any price change on Admin → Blanket ৳999.'),
    'attribution', coalesce(p_payload->'attribution', '{}'::jsonb)));
  if not coalesce((v_r->>'ok')::boolean, false) then
    return v_r;
  end if;
  select id into v_task from public.tasks where dedupe_key = 'website:' || p_dedupe_key;

  v_attr := public.website_clean_attribution(p_payload->'attribution');
  insert into public.website_b999_bookings (dedupe_key, task_id, reference, name, phone, sector, address, pickup_date,
    utm_source, utm_medium, utm_campaign, utm_content, utm_term, click_id, landing_page)
  values (p_dedupe_key, v_task, v_r->>'reference', v_name, v_phone, v_sector, v_address, v_date,
    left(v_attr->>'utm_source', 120), left(v_attr->>'utm_medium', 120), left(v_attr->>'utm_campaign', 120),
    left(v_attr->>'utm_content', 120), left(v_attr->>'utm_term', 120),
    case when v_attr ? 'gclid' then 'gclid' when v_attr ? 'fbclid' then 'fbclid' end,
    left(v_attr->>'landing_page', 300))
  returning * into b;
  return jsonb_build_object('ok', true, 'duplicate', false, 'reference', b.reference, 'pickupDate', b.pickup_date);
end;
$$;

-- Bookings per pickup day, for the date picker.
create or replace function public.website_b999_days(p_days date[])
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(d::text, coalesce(c.n, 0)), '{}'::jsonb)
  from unnest(coalesce(p_days, '{}')) d
  left join (select pickup_date, count(*) n from public.website_b999_bookings where status = 'booked' group by 1) c on c.pickup_date = d;
$$;

/* ---------- staff (Admin → Blanket ৳999) ---------- */

create or replace function public.website_b999_list(p_days integer default 30)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(row_to_json(x)::jsonb order by x."pickupDate", x."createdAt"), '[]'::jsonb)
  from (
    select b.id, b.reference, b.name, b.phone, b.sector, b.address, b.pickup_date "pickupDate", b.status,
           b.price_status "priceStatus", b.proposed_regular "proposedRegular", b.proposed_heavy "proposedHeavy",
           b.proposed_extra_regular "proposedExtraRegular", b.proposed_extra_heavy "proposedExtraHeavy",
           b.proposed_total "proposedTotal", b.approved_total "approvedTotal", b.declined_heavy "declinedHeavy",
           b.decision_channel "decisionChannel", b.flagged_by "flaggedBy", b.flagged_at "flaggedAt",
           b.decided_by "decidedBy", b.decided_at "decidedAt", b.staff_note "staffNote",
           b.utm_source "utmSource", b.utm_campaign "utmCampaign", b.created_at "createdAt",
           o.order_number "orderNumber", o.total_amount "orderTotal",
           -- The Ops order must say ৳999, or the approved price; a different total is a mismatch.
           (o.order_number is not null and o.total_amount is distinct from coalesce(b.approved_total, 999)) "mismatch"
    from public.website_b999_bookings b
    left join lateral (
      select ord.order_number, ord.total_amount from public.orders ord
       where ord.order_number = coalesce(b.order_number,
               (select j.order_number from public.website_dispatch_jobs j where j.task_id = b.task_id and j.order_number is not null limit 1))
       limit 1
    ) o on true
    where b.pickup_date >= current_date - least(greatest(coalesce(p_days, 30), 1), 365)
  ) x;
$$;

-- Staff: this booking needs a price check (heavy in the pack, or extra blankets). The total stays
-- as it is until the customer's answer is recorded. p_total is computed by b999Total on the server.
create or replace function public.website_b999_flag(p_id uuid, p_regular integer, p_heavy integer, p_extra_regular integer, p_extra_heavy integer, p_total integer, p_note text, p_by text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.website_b999_bookings;
begin
  select * into b from public.website_b999_bookings where id = p_id for update;
  if b.id is null or b.status <> 'booked' then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if b.price_status in ('approved', 'declined') then return jsonb_build_object('ok', false, 'error', 'decided'); end if;
  if least(p_regular, p_heavy, p_extra_regular, p_extra_heavy) < 0 or greatest(p_regular, p_heavy) > 3 or p_regular + p_heavy > 3
     or greatest(p_extra_regular, p_extra_heavy) > 30 or p_total is null or p_total not between 0 and 100000 then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  update public.website_b999_bookings
     set price_status = 'confirmation_required', proposed_regular = p_regular, proposed_heavy = p_heavy,
         proposed_extra_regular = p_extra_regular, proposed_extra_heavy = p_extra_heavy, proposed_total = p_total,
         staff_note = nullif(left(btrim(coalesce(p_note, '')), 500), ''), flagged_by = left(p_by, 120), flagged_at = now(), updated_at = now()
   where id = p_id;
  return jsonb_build_object('ok', true);
end;
$$;

-- Staff: the customer's answer. Approved: the proposed total. Declined: the declined heavy blankets
-- are returned unprocessed and p_total is the recalculated price (b999AfterDecline).
create or replace function public.website_b999_decide(p_id uuid, p_decision text, p_channel text, p_declined_heavy integer, p_total integer, p_by text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.website_b999_bookings;
begin
  select * into b from public.website_b999_bookings where id = p_id for update;
  if b.id is null or b.status <> 'booked' then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if b.price_status <> 'confirmation_required' then return jsonb_build_object('ok', false, 'error', 'not_flagged'); end if;
  if p_decision not in ('approved', 'declined') or p_channel not in ('phone', 'whatsapp', 'in_person')
     or (p_decision = 'declined' and (p_declined_heavy is null or p_declined_heavy < 0 or p_declined_heavy > coalesce(b.proposed_heavy, 0)))
     or (p_decision = 'declined' and (p_total is null or p_total not between 0 and 100000)) then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  update public.website_b999_bookings
     set price_status = p_decision,
         approved_total = case when p_decision = 'approved' then proposed_total else p_total end,
         declined_heavy = case when p_decision = 'declined' then p_declined_heavy end,
         decision_channel = p_channel, decided_by = left(p_by, 120), decided_at = now(), updated_at = now()
   where id = p_id;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.website_b999_link_order(p_id uuid, p_order_number text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_number text := upper(btrim(coalesce(p_order_number, '')));
begin
  if not exists (select 1 from public.orders where order_number = v_number) then
    return jsonb_build_object('ok', false, 'error', 'no_order');
  end if;
  update public.website_b999_bookings set order_number = v_number, updated_at = now() where id = p_id;
  return jsonb_build_object('ok', found);
end;
$$;

-- Staff: cancel (frees the day's place). The Ops task is handled in Today as usual.
create or replace function public.website_b999_cancel(p_id uuid, p_by text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.website_b999_bookings
     set status = 'cancelled', cancelled_by = left(p_by, 120), cancelled_at = now(), updated_at = now()
   where id = p_id and status = 'booked';
  return jsonb_build_object('ok', found);
end;
$$;

revoke all on function public.website_b999_book(text, jsonb, integer, date[]) from public, anon, authenticated;
revoke all on function public.website_b999_days(date[]) from public, anon, authenticated;
revoke all on function public.website_b999_list(integer) from public, anon, authenticated;
revoke all on function public.website_b999_flag(uuid, integer, integer, integer, integer, integer, text, text) from public, anon, authenticated;
revoke all on function public.website_b999_decide(uuid, text, text, integer, integer, text) from public, anon, authenticated;
revoke all on function public.website_b999_link_order(uuid, text) from public, anon, authenticated;
revoke all on function public.website_b999_cancel(uuid, text) from public, anon, authenticated;
grant execute on function public.website_b999_book(text, jsonb, integer, date[]) to service_role;
grant execute on function public.website_b999_days(date[]) to service_role;
grant execute on function public.website_b999_list(integer) to service_role;
grant execute on function public.website_b999_flag(uuid, integer, integer, integer, integer, integer, text, text) to service_role;
grant execute on function public.website_b999_decide(uuid, text, text, integer, integer, text) to service_role;
grant execute on function public.website_b999_link_order(uuid, text) to service_role;
grant execute on function public.website_b999_cancel(uuid, text) to service_role;
