-- Runs the WordPress → academy_events sync (Edge Function sync-academy-wp) every day at
-- 02:00 UTC (10:00 UTC+8), after the scrapers' morning round (00:00–01:45 UTC). Until now the
-- sync only ran when someone pressed "Sync from Academy" in Gap Analysis; it last ran on
-- 2026-06-19, so the catalogue's copy was four months behind WordPress.
--
-- Applied 2026-10-27 by hand in the Supabase SQL editor. It needs the sync-academy-wp from
-- fix/academy-dates (deployed the same day), which reads WordPress's '20270111' dates; the
-- old version saved every date as empty.
--
-- Same approach as the scrapers' jobs (20261001_add_clivar_cron.sql): the service-role key
-- comes from the Vault secret 'service_role_key', which already exists for those jobs.
-- Check with: select name from vault.secrets where name = 'service_role_key';
--
-- Safe to re-run: cron.schedule replaces a job with the same name.
-- To stop the job: select cron.unschedule('sync-academy-wp-daily');

select cron.schedule(
  'sync-academy-wp-daily',
  '0 2 * * *',
  $$
  select net.http_post(
    url := 'https://aksymcfofktwbixomvvz.supabase.co/functions/v1/sync-academy-wp',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  )
  $$
);
