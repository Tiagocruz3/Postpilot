CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'postpilot-scheduler-tick') THEN
    PERFORM cron.unschedule((SELECT jobid FROM cron.job WHERE jobname = 'postpilot-scheduler-tick' LIMIT 1));
  END IF;
END $$;

SELECT cron.schedule(
  'postpilot-scheduler-tick',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://wjtwyifbndmlpymbtefx.supabase.co/functions/v1/scheduler-tick',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
