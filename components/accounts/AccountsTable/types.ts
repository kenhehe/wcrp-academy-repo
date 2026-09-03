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
  { value: 'de',     label: 'DE',    group: 'Lighthouse' },
  { value: 'epesc',  label: 'EPESC', group: 'Lighthouse' },
  { value: 'gpex',   label: 'GPEX',  group: 'Lighthouse' },
  { value: 'mcr',    label: 'MCR',   group: 'Lighthouse' },
  { value: 'rci',    label: 'RCI',   group: 'Lighthouse' },
  { value: 'slc',    label: 'SLC',   group: 'Lighthouse' },
] as const
