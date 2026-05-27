-- Add source column to distinguish cron vs manual triggers
alter table public.scrape_runs
  add column if not exists source text default 'cron'
    check (source in ('cron', 'manual', 'manual-all'));
