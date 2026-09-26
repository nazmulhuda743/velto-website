-- Website team task board (Trello/ClickUp-style), for the Command Center.
--
-- Website-only tables for the people on the Access page. Velto Ops' own tasks
-- (pickups, calls; public.tasks) are separate and untouched. Price-change
-- requests are shown on the board by the app from website_price_changes; they
-- are not copied here.
--
-- No deletes: tasks are archived. Everything is service_role only (the admin
-- server enforces who may do what and records it in the activity log).
--
-- Status: applied to STAGING (ekgdefcdqcsqvpbqponv) and tested with
-- docs/technical/sql/tests/website_board_test.sql; production only
-- with the owner's approval.

begin;

create table if not exists public.website_board_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 1 and 160),
  description text check (description is null or length(description) <= 5000),
  status text not null default 'todo' check (status in ('todo', 'doing', 'review', 'done')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  position double precision not null default 0,
  assignee_id uuid references auth.users(id) on delete set null,
  assignee_name text check (assignee_name is null or length(assignee_name) <= 120),
  due_date date,
  labels text[] not null default '{}' check (cardinality(labels) <= 8),
  checklist jsonb not null default '[]'::jsonb check (jsonb_typeof(checklist) = 'array' and jsonb_array_length(checklist) <= 30),
  created_by_id uuid,
  created_by_name text not null check (length(created_by_name) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  archived boolean not null default false
);

create index if not exists website_board_tasks_board_idx on public.website_board_tasks (archived, status, position);
create index if not exists website_board_tasks_assignee_idx on public.website_board_tasks (assignee_id) where not archived;

create table if not exists public.website_board_comments (
  id bigint generated always as identity primary key,
  task_id uuid not null references public.website_board_tasks(id) on delete cascade,
  author_id uuid,
  author_name text not null check (length(author_name) between 1 and 120),
  body text not null check (length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists website_board_comments_task_idx on public.website_board_comments (task_id, created_at);

-- Keep updated_at / completed_at honest whatever the app sends.
create or replace function public.website_board_touch()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at := now();
  if new.status = 'done' and (tg_op = 'INSERT' or old.status is distinct from 'done') then
    new.completed_at := now();
  elsif new.status <> 'done' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists website_board_tasks_touch on public.website_board_tasks;
create trigger website_board_tasks_touch
  before insert or update on public.website_board_tasks
  for each row execute function public.website_board_touch();

alter table public.website_board_tasks enable row level security;
alter table public.website_board_comments enable row level security;
revoke all on public.website_board_tasks from anon, authenticated, public, service_role;
revoke all on public.website_board_comments from anon, authenticated, public, service_role;
grant select, insert, update on public.website_board_tasks to service_role;
grant select, insert on public.website_board_comments to service_role;
revoke all on function public.website_board_touch() from public, anon, authenticated;

commit;
