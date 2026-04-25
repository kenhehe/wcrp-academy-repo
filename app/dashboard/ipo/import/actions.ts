'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface MappedRow {
  title: string
  start_date: string
  end_date?: string
  status?: string
  location?: string
  country?: string
  url?: string
  source?: string
  extra_fields?: Record<string, string>
}

export interface ImportResult {
  inserted: number
  updated: number
  errors: string[]
}

export async function importEvents(rows: MappedRow[]): Promise<ImportResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const orgId = user.app_metadata?.org_id as string
  if (!orgId) throw new Error('No org_id in session')

  // Fetch existing events matching any of the imported titles (batch lookup)
  const titles = [...new Set(rows.map(r => r.title))]
  const { data: existing } = await supabase
    .from('events')
    .select('id,title,start_date')
    .eq('ipo_id', orgId)
    .in('title', titles)

  const existingMap = new Map(
    (existing ?? []).map(e => [`${e.title}||${e.start_date}`, e.id])
  )

  const toInsert: typeof rows = []
  const toUpdate: Array<MappedRow & { id: string }> = []

  for (const row of rows) {
    const key = `${row.title}||${row.start_date}`
    const existingId = existingMap.get(key)
    if (existingId) {
      toUpdate.push({ ...row, id: existingId })
    } else {
      toInsert.push(row)
    }
  }

  const errors: string[] = []
  let inserted = 0
  let updated = 0

  if (toInsert.length > 0) {
    const { error, count } = await supabase
      .from('events')
      .insert(
        toInsert.map(r => ({
          ipo_id: orgId,
          title: r.title,
          start_date: r.start_date,
          end_date: r.end_date ?? null,
          status: r.status ?? 'Upcoming',
          location: r.location ?? null,
          country: r.country ?? null,
          url: r.url ?? null,
          source: r.source ?? 'import',
          extra_fields: r.extra_fields ?? {},
        })),
        { count: 'exact' }
      )
    if (error) errors.push(`Insert failed: ${error.message}`)
    else inserted = count ?? toInsert.length
  }

  for (const row of toUpdate) {
    const { error } = await supabase
      .from('events')
      .update({
        end_date: row.end_date ?? null,
        status: row.status ?? 'Upcoming',
        location: row.location ?? null,
        country: row.country ?? null,
        url: row.url ?? null,
        extra_fields: row.extra_fields ?? {},
        last_seen_at: new Date().toISOString(),
      })
      .eq('id', row.id)
      .eq('ipo_id', orgId)
    if (error) errors.push(`Update ${row.title}: ${error.message}`)
    else updated++
  }

  // Merge new extra field keys + values into ipo_field_registry
  const extraKeysMap = new Map<string, Set<string>>()
  for (const r of rows) {
    for (const [k, v] of Object.entries(r.extra_fields ?? {})) {
      if (!extraKeysMap.has(k)) extraKeysMap.set(k, new Set())
      if (v) extraKeysMap.get(k)!.add(v)
    }
  }

  for (const [fieldKey, vals] of extraKeysMap) {
    const { data: reg } = await supabase
      .from('ipo_field_registry')
      .select('values')
      .eq('ipo_id', orgId)
      .eq('field_key', fieldKey)
      .single()

    const merged = [...new Set([...(reg?.values ?? []), ...vals])]

    await supabase
      .from('ipo_field_registry')
      .upsert(
        { ipo_id: orgId, field_key: fieldKey, label: fieldKey, values: merged },
        { onConflict: 'ipo_id,field_key' }
      )
  }

  revalidatePath('/dashboard/ipo/events')
  return { inserted, updated, errors }
}

export interface ExportFilters {
  status?: string
  year?: number
}

export async function getExportData(filters: ExportFilters = {}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const orgId = user.app_metadata?.org_id as string

  let query = supabase
    .from('events')
    .select('title,start_date,end_date,status,location,country,url,source,extra_fields')
    .eq('ipo_id', orgId)
    .order('start_date', { ascending: false })

  if (filters.status) query = query.eq('status', filters.status)
  if (filters.year)   query = query.eq('year', filters.year)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getExportYears(): Promise<number[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const orgId = user.app_metadata?.org_id as string

  const { data } = await supabase
    .from('events')
    .select('year')
    .eq('ipo_id', orgId)
    .order('year', { ascending: false })

  return [...new Set((data ?? []).map(r => r.year).filter(Boolean))] as number[]
}
