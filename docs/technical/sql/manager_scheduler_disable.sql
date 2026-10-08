-- Emergency disable only AFTER rolling back the scheduler application deployment.
-- Preserves appointments, canonical jobs/tasks/orders, activity and memberships.
begin;
drop trigger if exists ops_scheduler_dispatch_changed on public.website_dispatch_jobs;
drop trigger if exists ops_scheduler_order_changed on public.orders;
do $$ declare f regprocedure; begin
 for f in select oid::regprocedure from pg_proc where pronamespace='public'::regnamespace and proname like 'ops_scheduler_%' loop
  execute format('revoke execute on function %s from service_role',f);
 end loop;
end $$;
commit;
-- To re-enable: reapply the versioned additive migration, then deploy the scheduler again.
