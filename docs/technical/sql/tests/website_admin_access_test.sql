-- Synthetic test for docs/technical/sql/website_admin_access.sql.
-- STAGING ONLY. Creates a throwaway login, checks every rule, then raises so
-- the block rolls back. Expected: an error reading "ALL_TESTS_PASSED (rolled back)".
do $$
declare
  u uuid := gen_random_uuid();
  admin_id uuid;
  x jsonb;
begin
  insert into auth.users (id, email, aud, role, instance_id) values (u, 'zz-access-test-' || left(u::text, 8) || '@example.invalid', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
  x := website_admin_access_for(u);
  assert x->'profile' = 'null'::jsonb and x->'member' = 'null'::jsonb, 'fresh user has nothing';
  x := website_admin_find_user(upper('zz-access-test-' || left(u::text, 8) || '@example.invalid'));
  assert x->>'id' = u::text and x->>'opsRole' is null, 'find user';
  assert website_admin_find_user('nobody-' || u::text || '@example.invalid') is null, 'unknown email is null';

  insert into website_admin_members (user_id, email, name, role, origin, created_by) values (u, 'zz@example.invalid', 'ZZ Designer', 'designer', 'website', 'Test');
  x := website_admin_access_for(u);
  assert x->'member'->>'role' = 'designer' and (x->'member'->>'active')::boolean, 'member visible';
  assert exists (select 1 from jsonb_array_elements(website_admin_people()) p where p->>'userId' = u::text and p->>'role' = 'designer'), 'in people list';

  select id into admin_id from profiles where role = 'admin' limit 1;
  if admin_id is not null then
    assert exists (select 1 from jsonb_array_elements(website_admin_people()) p where p->>'userId' = admin_id::text and p->>'role' = 'owner' and p->>'origin' = 'ops_admin'), 'ops admin is owner';
  end if;

  begin
    update website_admin_members set role = 'superuser' where user_id = u;
    raise exception 'bad role accepted';
  exception when check_violation then null;
  end;

  -- As the website server (service_role): can insert activity, cannot change or delete it.
  execute 'set local role service_role';
  insert into website_admin_activity (actor_id, actor_name, actor_role, section, action, target, summary) values (u, 'ZZ Designer', 'designer', 'images', 'image_replaced', 'hero', 'Replaced Homepage hero');
  begin
    update website_admin_activity set summary = 'tampered' where actor_id = u;
    raise exception 'activity update allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from website_admin_activity where actor_id = u;
    raise exception 'activity delete allowed';
  exception when insufficient_privilege then null;
  end;
  update website_admin_members set role = 'manager', updated_by = 'Test' where user_id = u;
  execute 'reset role';

  assert (select a->>'lastSeen' from jsonb_array_elements(website_admin_people()) a where a->>'userId' = u::text) is not null, 'last seen';
  assert website_admin_access_for(u)->'member'->>'role' = 'manager', 'role changed';

  assert not has_table_privilege('anon', 'public.website_admin_members', 'select'), 'anon members';
  assert not has_table_privilege('authenticated', 'public.website_admin_activity', 'select'), 'auth activity';
  assert not has_function_privilege('authenticated', 'public.website_admin_find_user(text)', 'execute'), 'auth find';
  assert not has_function_privilege('anon', 'public.website_admin_access_for(uuid)', 'execute'), 'anon access';
  assert has_function_privilege('service_role', 'public.website_admin_people()', 'execute'), 'service people';

  delete from website_admin_activity where actor_id = u;
  delete from auth.users where id = u;
  assert not exists (select 1 from website_admin_members where user_id = u), 'cascade';

  raise exception 'ALL_TESTS_PASSED (rolled back)';
end;
$$;
