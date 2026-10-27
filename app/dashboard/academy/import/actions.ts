'use server'

// Export only: Academy events are edited on WordPress and arrive through the sync
import { createClient } from '@/lib/supabase/server'

export interface AcademyExportFilters {
  status?:        string
  training_type?: string
  year?:          number
}

export interface AcademyExportRow {
  academy_id?:        string | null
  title:              string
  start_date?:        string | null
  end_date?:          string | null
  status?:            string | null
  training_type?:     string | null
  lead_organizer?:    string | null
  partner_organizer?: string | null
  categories?:        string | null
  delivery_mode?:     string | null
  location?:          string | null
  languages?:         string | null
  target_audience?:   string | null
  level?:             string | null
  cost?:              string | null
  certificate?:       string | null
  official_link?:     string | null
  permalink?:         string | null
  contact_email?:     string | null
  catalogue_tags?:    string | null
}

export async function getAcademyExportData(filters: AcademyExportFilters = {}): Promise<AcademyExportRow[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  if (user.app_metadata?.role !== 'academy_admin') throw new Error('Unauthorized')

  let query = supabase
    .from('academy_events')
    .select(
      'academy_id,title,start_date,end_date,status,training_type,lead_organizer,partner_organizer,' +
      'categories,delivery_mode,location,languages,target_audience,level,cost,certificate,' +
      'official_link,permalink,contact_email,catalogue_tags'
    )
    .order('start_date', { ascending: false })

  if (filters.status)        query = query.eq('status', filters.status)
  if (filters.training_type) query = query.eq('training_type', filters.training_type)
  if (filters.year) {
    query = query
      .gte('start_date', `${filters.year}-01-01`)
      .lte('start_date', `${filters.year}-12-31`)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as AcademyExportRow[]
}
