export interface IPOUser {
  id: string
  email: string
  org_id: string
  org_label: string
  org_group: 'IPO' | 'Lighthouse'
  created_at: string
  source_type?:  string
  source_label?: string
  source_url?:   string
}

export const IPO_OPTIONS = [
  { value: 'cmip',   label: 'CMIP',   group: 'IPO' },
  { value: 'clivar', label: 'CLIVAR', group: 'IPO' },
  { value: 'esmo',   label: 'ESMO',   group: 'IPO' },
  { value: 'rifs',   label: 'RIfS',   group: 'IPO' },
  { value: 'cordex', label: 'CORDEX', group: 'IPO' },
  { value: 'clic',   label: 'CliC',   group: 'IPO' },
  { value: 'gewex',  label: 'GEWEX',  group: 'IPO' },
  { value: 'wcrp',   label: 'WCRP',   group: 'IPO' },
  { value: 'de',     label: 'Digital Earths',                              group: 'Lighthouse' },
  { value: 'epesc',  label: 'EPESC — Explaining & Predicting ESC',         group: 'Lighthouse' },
  { value: 'gpex',   label: 'GPEX — Global Precipitation EXperiment',      group: 'Lighthouse' },
  { value: 'mcr',    label: 'My Climate Risk',                             group: 'Lighthouse' },
  { value: 'rci',    label: 'RCI — Research on Climate Intervention',      group: 'Lighthouse' },
  { value: 'slc',    label: 'Safe Landing Climates',                       group: 'Lighthouse' },
] as const
