'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export interface AcademyMappedRow {
  academy_id?:        string
  title:              string
  description?:       string
  start_date?:        string
  end_date?:          string
  status?:            string
  training_type?:     string
  lead_organizer?:    string
  partner_organizer?: string
  categories?:        string
  delivery_mode?:     string
  location?:          string
  languages?:         string
  target_audience?:   string
  level?:             string
  cost?:              boolean
  funding_support?:   boolean
  certificate?:       boolean
  term_of_use?:       boolean
  contact_person?:    string
  official_link?:     string
  permalink?:         string
  contact_email?:     string
  catalogue_tags?:    string
  extra_fields?:      Record<string, string>
}

export interface AcademyImportResult {
  inserted: number
  updated:  number
  errors:   string[]
}

export async function importAcademyEvents(rows: AcademyMappedRow[]): Promise<AcademyImportResult> {
  // Verify identity with the user client, then write with the admin client
  // (academy_events has no write RLS policy — service role bypasses it)
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  if (user.app_metadata?.role !== 'academy_admin') throw new Error('Unauthorized')

  const supabase = createAdminClient()

  const withId    = rows.filter(r => !!r.academy_id)
  const withoutId = rows.filter(r => !r.academy_id)

  const errors: string[] = []
  let inserted = 0
  let updated  = 0

  // Rows with academy_id: upsert on the UNIQUE key
  if (withId.length > 0) {
    const { error, count } = await supabase
      .from('academy_events')
      .upsert(
        withId.map(r => ({
          academy_id:        r.academy_id,
          title:             r.title,
          description:       r.description       ?? null,
          start_date:        r.start_date         ?? null,
          end_date:          r.end_date           ?? null,
          status:            r.status             ?? null,
          training_type:     r.training_type      ?? null,
          lead_organizer:    r.lead_organizer     ?? null,
          partner_organizer: r.partner_organizer  ?? null,
          categories:        r.categories         ?? null,
          delivery_mode:     r.delivery_mode      ?? null,
          location:          r.location           ?? null,
          languages:         r.languages          ?? null,
          target_audience:   r.target_audience    ?? null,
          level:             r.level              ?? null,
          cost:              r.cost               ?? null,
          funding_support:   r.funding_support    ?? null,
          certificate:       r.certificate        ?? null,
          term_of_use:       r.term_of_use        ?? null,
          contact_person:    r.contact_person     ?? null,
          official_link:     r.official_link      ?? null,
          permalink:         r.permalink          ?? null,
          contact_email:     r.contact_email      ?? null,
          catalogue_tags:    r.catalogue_tags     ?? null,
          extra_fields:      r.extra_fields       ?? {},
          updated_at:        new Date().toISOString(),
        })),
        { onConflict: 'academy_id', count: 'exact' }
      )
    if (error) errors.push(`Upsert failed: ${error.message}`)
    else {
      // Supabase upsert returns total rows affected; we can't distinguish insert vs update
      // Use a rough heuristic: count all as inserted for now
      inserted += count ?? withId.length
    }
  }

  // Rows without academy_id: dedup by title
  if (withoutId.length > 0) {
    const titles = [...new Set(withoutId.map(r => r.title))]
    const { data: existing } = await supabase
      .from('academy_events')
      .select('id,title')
      .in('title', titles)

    const existingMap = new Map((existing ?? []).map(e => [e.title, e.id]))

    const toInsert = withoutId.filter(r => !existingMap.has(r.title))
    const toUpdate = withoutId
      .filter(r => existingMap.has(r.title))
      .map(r => ({ ...r, id: existingMap.get(r.title)! }))

    if (toInsert.length > 0) {
      const { error, count } = await supabase
        .from('academy_events')
        .insert(
          toInsert.map(r => ({
            title:             r.title,
            description:       r.description      ?? null,
            start_date:        r.start_date        ?? null,
            end_date:          r.end_date          ?? null,
            status:            r.status            ?? null,
            training_type:     r.training_type     ?? null,
            lead_organizer:    r.lead_organizer    ?? null,
            partner_organizer: r.partner_organizer ?? null,
            categories:        r.categories        ?? null,
            delivery_mode:     r.delivery_mode     ?? null,
            location:          r.location          ?? null,
            languages:         r.languages         ?? null,
            target_audience:   r.target_audience   ?? null,
            level:             r.level             ?? null,
            cost:              r.cost              ?? null,
            funding_support:   r.funding_support   ?? null,
            certificate:       r.certificate       ?? null,
            term_of_use:       r.term_of_use       ?? null,
            contact_person:    r.contact_person    ?? null,
            official_link:     r.official_link     ?? null,
            permalink:         r.permalink         ?? null,
            contact_email:     r.contact_email     ?? null,
            catalogue_tags:    r.catalogue_tags    ?? null,
            extra_fields:      r.extra_fields      ?? {},
          })),
          { count: 'exact' }
        )
      if (error) errors.push(`Insert failed: ${error.message}`)
      else inserted += count ?? toInsert.length
    }

    for (const row of toUpdate) {
      const { error } = await supabase
        .from('academy_events')
        .update({
          description:       row.description      ?? null,
          start_date:        row.start_date        ?? null,
          end_date:          row.end_date          ?? null,
          status:            row.status            ?? null,
          training_type:     row.training_type     ?? null,
          lead_organizer:    row.lead_organizer    ?? null,
          partner_organizer: row.partner_organizer ?? null,
          categories:        row.categories        ?? null,
          delivery_mode:     row.delivery_mode     ?? null,
          location:          row.location          ?? null,
          languages:         row.languages         ?? null,
          target_audience:   row.target_audience   ?? null,
          level:             row.level             ?? null,
          cost:              row.cost              ?? null,
          funding_support:   row.funding_support   ?? null,
          certificate:       row.certificate       ?? null,
          term_of_use:       row.term_of_use       ?? null,
          contact_person:    row.contact_person    ?? null,
          official_link:     row.official_link     ?? null,
          permalink:         row.permalink         ?? null,
          contact_email:     row.contact_email     ?? null,
          catalogue_tags:    row.catalogue_tags    ?? null,
          extra_fields:      row.extra_fields      ?? {},
          updated_at:        new Date().toISOString(),
        })
        .eq('id', row.id)
      if (error) errors.push(`Update "${row.title}": ${error.message}`)
      else updated++
    }
  }

  revalidatePath('/dashboard/academy/events')
  revalidatePath('/dashboard/academy')
  return { inserted, updated, errors }
}

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
