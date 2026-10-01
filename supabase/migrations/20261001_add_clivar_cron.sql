-- Restores the recurring scrape-clivar cron job. It's been missing since
-- 2026-06-07 (nearly 4 months) -- not a scraper bug, confirmed via a dry-run
-- invocation that correctly found 5 real upcoming events; it simply has no
-- schedule triggering it. The other 6 scrapers each have their own pg_cron
-- job at a staggered 15-minute offset (00:00/12:00, :15, :30, :45 ...); this
-- slots clivar into the one open gap (:15 past 01:00/13:00), clear of cmip
-- (:00) and clic (:45) on either side.
--
-- Unlike the existing clic job (20260603_fix_clic_cron_key.sql), this one
-- authenticates via a Supabase Vault secret instead of a hardcoded key, so no
-- live credential is committed to this file.
--
-- PREREQUISITE (run once, manually, in the SQL editor -- do NOT add the real
-- key to this or any committed file):
--
--   select vault.create_secret(
--     '<your SUPABASE_SERVICE_ROLE_KEY>',
--     'service_role_key',
--     'Used by pg_cron jobs to authenticate calls to Edge Functions'
--   );
--
-- Skip that step if a 'service_role_key' secret already exists (e.g. reused
-- by a future migration for the other 6 scrapers) -- check first with:
--   select name from vault.secrets where name = 'service_role_key';

select cron.schedule(
  'scrape-clivar-12h',
  '15 1,13 * * *',
  $$
  select net.http_post(
    url := 'https://aksymcfofktwbixomvvz.supabase.co/functions/v1/scrape-clivar',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'
      )
    ),
    body := '{}'::jsonb
  )
  $$
);
