-- Run on STAGING after website_analytics_lang.sql. Everything rolls back.
begin;
do $$
declare v uuid := gen_random_uuid(); s uuid := gen_random_uuid(); ok boolean;
begin
  insert into public.website_analytics_events (visitor_id, session_id, event, path, device, lang)
    values (v, s, 'app_open', '/app/home', 'mobile', 'bn'), (v, s, 'booking_success', '/app/book', 'mobile', 'en'), (v, s, 'page_view', '/', 'desktop', null);
  if (select count(*) from public.website_analytics_events where visitor_id = v) <> 3 then raise exception 'lang: en, bn and null are accepted'; end if;
  begin
    insert into public.website_analytics_events (visitor_id, session_id, event, path, device, lang) values (v, s, 'app_open', '/app/home', 'mobile', 'fr');
    ok := false;
  exception when check_violation then ok := true;
  end;
  if not ok then raise exception 'lang: anything else is rejected'; end if;
  raise notice 'website_analytics_lang: all checks passed';
end $$;
rollback;
