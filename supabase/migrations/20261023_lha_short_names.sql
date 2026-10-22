-- ipos.name is the short label shown in dropdowns, charts and tables, and ipos.full_name
-- is the long one. Every IPO plus EPESC, GPEX, RCI and WCRP already stored an acronym in
-- name; these three Lighthouse programmes stored their full name there instead, which made
-- them the long odd ones out in every org filter. Applied to the live database on
-- 2026-10-23 via the service role; safe to re-run.

update public.ipos set name = 'DE',  full_name = 'Digital Earths'        where id = 'de'  and type = 'lighthouse';
update public.ipos set name = 'MCR', full_name = 'My Climate Risk'       where id = 'mcr' and type = 'lighthouse';
update public.ipos set name = 'SLC', full_name = 'Safe Landing Climates' where id = 'slc' and type = 'lighthouse';
