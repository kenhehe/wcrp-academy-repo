-- Sends scheduled survey emails: every 10 minutes, pg_cron asks the app's protected route
-- /api/surveys/cron to send whatever is due (invites, reminders), within the mailbox's
-- daily limit. Same approach as the scrapers' jobs (20261001_add_clivar_cron.sql); the
-- Vercel cron was removed on 2026-10-24.
--
-- NOT APPLIED YET. Apply only once the survey code is deployed to production and the email
-- env vars are set there, or every run will fail.
--
-- PREREQUISITE (run once, manually, in the SQL editor; never put the real value in a
-- committed file). The value must equal the SURVEYS_CRON_SECRET env var on Vercel:
--
--   select vault.create_secret(
--     '<the SURVEYS_CRON_SECRET value>',
--     'surveys_cron_secret',
--     'Bearer token pg_cron sends to /api/surveys/cron'
--   );
--
-- Check it exists with: select name from vault.secrets where name = 'surveys_cron_secret';
-- To stop the job: select cron.unschedule('survey-emails-10min');

select cron.schedule(
  'survey-emails-10min',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://wcrp-academy-repo.vercel.app/api/surveys/cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets where name = 'surveys_cron_secret'
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  )
  $$
);
