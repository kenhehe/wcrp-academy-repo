-- Fix scrape-clic-12h cron job: replace placeholder service key with real one
SELECT cron.unschedule('scrape-clic-12h');

SELECT cron.schedule(
  'scrape-clic-12h',
  '45 1,13 * * *',
  $$
  select net.http_post(
    url := 'https://aksymcfofktwbixomvvz.supabase.co/functions/v1/scrape-clic',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFrc3ltY2ZvZmt0d2JpeG9tdnZ6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Njk5MDI3OSwiZXhwIjoyMDkyNTY2Mjc5fQ.zXN3uQFl3CKkSLbDX1qgCJOV4C8FYaCDEBtxD1UPIQo"}'::jsonb,
    body := '{}'::jsonb
  )
  $$
);
