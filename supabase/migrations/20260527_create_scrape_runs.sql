-- Create scrape_runs table for tracking scraper job history
create table if not exists public.scrape_runs (
  id             uuid primary key default gen_random_uuid(),
  ipo_id         text not null,
  started_at     timestamptz not null default now(),
  finished_at    timestamptz,
  status         text not null default 'queued'
                   check (status in ('queued','running','success','partial','failed','skipped')),
  events_found   integer,
  events_new     integer,
  events_updated integer,
  error_message  text,
  errors         text[],
  duration_ms    integer
);

-- Index for per-IPO lookups (health page, pre-check)
create index if not exists scrape_runs_ipo_started
  on public.scrape_runs (ipo_id, started_at desc);

-- RLS: authenticated users can read; service role can write (scrapers use service key)
alter table public.scrape_runs enable row level security;

drop policy if exists "authenticated users can read scrape_runs" on public.scrape_runs;
create policy "authenticated users can read scrape_runs"
  on public.scrape_runs for select
  to authenticated
  using (true);

drop policy if exists "service role can insert scrape_runs" on public.scrape_runs;
create policy "service role can insert scrape_runs"
  on public.scrape_runs for insert
  to service_role
  with check (true);

drop policy if exists "service role can update scrape_runs" on public.scrape_runs;
create policy "service role can update scrape_runs"
  on public.scrape_runs for update
  to service_role
  using (true);
