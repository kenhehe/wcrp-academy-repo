alter table events
  add column duplicate_of_event_id uuid references events(id) on delete set null;

create index idx_events_duplicate_of on events(duplicate_of_event_id)
  where duplicate_of_event_id is not null;

-- ipo_coverage_stats is intentionally NOT modified — each IPO keeps full,
-- unfiltered credit for every event it published, linked or not.

-- Finds likely cross-IPO duplicates: same start_date, different ipo_id,
-- fuzzy title match via pg_trgm (already enabled — required by find_fuzzy_matches).
-- Sibling function to find_fuzzy_matches, scoped to events <-> events instead of
-- events <-> academy_events.
create or replace function find_cross_ipo_duplicates(event_ids uuid[], threshold float)
returns table (
  event_id            uuid,
  duplicate_event_id  uuid,
  duplicate_ipo_id    text,
  duplicate_title     text,
  duplicate_start_date date,
  duplicate_url       text,
  score               real
)
language sql
stable
as $$
  select distinct on (e1.id)
    e1.id         as event_id,
    e2.id         as duplicate_event_id,
    e2.ipo_id     as duplicate_ipo_id,
    e2.title      as duplicate_title,
    e2.start_date as duplicate_start_date,
    e2.url        as duplicate_url,
    similarity(e1.title, e2.title) as score
  from events e1
  join events e2
    on  e2.start_date            = e1.start_date
    and e2.ipo_id                != e1.ipo_id
    and e2.id                    != e1.id
    and e2.duplicate_of_event_id is null
    and similarity(e1.title, e2.title) >= threshold
  where e1.id = any(event_ids)
    and e1.duplicate_of_event_id is null
  order by e1.id, score desc;
$$;
