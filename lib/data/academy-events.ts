import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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
  cost:              string | null
  certificate:       string | null
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

// Resolves the display status — On Demand can be stored explicitly or derived
// from the pattern: no dates + has publish_date
export function resolveStatus(row: Pick<AcademyEventRow, 'status' | 'start_date' | 'end_date' | 'publish_date'>): string {
  if (row.status === 'On Demand') return 'On Demand'
  if (!row.start_date && !row.end_date && row.publish_date) return 'On Demand'
  return row.status ?? '—'
}

export async function listAcademyEvents(filters: AcademyEventFilters = {}) {
  const supabase = await createClient()
  const page     = Math.max(1, filters.page ?? 1)
  const pageSize = filters.pageSize ?? CATALOGUE_PAGE_SIZE

  let query = supabase
    .from('academy_events')
    .select(
      'id,academy_id,title,start_date,end_date,publish_date,status,training_type,lead_organizer,is_external,official_link,extra_fields',
      { count: 'exact' }
    )
    .order('start_date', { ascending: false, nullsFirst: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (filters.search) query = query.ilike('title', `%${filters.search}%`)

  if (filters.status === 'On Demand') {
    query = query.is('start_date', null).is('end_date', null).not('publish_date', 'is', null)
  } else if (filters.status) {
    query = query.eq('status', filters.status)
  }

  return query
}

export async function getAcademyEvent(id: string) {
  const supabase = await createClient()
  return supabase
    .from('academy_events')
    .select('*')
    .eq('id', id)
    .single()
}

export async function createAcademyEvent(data: Partial<AcademyEventInput>) {
  const supabase = createAdminClient()
  return supabase
    .from('academy_events')
    .insert({ ...data, updated_at: new Date().toISOString() })
    .select('id')
    .single()
}

export async function updateAcademyEvent(id: string, data: Partial<AcademyEventInput>) {
  const supabase = createAdminClient()
  return supabase
    .from('academy_events')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id')
    .single()
}

export async function deleteAcademyEvent(id: string) {
  const supabase = createAdminClient()
  return supabase
    .from('academy_events')
    .delete()
    .eq('id', id)
}
