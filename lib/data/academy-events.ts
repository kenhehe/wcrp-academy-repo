import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { CATALOGUE_PAGE_SIZE, type AcademyEventInput, type AcademyEventFilters } from './academy-events.types'

export * from './academy-events.types'

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
