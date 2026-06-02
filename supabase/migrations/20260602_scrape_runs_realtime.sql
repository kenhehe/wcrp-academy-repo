-- Enable Realtime on scrape_runs so the health page auto-refreshes on status changes
do $$ begin
  alter publication supabase_realtime add table public.scrape_runs;
exception when others then null;
end $$;
