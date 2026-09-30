-- Velto Rhythm schedule. PRODUCTION ONLY (it calls the live website).
-- Apply after website_rhythm.sql. Re-running replaces the two jobs.
--   18:25 Dhaka  refresh + SMS for "regular, due now" (just before the 7–10 pm booking peak)
--   10:30 Dhaka  refresh + staff call tasks for slipping regulars (the day's calls)
--   every 10 min order updates for customers who allowed notifications (website_push.sql)
-- The website decides per playbook whether it is switched on (Admin → Reminders), so the jobs
-- can stay scheduled while everything is off.
select cron.unschedule(jobid) from cron.job where jobname in ('website-rhythm-evening', 'website-rhythm-morning', 'website-push-orders');
select cron.schedule('website-rhythm-evening', '25 12 * * *', $cron$
  select net.http_post(
    url := 'https://www.velto.com.bd/api/rhythm/run',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'x-rhythm-key', (select run_key from public.website_rhythm_keys where id = 1)),
    body := '{"mode":"evening"}'::jsonb,
    timeout_milliseconds := 60000)
$cron$);
select cron.schedule('website-rhythm-morning', '30 4 * * *', $cron$
  select net.http_post(
    url := 'https://www.velto.com.bd/api/rhythm/run',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'x-rhythm-key', (select run_key from public.website_rhythm_keys where id = 1)),
    body := '{"mode":"morning"}'::jsonb,
    timeout_milliseconds := 60000)
$cron$);
select cron.schedule('website-push-orders', '*/10 * * * *', $cron$
  select net.http_post(
    url := 'https://www.velto.com.bd/api/push/run',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'x-rhythm-key', (select run_key from public.website_rhythm_keys where id = 1)),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000)
$cron$);
