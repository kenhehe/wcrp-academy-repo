import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { CoverageRow } from './coverage.types'

const PAGE_SIZE = 1000   // PostgREST's row cap per request

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

  const breakdown = new Map<string, { upcoming: number; ongoing: number; past: number; other: number }>()
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

    for (const e of data ?? []) {
      const b = breakdown.get(e.ipo_id) ?? { upcoming: 0, ongoing: 0, past: 0, other: 0 }
      if (e.status === 'Upcoming')     b.upcoming++
      else if (e.status === 'Ongoing') b.ongoing++
      else if (e.status === 'Past')    b.past++
      else                             b.other++
      breakdown.set(e.ipo_id, b)
    }
    if ((data ?? []).length < PAGE_SIZE) break
  }

  return (coverageRes.data ?? []).map(c => ({
    ipoId:     c.ipo_id,
    name:      c.name,
    colorHex:  colors.get(c.ipo_id) ?? null,
    total:     c.total_events ?? 0,
    inAcademy: c.in_academy ?? 0,
    ...(breakdown.get(c.ipo_id) ?? { upcoming: 0, ongoing: 0, past: 0, other: 0 }),
  }))
})
