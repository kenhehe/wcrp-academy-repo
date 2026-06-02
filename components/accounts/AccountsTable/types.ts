export interface IPOUser {
  id: string
  email: string
  org_id: string
  created_at: string
  source_type?:  string
  source_label?: string
  source_url?:   string
}

export const IPO_OPTIONS = [
  { value: 'cmip',   label: 'CMIP' },
  { value: 'clivar', label: 'CLIVAR' },
  { value: 'esmo',   label: 'ESMO' },
  { value: 'rifs',   label: 'RIfS' },
  { value: 'cordex', label: 'CORDEX' },
  { value: 'clic',   label: 'CliC' },
  { value: 'gewex',  label: 'GEWEX' },
] as const
