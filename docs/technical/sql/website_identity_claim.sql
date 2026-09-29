-- Welcome back: an SMS-proven phone no longer links order history by itself.
--
--   phone proven (SMS sign-in code, or the website's "Show my past orders" SMS code)
--     → portal_match_preview()   what we may say before the customer decides (never an address,
--                                 a full name, an order detail or an amount)
--     → portal_claim_match()     "Continue": links the history (step-up name check when needed)
--     → portal_reject_match()    "This isn't me": never linked, never offered again, flagged
--
-- Until a claim, portal_orders()/portal_order_get() stay empty (they only read linked accounts).
--
-- States (portal_match_preview):
--   linked      already linked: straight into the account, no question
--   unverified  no proven phone yet
--   none        no Velto customer has this phone: new-customer onboarding
--   recent      exactly one customer, last order within 12 months, not linked to another login:
--               "Welcome back, <first name>" + order count + last order month → one tap
--   stepup      exactly one customer, but older than 12 months (or no orders), or already linked to
--               another login (the same person's other sign-in, or a number that changed hands):
--               nothing is shown; the customer types the name they use with Velto. A match restores
--               everything; three misses go to staff.
--   rejected    this login said "This isn't me" (or staff rejected the link): treated as new
--   assisted    several customers have the phone, or the name check failed three times: staff link
--               it from /admin/accounts (the account's request is set to pending when it exists)
--
-- Ops has no sector for customers (zone is Uttara/RUAP/…; addresses carry no "Sector N"), so the
-- step-up check is the name alone: someone who got a recycled number doesn't know the previous
-- owner's name. Common prefixes (Md, Mohammad, Mst, …) are ignored.
--
-- Requires customer_portal.sql. Replaces portal_auto_link (now a no-op) and
-- portal_link_verified_phone (now records the proven phone instead of linking). Idempotent.

/* ---------- storage ---------- */

-- A phone proven by the website's own SMS code (email/Google logins); SMS sign-ins use auth.users.
alter table public.customer_accounts add column if not exists proven_phone text
  check (proven_phone is null or proven_phone ~ '^01[3-9][0-9]{8}$');
alter table public.customer_accounts add column if not exists proven_at timestamptz;

create table if not exists public.customer_identity_decisions (
  auth_user_id uuid not null references auth.users (id) on delete cascade,
  customer_id  uuid not null references public.customers (id) on delete cascade,
  phone        text not null check (phone ~ '^01[3-9][0-9]{8}$'),
  decision     text not null check (decision in ('claimed', 'rejected', 'stepup_failed', 'stepup_pending')),
  attempts     smallint not null default 0 check (attempts between 0 and 99),
  reviewed_at  timestamptz,
  reviewed_by  text check (reviewed_by is null or char_length(reviewed_by) <= 120),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (auth_user_id, customer_id)
);

comment on table public.customer_identity_decisions is
  'What a website login decided about the Velto customer record matching its proven phone: claimed, "This isn''t me" (rejected, never auto-linked again), or a failed name check. Rejected and failed rows are flags for staff (possible change of phone owner).';

create index if not exists customer_identity_decisions_phone_idx on public.customer_identity_decisions (phone) where decision in ('rejected', 'stepup_failed');

alter table public.customer_identity_decisions enable row level security;
revoke all on table public.customer_identity_decisions from public, anon, authenticated, service_role;
grant select on table public.customer_identity_decisions to service_role;
grant update (reviewed_at, reviewed_by) on table public.customer_identity_decisions to service_role;

/* ---------- helpers (internal) ---------- */

-- Name words without punctuation or the usual prefixes, lower case. Bangla letters are kept.
create or replace function public.portal_name_words(p_name text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(w order by ord), '{}')
  from unnest(regexp_split_to_array(
         btrim(regexp_replace(lower(coalesce(p_name, '')), '[^a-zঀ-৿ ]+', ' ', 'g')), '\s+')) with ordinality as t(w, ord)
  where w <> '' and w not in ('md', 'mohammad', 'mohammed', 'muhammad', 'mohamad', 'mohd', 'mst', 'mosammat', 'mosamat',
                              'sheikh', 'sk', 'dr', 'mr', 'mrs', 'ms', 'miss', 'engr');
$$;

-- The typed name matches the stored one: same first real name word, or the same words throughout.
create or replace function public.portal_name_matches(p_typed text, p_stored text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when cardinality(public.portal_name_words(p_typed)) = 0 or cardinality(public.portal_name_words(p_stored)) = 0 then false
    when public.portal_name_words(p_typed) = public.portal_name_words(p_stored) then true
    when char_length((public.portal_name_words(p_stored))[1]) < 3 then false
    else (public.portal_name_words(p_typed))[1] = (public.portal_name_words(p_stored))[1]
  end
$$;

-- "Nazmul" from "Md. Nazmul Huda": the first real name word, as written in Ops.
create or replace function public.portal_first_name(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce((
    select initcap(w) from unnest(regexp_split_to_array(btrim(regexp_replace(coalesce(p_name, ''), '[^A-Za-zঀ-৿ ]+', ' ', 'g')), '\s+')) with ordinality as t(w, ord)
     where w <> '' and lower(w) not in ('md', 'mohammad', 'mohammed', 'muhammad', 'mohamad', 'mohd', 'mst', 'mosammat', 'mosamat',
                                        'sheikh', 'sk', 'dr', 'mr', 'mrs', 'ms', 'miss', 'engr')
     order by ord limit 1), '')
$$;

-- The phone this login has proven: SMS sign-in first, else the website's SMS link code.
create or replace function public.portal_proven_phone(p_uid uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.portal_auth_phone(p_uid),
                  (select a.proven_phone from public.customer_accounts a where a.auth_user_id = p_uid))
$$;

-- The match for this login, as a record the public functions turn into what may be shown.
create or replace function public.portal_match(p_uid uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_acc public.customer_accounts;
  v_phone text;
  v_matches integer;
  c public.customers;
  v_decision text;
  v_attempts smallint;
  v_orders integer;
  v_last date;
begin
  select * into v_acc from public.customer_accounts where auth_user_id = p_uid;
  if v_acc.link_status = 'linked' then return jsonb_build_object('state', 'linked'); end if;
  v_phone := public.portal_proven_phone(p_uid);
  if v_phone is null then return jsonb_build_object('state', 'unverified'); end if;

  select count(*) into v_matches from public.customers where phone = v_phone;
  if v_matches = 0 then return jsonb_build_object('state', 'none', 'phone', v_phone); end if;
  if v_matches > 1 then return jsonb_build_object('state', 'assisted', 'phone', v_phone, 'why', 'several'); end if;
  select * into c from public.customers where phone = v_phone;

  select d.decision, d.attempts into v_decision, v_attempts
    from public.customer_identity_decisions d where d.auth_user_id = p_uid and d.customer_id = c.id;
  if v_decision = 'rejected' or v_acc.link_status = 'rejected' then
    return jsonb_build_object('state', 'rejected', 'phone', v_phone, 'customerId', c.id);
  end if;
  if v_decision = 'stepup_failed' then
    return jsonb_build_object('state', 'assisted', 'phone', v_phone, 'customerId', c.id, 'why', 'name');
  end if;

  select count(*), max(o.order_date) into v_orders, v_last
    from public.orders o where o.customer_id = c.id and o.order_status is distinct from 'Cancelled' and o.order_date is not null;

  if v_last is null or v_last < (now() at time zone 'Asia/Dhaka')::date - interval '12 months'
     or exists (select 1 from public.customer_accounts x where x.customer_id = c.id and x.auth_user_id <> p_uid and x.link_status = 'linked') then
    return jsonb_build_object('state', 'stepup', 'phone', v_phone, 'customerId', c.id,
                              'attemptsLeft', greatest(0, 3 - coalesce(v_attempts, 0)));
  end if;
  return jsonb_build_object('state', 'recent', 'phone', v_phone, 'customerId', c.id,
                            'firstName', nullif(public.portal_first_name(c.name), ''),
                            'orders', v_orders, 'lastOrder', to_char(v_last, 'YYYY-MM'));
end;
$$;

-- Link this login to the customer (claim or staff), creating the account from Ops if needed.
create or replace function public.portal_link_claimed(p_uid uuid, p_customer uuid, p_phone text, p_terms smallint, p_by text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_acc public.customer_accounts;
  c public.customers;
  v_name text;
begin
  select * into c from public.customers where id = p_customer;
  select * into v_acc from public.customer_accounts where auth_user_id = p_uid for update;
  v_name := btrim(coalesce(c.name, ''));
  if char_length(v_name) < 2 then v_name := 'Velto customer'; end if;
  if v_acc.auth_user_id is null then
    if p_terms is null then
      raise exception 'terms not accepted' using errcode = '22023';
    end if;
    insert into public.customer_accounts (auth_user_id, customer_id, full_name, phone, verified_phone, address,
                                          link_status, link_method, link_requested_at, link_decided_at, link_decided_by,
                                          terms_version, terms_accepted_at, last_login_at)
    values (p_uid, c.id, left(v_name, 80), p_phone, p_phone, left(nullif(btrim(coalesce(c.address, '')), ''), 300),
            'linked', 'sms_otp', now(), now(), left(p_by, 120), p_terms, now(), now());
  else
    update public.customer_accounts
       set customer_id = c.id, verified_phone = p_phone, link_status = 'linked', link_method = 'sms_otp',
           link_requested_at = coalesce(link_requested_at, now()), link_decided_at = now(), link_decided_by = left(p_by, 120),
           address = coalesce(address, left(nullif(btrim(coalesce(c.address, '')), ''), 300)),
           updated_at = now()
     where auth_user_id = p_uid;
  end if;
  insert into public.customer_identity_decisions (auth_user_id, customer_id, phone, decision)
  values (p_uid, c.id, p_phone, 'claimed')
  on conflict (auth_user_id, customer_id) do update set decision = 'claimed', updated_at = now();
end;
$$;

/* ---------- customer-facing ---------- */

create or replace function public.portal_match_preview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_acc public.customer_accounts;
  m jsonb;
begin
  v_acc := public.portal_caller();
  m := public.portal_match(v_uid);
  -- Only what the state allows; never the phone's owner details before a claim.
  return jsonb_strip_nulls(jsonb_build_object(
    'state', m ->> 'state',
    'hasProfile', v_acc.auth_user_id is not null,
    'firstName', case when m ->> 'state' = 'recent' then m ->> 'firstName' end,
    'orders', case when m ->> 'state' = 'recent' then (m ->> 'orders')::int end,
    'lastOrder', case when m ->> 'state' = 'recent' then m ->> 'lastOrder' end,
    'attemptsLeft', case when m ->> 'state' = 'stepup' then (m ->> 'attemptsLeft')::int end
  ));
end;
$$;

-- "Continue to my account". Recent: links. Step-up: needs the name; three misses → staff.
create or replace function public.portal_claim_match(p_name text default null, p_terms_version smallint default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_acc public.customer_accounts;
  m jsonb;
  c public.customers;
  v_attempts smallint;
begin
  v_acc := public.portal_caller();
  m := public.portal_match(v_uid);
  if m ->> 'state' = 'linked' then return jsonb_build_object('ok', true, 'state', 'linked'); end if;
  if m ->> 'state' not in ('recent', 'stepup') then
    return jsonb_build_object('ok', false, 'state', m ->> 'state');
  end if;
  select * into c from public.customers where id = (m ->> 'customerId')::uuid;

  if m ->> 'state' = 'stepup' then
    if nullif(btrim(coalesce(p_name, '')), '') is null then
      return jsonb_build_object('ok', false, 'state', 'stepup', 'error', 'name_required', 'attemptsLeft', (m ->> 'attemptsLeft')::int);
    end if;
    if not public.portal_name_matches(p_name, c.name) then
      insert into public.customer_identity_decisions (auth_user_id, customer_id, phone, decision, attempts)
      values (v_uid, c.id, m ->> 'phone', 'stepup_pending', 1)
      on conflict (auth_user_id, customer_id) do update
        set attempts = public.customer_identity_decisions.attempts + 1,
            decision = case when public.customer_identity_decisions.attempts + 1 >= 3 then 'stepup_failed' else 'stepup_pending' end,
            updated_at = now()
      returning attempts into v_attempts;
      if v_attempts >= 3 then
        -- Staff take it from here: the existing link-request queue, when the account exists.
        update public.customer_accounts
           set link_status = 'pending', link_requested_at = coalesce(link_requested_at, now()), updated_at = now()
         where auth_user_id = v_uid and link_status = 'none';
        return jsonb_build_object('ok', false, 'state', 'assisted');
      end if;
      return jsonb_build_object('ok', false, 'state', 'stepup', 'error', 'name_mismatch', 'attemptsLeft', 3 - v_attempts);
    end if;
  end if;

  perform public.portal_link_claimed(v_uid, c.id, m ->> 'phone', p_terms_version,
    case when m ->> 'state' = 'stepup' then 'Customer confirmed (name check)' else 'Customer confirmed (welcome back)' end);
  return jsonb_build_object('ok', true, 'state', 'linked');
end;
$$;

-- "This isn't me": remembered for good; the history stays hidden and staff see a flag.
create or replace function public.portal_reject_match()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_acc public.customer_accounts;
  m jsonb;
begin
  v_acc := public.portal_caller();
  m := public.portal_match(v_uid);
  if m ->> 'state' not in ('recent', 'stepup', 'assisted') or m ->> 'customerId' is null then
    return jsonb_build_object('ok', false, 'state', m ->> 'state');
  end if;
  insert into public.customer_identity_decisions (auth_user_id, customer_id, phone, decision)
  values (v_uid, (m ->> 'customerId')::uuid, m ->> 'phone', 'rejected')
  on conflict (auth_user_id, customer_id) do update set decision = 'rejected', updated_at = now();
  -- A pending staff request for this match is withdrawn too.
  update public.customer_accounts set link_status = 'none', updated_at = now()
   where auth_user_id = v_uid and link_status = 'pending';
  return jsonb_build_object('ok', true, 'state', 'rejected');
end;
$$;

/* ---------- the old automatic paths now only record proof ---------- */

-- Kept for callers (portal_me, portal_profile_save): linking needs the customer's own "Continue".
create or replace function public.portal_auto_link(p_uid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  return;
end;
$$;

-- Website server only (service role): an email or Google login proved its phone with a website
-- SMS code. Records the proof; the account then shows the welcome-back confirmation.
create or replace function public.portal_link_verified_phone(p_auth_user_id uuid, p_phone text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_acc public.customer_accounts;
  v_phone text := public.portal_local_phone(p_phone);
  v_matches integer;
begin
  select * into v_acc from public.customer_accounts where auth_user_id = p_auth_user_id for update;
  if v_acc.auth_user_id is null then
    return jsonb_build_object('ok', false, 'reason', 'no_account');
  end if;
  if v_phone is null or v_phone <> v_acc.phone then
    return jsonb_build_object('ok', false, 'reason', 'phone_changed');
  end if;
  if v_acc.link_status = 'linked' then
    return jsonb_build_object('ok', true, 'result', 'linked');
  end if;
  update public.customer_accounts set proven_phone = v_phone, proven_at = now(), updated_at = now()
   where auth_user_id = p_auth_user_id;
  select count(*) into v_matches from public.customers where phone = v_phone;
  if v_matches = 0 then
    return jsonb_build_object('ok', true, 'result', 'no_orders');
  end if;
  if v_matches > 1 then
    update public.customer_accounts
       set link_status = 'pending', link_requested_at = coalesce(link_requested_at, now()), updated_at = now()
     where auth_user_id = p_auth_user_id and link_status = 'none';
    return jsonb_build_object('ok', true, 'result', 'pending');
  end if;
  return jsonb_build_object('ok', true, 'result', 'match');
end;
$$;

/* ---------- staff (service role) ---------- */

-- Possible change of phone owner: "This isn't me" and failed name checks, newest first.
create or replace function public.website_identity_flags(p_limit integer default 200)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(r order by (r ->> 'updatedAt') desc), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'authUserId', d.auth_user_id, 'customerId', d.customer_id, 'phone', d.phone, 'decision', d.decision,
      'attempts', d.attempts, 'createdAt', d.created_at, 'updatedAt', d.updated_at,
      'reviewedAt', d.reviewed_at, 'reviewedBy', d.reviewed_by,
      'customerName', c.name,
      'lastOrder', (select max(o.order_date) from public.orders o where o.customer_id = c.id and o.order_status is distinct from 'Cancelled'),
      'accountName', a.full_name, 'accountEmail', u.email
    ) as r
    from public.customer_identity_decisions d
    join public.customers c on c.id = d.customer_id
    left join public.customer_accounts a on a.auth_user_id = d.auth_user_id
    left join auth.users u on u.id = d.auth_user_id
    where d.decision in ('rejected', 'stepup_failed')
    order by d.updated_at desc
    limit least(greatest(coalesce(p_limit, 200), 1), 500)
  ) x;
$$;

create or replace function public.website_identity_flag_review(p_auth_user_id uuid, p_customer_id uuid, p_staff text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.customer_identity_decisions
     set reviewed_at = now(), reviewed_by = left(btrim(coalesce(p_staff, 'Staff')), 120), updated_at = now()
   where auth_user_id = p_auth_user_id and customer_id = p_customer_id and reviewed_at is null
     and decision in ('rejected', 'stepup_failed');
  return found;
end;
$$;

-- Phones (01XXXXXXXXX) with an unreviewed flag, for badges on bookings and the dispatch board.
create or replace function public.website_phone_flags(p_phones text[])
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct d.phone), '{}')
  from public.customer_identity_decisions d
  where d.decision in ('rejected', 'stepup_failed') and d.reviewed_at is null
    and d.phone = any (select public.portal_local_phone(x) from unnest(coalesce(p_phones, '{}')) x limit 500)
$$;

/* ---------- grants ---------- */

revoke all on function public.portal_name_words(text) from public, anon, authenticated, service_role;
revoke all on function public.portal_name_matches(text, text) from public, anon, authenticated, service_role;
revoke all on function public.portal_first_name(text) from public, anon, authenticated, service_role;
revoke all on function public.portal_proven_phone(uuid) from public, anon, authenticated, service_role;
revoke all on function public.portal_match(uuid) from public, anon, authenticated, service_role;
revoke all on function public.portal_link_claimed(uuid, uuid, text, smallint, text) from public, anon, authenticated, service_role;
revoke all on function public.portal_auto_link(uuid) from public, anon, authenticated, service_role;
revoke all on function public.portal_match_preview() from public, anon;
revoke all on function public.portal_claim_match(text, smallint) from public, anon;
revoke all on function public.portal_reject_match() from public, anon;
revoke all on function public.portal_link_verified_phone(uuid, text) from public, anon, authenticated;
revoke all on function public.website_identity_flags(integer) from public, anon, authenticated;
revoke all on function public.website_identity_flag_review(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.website_phone_flags(text[]) from public, anon, authenticated;

grant execute on function public.portal_match_preview() to authenticated;
grant execute on function public.portal_claim_match(text, smallint) to authenticated;
grant execute on function public.portal_reject_match() to authenticated;
grant execute on function public.portal_link_verified_phone(uuid, text) to service_role;
grant execute on function public.website_identity_flags(integer) to service_role;
grant execute on function public.website_identity_flag_review(uuid, uuid, text) to service_role;
grant execute on function public.website_phone_flags(text[]) to service_role;
