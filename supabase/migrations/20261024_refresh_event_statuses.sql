-- Rolls event statuses forward by date every night.
--
-- events.status is written when an event is saved: scrapers recompute it (computeStatus) on
-- every run for the events still listed on their source site. Nothing re-saves the rest —
-- hand-entered Lighthouse / Academy / Secretariat events, the wcrp-climate.org import, and IPO
-- events that have dropped off their site — so those would keep "Upcoming" after their date
-- (first one due: SLC's 3 Dec 2026 tipping-points session). On 2026-10-24 none were stale yet.
--
-- Upcoming -> Ongoing once the start date arrives, Upcoming/Ongoing -> Past once the last day
-- has gone. Cancelled and Postponed are never touched. Dates compare in UTC (current_date on
-- the database), like the scrapers.
--
-- NOT YET APPLIED when committed: paste into the Supabase SQL editor and run once. Safe to re-run
-- (the function is replaced and the cron job re-created). Needs pg_cron, already enabled for
-- the scraper jobs.

create or replace function public.refresh_event_statuses()
returns void
language sql
as $$
  update public.events
     set status = 'Past'
   where status in ('Upcoming', 'Ongoing')
     and greatest(start_date::date, coalesce(end_date, start_date)::date) < current_date;

  update public.events
     set status = 'Ongoing'
   where status = 'Upcoming'
     and start_date::date <= current_date
     and greatest(start_date::date, coalesce(end_date, start_date)::date) >= current_date;
$$;

select cron.unschedule(jobid) from cron.job where jobname = 'refresh-event-statuses-daily';

-- Daily at 00:05 UTC, just after the date changes
select cron.schedule('refresh-event-statuses-daily', '5 0 * * *', $$ select public.refresh_event_statuses() $$);

-- Bring everything up to date now
select public.refresh_event_statuses();
