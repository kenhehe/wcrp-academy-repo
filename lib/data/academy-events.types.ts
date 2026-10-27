import { resolveAcademyDates, utcToday } from '@/supabase/functions/_shared/academy-dates'

export const CATALOGUE_PAGE_SIZE = 25

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

// Worked out again from the dates on every read (the rule in
// supabase/functions/_shared/academy-dates.ts), so a status stays right between daily syncs
export function resolveStatus(row: Pick<AcademyEventRow, 'status' | 'start_date' | 'end_date' | 'publish_date'>, today = utcToday()): string {
  const { status } = resolveAcademyDates({ tag: row.status, start: row.start_date, end: row.end_date, publish: row.publish_date }, today)
  return status ?? row.status ?? '—'
}
