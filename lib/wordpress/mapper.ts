import type { WpCatalogueItem } from './client'

const STATUS_MAP: Record<string, string> = {
  upcoming_training:  'Upcoming training',
  ongoing_training:   'Ongoing training',
  on_going_training:  'Ongoing training',
  past_training:      'Past training',
  on_demand_training: 'On Demand',
  on_demand:          'On Demand',
}

const TRAINING_MAP: Record<string, string> = {
  conference:       'Conference',
  mooc:             'MOOC',
  science_meetings: 'Science meetings',
  seasonal_school:  'Seasonal school',
  short_course:     'Short course',
  webinar:          'Webinar',
  workshop:         'Workshop',
}

const DELIVERY_MAP: Record<string, string> = {
  in_person: 'In person',
  online:    'Online',
  hybrid:    'Hybrid',
}

function slug(s: unknown): string {
  return String(s ?? '').toLowerCase().trim()
}

function mapSlug(s: unknown, map: Record<string, string>): string | null {
  const key = slug(s).replace(/[\s-]/g, '_')
  return map[key] ?? map[slug(s)] ?? (String(s ?? '') || null)
}

function parseDate(s: unknown): string | null {
  const str = String(s ?? '').trim()
  if (!str) return null
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str
  const d = new Date(str)
  return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0]
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').trim()
}

export interface MappedCatalogue {
  id:                string
  title:             string
  status:            string | null
  start_date:        string | null
  end_date:          string | null
  publish_date:      string | null
  lead_organizer:    string | null
  partner_organizer: string | null
  categories:        string | null
  training_type:     string | null
  delivery_mode:     string | null
  location:          string | null
  languages:         string | null
  target_audience:   string | null
  level:             string | null
  official_link:     string | null
  permalink:         string | null
  contact_person:    string | null
  contact_email:     string | null
  description:       string | null
  modified:          string
}

export function mapWpItem(item: WpCatalogueItem): MappedCatalogue {
  const acf = item.acf ?? {}
  return {
    id:                String(item.id),
    title:             stripHtml(item.title?.rendered ?? ''),
    status:            mapSlug(acf.event_status, STATUS_MAP),
    start_date:        parseDate(acf.event_start_date),
    end_date:          parseDate(acf.event_end_date),
    publish_date:      parseDate(acf.publication_date),
    lead_organizer:    String(acf.corresponding_organizer ?? '') || null,
    partner_organizer: String(acf.partner_organizer       ?? '') || null,
    categories:        String(acf.event_categories        ?? '') || null,
    training_type:     mapSlug(acf.type_of_training,  TRAINING_MAP),
    delivery_mode:     mapSlug(acf.mode_of_delivery,  DELIVERY_MAP),
    location:          String(acf.event_location_platform    ?? '') || null,
    languages:         String(acf.event_language             ?? '') || null,
    target_audience:   String(acf.event_target_audience      ?? '') || null,
    level:             String(acf.event_eligibility          ?? '') || null,
    official_link:     String(acf.envet_official_link        ?? '') || null,
    permalink:         String(acf.event_application_link     ?? '') || null,
    contact_person:    String(acf.official_contact_person    ?? '') || null,
    contact_email:     String(acf.event_official_contact_email ?? '') || null,
    description:       item.content?.rendered || null,
    modified:          item.modified,
  }
}
