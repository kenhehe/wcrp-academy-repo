-- Recreate ipo_coverage_stats to exclude Lighthouse Activity orgs and events.
-- LHA events have approval_status IS NOT NULL; IPO events have approval_status IS NULL.
-- This ensures the per-IPO coverage bars on the Academy overview only reflect
-- the 7 scraped IPOs, not the 6 community-calendar lighthouse programmes.

DROP VIEW IF EXISTS ipo_coverage_stats;

CREATE VIEW ipo_coverage_stats AS
SELECT
  i.id                                                                      AS ipo_id,
  i.name,
  COUNT(e.id)                                                               AS total_events,
  COUNT(e.id) FILTER (WHERE e.in_academy = true)                           AS in_academy,
  ROUND(
    COUNT(e.id) FILTER (WHERE e.in_academy = true)::numeric
    / NULLIF(COUNT(e.id), 0) * 100
  , 1)                                                                      AS coverage_pct
FROM ipos i
LEFT JOIN events e
  ON  e.ipo_id          = i.id
  AND e.approval_status IS NULL   -- IPO events only
WHERE i.type = 'ipo'              -- exclude lighthouse programmes
GROUP BY i.id, i.name;
