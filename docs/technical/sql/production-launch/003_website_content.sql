-- Website-managed content plus public media bucket used by the existing admin dashboard.
-- This does not seed or overwrite website content documents.

create table if not exists public.website_content (
  key text primary key check (key ~ '^[a-z][a-z0-9_:.-]{0,63}$'),
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text
);

alter table public.website_content enable row level security;
revoke all on public.website_content from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.website_content to service_role;

do $$
begin
  if exists (
    select required.column_name
    from (values ('key'),('value'),('updated_at'),('updated_by')) required(column_name)
    where not exists (
      select 1 from information_schema.columns c
      where c.table_schema='public' and c.table_name='website_content'
        and c.column_name=required.column_name
    )
  ) then
    raise exception 'website_content schema does not match reviewed contract';
  end if;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'website-media',
  'website-media',
  true,
  8388608,
  array['image/jpeg','image/png','image/webp','image/avif']
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
