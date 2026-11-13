-- Website chat: a rate limit (per visitor and a daily ceiling for the whole site) and a log of
-- the questions and answers, so the owner can see what customers ask and improve the answers.
-- Server only (service_role); the browser never reads either table. Idempotent.

create table if not exists public.website_chat_rate_limits (
  bucket text not null check (bucket in ('ip', 'day')),
  rate_key text not null check (rate_key ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz not null default now(),
  attempts integer not null default 0 check (attempts >= 0),
  updated_at timestamptz not null default now(),
  primary key (bucket, rate_key)
);
alter table public.website_chat_rate_limits enable row level security;
revoke all on public.website_chat_rate_limits from public, anon, authenticated;

-- One visitor: 20 messages per 10 minutes. The whole site: 3000 messages per Dhaka day.
create or replace function public.website_chat_rate_limit(p_bucket text, p_rate_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window interval := case when p_bucket = 'ip' then interval '10 minutes' else interval '1 day' end;
  v_limit integer := case when p_bucket = 'ip' then 20 else 3000 end;
  v_attempts integer;
  v_started timestamptz;
begin
  if p_bucket not in ('ip', 'day') or p_rate_key !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('ok', false);
  end if;
  insert into public.website_chat_rate_limits as rl (bucket, rate_key, window_started_at, attempts, updated_at)
  values (p_bucket, p_rate_key, now(), 1, now())
  on conflict (bucket, rate_key) do update set
    window_started_at = case when rl.window_started_at <= now() - v_window then now() else rl.window_started_at end,
    attempts = case when rl.window_started_at <= now() - v_window then 1 else least(rl.attempts + 1, 2147483647) end,
    updated_at = now()
  returning attempts, window_started_at into v_attempts, v_started;
  if random() < 0.01 then
    delete from public.website_chat_rate_limits where updated_at < now() - interval '2 days';
  end if;
  return jsonb_build_object(
    'ok', true,
    'allowed', v_attempts <= v_limit,
    'retry_after_seconds', case when v_attempts <= v_limit then 0
      else greatest(1, ceil(extract(epoch from ((v_started + v_window) - clock_timestamp())))::integer) end
  );
end;
$$;
revoke all on function public.website_chat_rate_limit(text, text) from public, anon, authenticated;
grant execute on function public.website_chat_rate_limit(text, text) to service_role;

-- The log: one row per question and its answer. The conversation id is a random id from the
-- browser (no account, no phone). Kept 90 days.
create table if not exists public.website_chat_log (
  id bigint generated always as identity primary key,
  conversation_id uuid not null,
  lang text not null check (lang in ('en', 'bn')),
  page text,
  question text not null,
  answer text not null,
  outcome text not null default 'answered' check (outcome in ('answered', 'failed', 'limited')),
  created_at timestamptz not null default now()
);
alter table public.website_chat_log enable row level security;
revoke all on public.website_chat_log from public, anon, authenticated;
create index if not exists website_chat_log_conversation_idx on public.website_chat_log (conversation_id, created_at);
create index if not exists website_chat_log_created_idx on public.website_chat_log (created_at desc);

create or replace function public.website_chat_log_add(
  p_conversation uuid, p_lang text, p_page text, p_question text, p_answer text, p_outcome text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.website_chat_log (conversation_id, lang, page, question, answer, outcome)
  values (
    p_conversation,
    case when p_lang = 'bn' then 'bn' else 'en' end,
    left(p_page, 200),
    left(p_question, 1000),
    left(p_answer, 4000),
    case when p_outcome in ('answered', 'failed', 'limited') then p_outcome else 'answered' end
  );
  if random() < 0.01 then
    delete from public.website_chat_log where created_at < now() - interval '90 days';
  end if;
end;
$$;
revoke all on function public.website_chat_log_add(uuid, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.website_chat_log_add(uuid, text, text, text, text, text) to service_role;

-- Admin → Chat questions: the questions and answers of the last days, newest first.
-- Service role only (the admin server); the browser never reads the log.
create or replace function public.website_chat_admin_list(p_days integer, p_limit integer)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'conversation', x.conversation_id,
    'lang', x.lang,
    'page', x.page,
    'question', x.question,
    'answer', x.answer,
    'outcome', x.outcome,
    'at', x.created_at
  ) order by x.created_at desc), '[]'::jsonb)
  from (
    select * from public.website_chat_log
    where created_at > now() - make_interval(days => least(greatest(coalesce(p_days, 7), 1), 90))
    order by created_at desc
    limit least(greatest(coalesce(p_limit, 500), 1), 2000)
  ) x;
$$;
revoke all on function public.website_chat_admin_list(integer, integer) from public, anon, authenticated;
grant execute on function public.website_chat_admin_list(integer, integer) to service_role;
