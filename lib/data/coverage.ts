import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAcademyAdmin } from '@/lib/auth/guards'
import { must } from '@/lib/supabase/must'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import type { CoverageRow } from './coverage.types'

const PAGE_SIZE = 1000   // PostgREST's row cap per request

type Missing = Pick<CoverageRow, 'upcoming' | 'ongoing' | 'past' | 'other'>

const noneMissing = (): Missing => ({ upcoming: 0, ongoing: 0, past: 0, other: 0 })

// Adds one missing event to its organisation's split by status
function countMissing(breakdown: Map<string, Missing>, ipoId: string, status: string | null) {
  const b = breakdown.get(ipoId) ?? noneMissing()
  if (status === 'Upcoming')     b.upcoming++
  else if (status === 'Ongoing') b.ongoing++
  else if (status === 'Past')    b.past++
  else                           b.other++
  breakdown.set(ipoId, b)
}

// Academy coverage per IPO: totals from the ipo_coverage_stats view, plus the
// missing (not in Academy, not a confirmed duplicate) events split by status.
export const getCoverageRows = cache(async (): Promise<CoverageRow[]> => {
  const supabase = await createClient()

  const [iposRes, coverageRes] = await Promise.all([
    supabase.from('ipos').select('id,color_hex').eq('type', 'ipo'),
    supabase.from('ipo_coverage_stats').select('ipo_id,name,total_events,in_academy'),
  ])
  if (iposRes.error)     throw new Error(`ipos query failed: ${iposRes.error.message}`)
  if (coverageRes.error) throw new Error(`ipo_coverage_stats query failed: ${coverageRes.error.message}`)

  const ipoIds = (iposRes.data ?? []).map(i => i.id)
  const colors = new Map((iposRes.data ?? []).map(i => [i.id, i.color_hex as string | null]))

  const breakdown = new Map<string, Missing>()
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('events')
      .select('ipo_id,status')
      .eq('in_academy', false)
      .is('duplicate_of_event_id', null)
      .in('ipo_id', ipoIds)
      .order('id')
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(`missing events query failed: ${error.message}`)

    for (const e of data ?? []) countMissing(breakdown, e.ipo_id, e.status)
    if ((data ?? []).length < PAGE_SIZE) break
  }

  return (coverageRes.data ?? []).map(c => ({
    ipoId:     c.ipo_id,
    name:      c.name,
    colorHex:  colors.get(c.ipo_id) ?? null,
    total:     c.total_events ?? 0,
    inAcademy: c.in_academy ?? 0,
    ...(breakdown.get(c.ipo_id) ?? noneMissing()),
  }))
})

// The same counts for each Lighthouse programme (Academy overview). ipo_coverage_stats leaves
// Lighthouse out on purpose, so these come from the events table, counted the way the view
// counts: every event in the total, confirmed duplicates left out of the missing split. Read
// with the service role after the Academy admin check, as Event Registry does.
export const getLighthouseCoverageRows = cache(async (): Promise<CoverageRow[]> => {
  await requireAcademyAdmin()
  const db = createAdminClient()

  const orgs = must('lighthouse orgs query', await db
    .from('ipos').select('id,name,color_hex').eq('type', 'lighthouse').order('name')) ?? []
  const events = await fetchAllRows<{ ipo_id: string; status: string | null; in_academy: boolean; duplicate_of_event_id: string | null }>(
    'lighthouse events query',
    (from, to) => db.from('events')
      .select('ipo_id,status,in_academy,duplicate_of_event_id')
      .in('ipo_id', orgs.map(o => o.id))
      .order('id')
      .range(from, to),
  )

  const totals    = new Map<string, { total: number; inAcademy: number }>()
  const breakdown = new Map<string, Missing>()
  for (const e of events) {
    const t = totals.get(e.ipo_id) ?? { total: 0, inAcademy: 0 }
    t.total++
    if (e.in_academy) t.inAcademy++
    totals.set(e.ipo_id, t)
    if (!e.in_academy && !e.duplicate_of_event_id) countMissing(breakdown, e.ipo_id, e.status)
  }

  return orgs.map(o => ({
    ipoId:     o.id,
    name:      o.name,
    colorHex:  o.color_hex,
    ...(totals.get(o.id) ?? { total: 0, inAcademy: 0 }),
    ...(breakdown.get(o.id) ?? noneMissing()),
  }))
})
