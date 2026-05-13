export const CATALOGUE_PAGE_SIZE = 25

export const ACADEMY_STATUS_OPTIONS = [
  'Upcoming training',
  'Ongoing training',
  'Past training',
  'On Demand',
] as const

export interface AcademyEventRow {
  id:                string
  academy_id:        string | null
  title:             string
  description:       string | null
  start_date:        string | null
  end_date:          string | null
  publish_date:      string | null
  status:            string | null
  training_type:     string | null
  lead_organizer:    string | null
  partner_organizer: string | null
  categories:        string | null
  delivery_mode:     string | null
  location:          string | null
  languages:         string | null
  target_audience:   string | null
  level:             string | null
  cost:              boolean | null
  funding_support:   boolean | null
  certificate:       boolean | null
  term_of_use:       boolean | null
  contact_person:    string | null
  official_link:     string | null
  permalink:         string | null
  contact_email:     string | null
  catalogue_tags:    string | null
  is_external:       boolean
  extra_fields:      Record<string, string>
  updated_at:        string | null
}

export type AcademyEventInput = Omit<AcademyEventRow, 'id' | 'updated_at'>

export interface AcademyEventFilters {
  search?:   string
  status?:   string
  page?:     number
  pageSize?: number
}

export function resolveStatus(row: Pick<AcademyEventRow, 'status' | 'start_date' | 'end_date' | 'publish_date'>): string {
  if (row.status === 'On Demand') return 'On Demand'
  if (!row.start_date && !row.end_date && row.publish_date) return 'On Demand'
  return row.status ?? '—'
}
