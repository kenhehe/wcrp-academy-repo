export interface EventRow {
  id:              string
  ipo_id:          string
  title:           string
  start_date:      string
  end_date:        string | null
  status:          string
  location:        string | null
  country:         string | null
  url:             string | null
  source:          string
  extra_fields:    Record<string, string> | null
  approval_status: string | null
  wants_social_media:    boolean
  wants_website_article: boolean
  wants_newsletter:      boolean
}

export interface RegistryField {
  field_key: string
  label: string | null
  values: string[] | null
}

export interface ActiveFilters {
  q?: string
  status?: string
  year?: string
  [key: string]: string | undefined
}

export const STATUS_OPTIONS = ['Upcoming', 'Ongoing', 'Past', 'Cancelled', 'Postponed'] as const
export const PAGE_SIZE = 25
