-- Velto app (installed website) per customer: "has this customer opened the app on any phone?"
-- Lets the website stop offering the app to customers who already have it, also on iPhone, where
-- the installed app and Safari don't share storage. Safe to run more than once.
--
-- Written by the app itself: the first time a signed-in customer opens Velto from the home screen,
-- the site calls portal_app_mark_installed(). Read on the booking page: portal_app_installed().

alter table public.customer_accounts add column if not exists app_installed_at timestamptz;

comment on column public.customer_accounts.app_installed_at is
  'First time this login opened the installed Velto app (home-screen launch). Null: never seen in the app.';

-- The caller's login, or any other login linked to the same Velto customer, has opened the app.
create or replace function public.portal_app_installed()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_acc public.customer_accounts;
begin
  if v_uid is null then
    return false;
  end if;
  select * into v_acc from public.customer_accounts where auth_user_id = v_uid;
  if not found then
    return false;
  end if;
  return v_acc.app_installed_at is not null
    or (v_acc.customer_id is not null and exists (
      select 1 from public.customer_accounts a
      where a.customer_id = v_acc.customer_id and a.app_installed_at is not null
    ));
end;
$$;

-- Records the first app launch for the caller's login. Later calls change nothing.
create or replace function public.portal_app_mark_installed()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    return false;
  end if;
  update public.customer_accounts
     set app_installed_at = coalesce(app_installed_at, now())
   where auth_user_id = v_uid;
  return found;
end;
$$;

revoke all on function public.portal_app_installed() from public, anon;
revoke all on function public.portal_app_mark_installed() from public, anon;
grant execute on function public.portal_app_installed() to authenticated;
grant execute on function public.portal_app_mark_installed() to authenticated;
