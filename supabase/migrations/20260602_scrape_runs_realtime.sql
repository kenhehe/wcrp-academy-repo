-- Enable Realtime on scrape_runs so the health page auto-refreshes on status changes
alter publication supabase_realtime add table public.scrape_runs;
