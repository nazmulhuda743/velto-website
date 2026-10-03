-- Velto notifications: six preferences (Profile → Notifications). Apply AFTER website_push.sql.
--
-- Operational updates are on by default and promotions are off unless the customer opts in:
--   order_updates    Order updates             confirmed, ready, delivered        (website_push.sql)
--   pickup_updates   Pickup & delivery         windows, rider approaching, changes
--   care_updates     Care & important decisions (recommended; off → usual contact method instead)
--   payment_updates  Payment updates           due, reported, verified
--   reminders        Pickup reminders          at most twice a month              (website_push.sql)
--   offers           Offers & promotions       off unless opted in
--
-- website_push_prefs_set(user, {"order":…, "pickup":…, "care":…, "payment":…, "reminders":…, "offers":…})
-- changes only the keys present (booleans) on that login's active subscriptions.
-- website_push_status returns all six (orderUpdates and reminders kept as before).
-- website_push_prefs(uuid, boolean, boolean) keeps working. Service role only. Idempotent.

begin;

alter table public.website_push_subs add column if not exists pickup_updates  boolean not null default true;
alter table public.website_push_subs add column if not exists care_updates    boolean not null default true;
alter table public.website_push_subs add column if not exists payment_updates boolean not null default true;
alter table public.website_push_subs add column if not exists offers          boolean not null default false;

-- What the account page shows: is this login getting notifications, and which. With no active
-- subscription, the defaults (everything operational on, offers off).
create or replace function public.website_push_status(p_auth_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'devices', count(*),
    'orderUpdates', coalesce(bool_or(order_updates), true),
    'pickupUpdates', coalesce(bool_or(pickup_updates), true),
    'careUpdates', coalesce(bool_or(care_updates), true),
    'paymentUpdates', coalesce(bool_or(payment_updates), true),
    'reminders', coalesce(bool_or(reminders), true),
    'offers', coalesce(bool_or(offers), false))
    from public.website_push_subs where auth_user_id = p_auth_user_id and active
$$;

-- Set any of the six; keys missing (or not true/false) are left as they are.
create or replace function public.website_push_prefs_set(p_auth_user_id uuid, p_prefs jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  p jsonb := case when jsonb_typeof(p_prefs) = 'object' then p_prefs else '{}'::jsonb end;
  v_order boolean := case when jsonb_typeof(p -> 'order') = 'boolean' then (p ->> 'order')::boolean end;
  v_pickup boolean := case when jsonb_typeof(p -> 'pickup') = 'boolean' then (p ->> 'pickup')::boolean end;
  v_care boolean := case when jsonb_typeof(p -> 'care') = 'boolean' then (p ->> 'care')::boolean end;
  v_payment boolean := case when jsonb_typeof(p -> 'payment') = 'boolean' then (p ->> 'payment')::boolean end;
  v_reminders boolean := case when jsonb_typeof(p -> 'reminders') = 'boolean' then (p ->> 'reminders')::boolean end;
  v_offers boolean := case when jsonb_typeof(p -> 'offers') = 'boolean' then (p ->> 'offers')::boolean end;
begin
  if p_auth_user_id is not null
     and coalesce(v_order, v_pickup, v_care, v_payment, v_reminders, v_offers) is not null then
    update public.website_push_subs
       set order_updates = coalesce(v_order, order_updates),
           pickup_updates = coalesce(v_pickup, pickup_updates),
           care_updates = coalesce(v_care, care_updates),
           payment_updates = coalesce(v_payment, payment_updates),
           reminders = coalesce(v_reminders, reminders),
           offers = coalesce(v_offers, offers),
           updated_at = now()
     where auth_user_id = p_auth_user_id and active;
  end if;
  return public.website_push_status(p_auth_user_id);
end;
$$;

revoke all on function public.website_push_status(uuid) from public, anon, authenticated;
revoke all on function public.website_push_prefs_set(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.website_push_status(uuid) to service_role;
grant execute on function public.website_push_prefs_set(uuid, jsonb) to service_role;

commit;
