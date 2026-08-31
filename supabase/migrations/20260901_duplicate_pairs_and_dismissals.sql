create table duplicate_dismissals (
  event_id           uuid not null references events(id) on delete cascade,
  duplicate_event_id uuid not null references events(id) on delete cascade,
  dismissed_at       timestamptz not null default now(),
  primary key (event_id, duplicate_event_id)
);

-- No policies added on purpose — this table is only ever touched via
-- createAdminClient() (service role, which bypasses RLS regardless), so
-- default-deny is correct: it blocks direct anon/authenticated access via
-- the REST API without affecting the app's own access path at all.
alter table duplicate_dismissals enable row level security;

drop function if exists find_cross_ipo_duplicates(uuid[], float);

-- Replaces the previous per-page "enrich these event ids" function with a
-- directly-paginated list of candidate PAIRS across the whole table, since
-- pairs (not individual events) are now the thing being reviewed.
-- e1.id < e2.id canonicalizes each pair so it's returned once, not twice.
create or replace function find_cross_ipo_duplicate_pairs(
  threshold     float,
  p_ipo_id      text default null,
  result_limit  int  default 10,
  result_offset int  default 0
)
returns table (
  event_id              uuid,
  event_ipo_id          text,
  event_title           text,
  event_start_date      date,
  event_url             text,
  duplicate_event_id    uuid,
  duplicate_ipo_id      text,
  duplicate_title       text,
  duplicate_start_date  date,
  duplicate_url         text,
  score                 real,
  total_count           bigint
)
language sql
stable
as $$
  select
    e1.id, e1.ipo_id, e1.title, e1.start_date, e1.url,
    e2.id, e2.ipo_id, e2.title, e2.start_date, e2.url,
    similarity(e1.title, e2.title) as score,
    count(*) over() as total_count
  from events e1
  join events e2
    on  e2.start_date = e1.start_date
    and e2.ipo_id     != e1.ipo_id
    and e1.id          < e2.id
    and similarity(e1.title, e2.title) >= threshold
  where e1.duplicate_of_event_id is null
    and e2.duplicate_of_event_id is null
    and (p_ipo_id is null or e1.ipo_id = p_ipo_id or e2.ipo_id = p_ipo_id)
    and not exists (
      select 1 from duplicate_dismissals d
      where (d.event_id = e1.id and d.duplicate_event_id = e2.id)
         or (d.event_id = e2.id and d.duplicate_event_id = e1.id)
    )
  order by score desc
  limit result_limit offset result_offset;
$$;
