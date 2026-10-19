-- App step 7: the page language on every first-party analytics event, so the app report can show the
-- Bangla share of sessions and whether Bangla bookings complete as often as English ones.
-- Additive and nullable: older rows and browsers that send no language stay null. The website keeps
-- working before this runs (src/lib/analytics/store.ts stores rows without `lang` until the column exists).
-- Apply on staging first, then on production with the owner's "Run sql".

alter table public.website_analytics_events
  add column if not exists lang text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'website_analytics_events_lang_check'
      and conrelid = 'public.website_analytics_events'::regclass
  ) then
    alter table public.website_analytics_events
      add constraint website_analytics_events_lang_check check (lang is null or lang in ('en', 'bn'));
  end if;
end $$;

-- The app report reads app-path events by time.
create index if not exists website_analytics_events_app_idx
  on public.website_analytics_events (occurred_at desc)
  where path like '/app/%';

-- PostgREST picks up the new column without a restart.
notify pgrst, 'reload schema';
