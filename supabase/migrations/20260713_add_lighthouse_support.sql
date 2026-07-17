-- Add type column to ipos (ipo = scraped automatically, lighthouse = manual + approval)
ALTER TABLE public.ipos
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'ipo'
  CHECK (type IN ('ipo', 'lighthouse'));

-- Mark existing scraped IPOs
UPDATE public.ipos SET type = 'ipo'
  WHERE id IN ('gewex','cordex','esmo','rifs','cmip','clic','clivar','wcrp');

-- Insert 6 Lighthouse Activities
INSERT INTO public.ipos (id, name, full_name, type, is_active, color_hex, website, events_url) VALUES
  ('de',    'Digital Earths',    'Digital Earths',                                  'lighthouse', true, '#0ea5e9', 'https://www.wcrp-climate.org/lha-overview', 'https://www.wcrp-climate.org/lha-overview'),
  ('epesc', 'EPESC',             'Explaining and Predicting Earth System Change',    'lighthouse', true, '#8b5cf6', 'https://www.wcrp-climate.org/lha-overview', 'https://www.wcrp-climate.org/lha-overview'),
  ('gpex',  'GPEX',              'Global Precipitation EXperiment',                 'lighthouse', true, '#06b6d4', 'https://www.wcrp-climate.org/lha-overview', 'https://www.wcrp-climate.org/lha-overview'),
  ('mcr',   'My Climate Risk',   'My Climate Risk',                                 'lighthouse', true, '#f59e0b', 'https://www.wcrp-climate.org/lha-overview', 'https://www.wcrp-climate.org/lha-overview'),
  ('rci',   'RCI',               'Research on Climate Intervention',                'lighthouse', true, '#ef4444', 'https://www.wcrp-climate.org/lha-overview', 'https://www.wcrp-climate.org/lha-overview'),
  ('slc',   'Safe Landing Climates', 'Safe Landing Climates',                       'lighthouse', true, '#10b981', 'https://www.wcrp-climate.org/lha-overview', 'https://www.wcrp-climate.org/lha-overview')
ON CONFLICT (id) DO NOTHING;

-- Add approval_status to events (null = IPO event, always visible; pending/approved = lighthouse flow)
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT NULL
  CHECK (approval_status IN ('pending', 'approved'));
