-- Synthetic test for docs/technical/sql/website_board.sql. STAGING ONLY.
-- Expected: an error reading "ALL_TESTS_PASSED (rolled back)".
do $$
declare t uuid; c_at timestamptz;
begin
  execute 'set local role service_role';
  insert into website_board_tasks (title, created_by_name) values ('ZZ board test', 'Tester') returning id into t;
  assert (select status from website_board_tasks where id = t) = 'todo', 'default status';
  update website_board_tasks set status = 'done' where id = t;
  select completed_at into c_at from website_board_tasks where id = t;
  assert c_at is not null, 'completed_at set';
  update website_board_tasks set status = 'doing' where id = t;
  assert (select completed_at from website_board_tasks where id = t) is null, 'completed_at cleared';
  insert into website_board_comments (task_id, author_name, body) values (t, 'Tester', 'Looks good');
  begin update website_board_tasks set status = 'someday' where id = t; raise exception 'bad status'; exception when check_violation then null; end;
  begin update website_board_tasks set title = '   ' where id = t; raise exception 'blank title'; exception when check_violation then null; end;
  begin delete from website_board_tasks where id = t; raise exception 'delete allowed'; exception when insufficient_privilege then null; end;
  begin update website_board_comments set body = 'x'; raise exception 'comment edit allowed'; exception when insufficient_privilege then null; end;
  execute 'reset role';
  assert not has_table_privilege('authenticated', 'public.website_board_tasks', 'select'), 'auth select';
  assert not has_table_privilege('anon', 'public.website_board_comments', 'select'), 'anon select';
  raise exception 'ALL_TESTS_PASSED (rolled back)';
end $$;
