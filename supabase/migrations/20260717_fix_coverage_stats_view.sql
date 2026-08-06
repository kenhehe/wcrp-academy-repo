-- Fix ipo_coverage_stats view: approval_status IS NULL no longer identifies
-- IPO events (bulk-approve migration set all existing events to 'approved').
-- Filter by ipos.type = 'ipo' instead — this is the correct discriminator.

DROP VIEW IF EXISTS ipo_coverage_stats;

CREATE VIEW ipo_coverage_stats AS
SELECT
  i.id                                                        AS ipo_id,
  i.name,
  COUNT(e.id)                                                 AS total_events,
  COUNT(e.id) FILTER (WHERE e.in_academy = true)              AS in_academy,
  ROUND(
    COUNT(e.id) FILTER (WHERE e.in_academy = true)::numeric
    / NULLIF(COUNT(e.id), 0) * 100
  , 1)                                                        AS coverage_pct
FROM ipos i
LEFT JOIN events e ON e.ipo_id = i.id
WHERE i.type = 'ipo'
GROUP BY i.id, i.name;
