-- The 'wcrp' org row (the Secretariat/Climate account's own org, not one of the
-- 7 scraped IPOs) has been tagged type='ipo' since type was introduced
-- (20260713_add_lighthouse_support.sql:8). That was harmless when type only
-- distinguished ipo vs lighthouse, but every later feature that treats
-- type='ipo' as shorthand for "the 7 real IPOs" (Gap Analysis, Duplicates,
-- ipo_coverage_stats, Climate Analytics) now also silently picks up this
-- zero-content row. Give it its own type instead of special-casing every query.

ALTER TABLE public.ipos
  DROP CONSTRAINT IF EXISTS ipos_type_check;

ALTER TABLE public.ipos
  ADD CONSTRAINT ipos_type_check
  CHECK (type IN ('ipo', 'lighthouse', 'secretariat'));

UPDATE public.ipos SET type = 'secretariat' WHERE id = 'wcrp';
