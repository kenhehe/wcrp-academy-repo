export interface RegistryOrg {
  id:        string
  name:      string
  color_hex: string | null
  type:      string
}

export interface RegistryEventRow {
  id:                     string
  ipo_id:                 string
  title:                  string
  start_date:             string
  end_date:               string | null
  status:                 string
  location:               string | null
  country:                string | null
  url:                    string | null
  approval_status:        string | null
  wants_social_media:     boolean
  wants_website_article:  boolean
  wants_newsletter:       boolean
}

export const STATUS_OPTIONS = ['Upcoming', 'Ongoing', 'Past', 'Cancelled', 'Postponed'] as const
export const PAGE_SIZE = 25
