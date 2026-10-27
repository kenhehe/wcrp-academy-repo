import { cache } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildTrends, todayUtc } from './event-trends'
import { buildActivity, nextUpcoming, summariseLighthouse } from './event-activity'
import type { AnalyticsOrg, ClimateAnalyticsData } from './climate-analytics.types'

const PAGE_SIZE   = 1000   // PostgREST's row cap per request
const NEXT_EVENTS = 6

interface EventRow {
  id:              string
  ipo_id:          string
  title:           string
  start_date:      string | null
  status:          string
  approval_status: string | null
  url:             string | null
}

// Cross-org view for can_approve accounts: every IPO and Lighthouse event, so it reads
// with the service role (a plain org session's RLS only sees its own org).
export const getClimateAnalytics = cache(async (): Promise<ClimateAnalyticsData> => {
  const db = createAdminClient()

  const { data: orgRows, error: orgError } = await db
    .from('ipos').select('id,name,full_name,color_hex,type').in('type', ['ipo', 'lighthouse']).order('name')
  if (orgError) throw new Error(`ipos query failed: ${orgError.message}`)

  const orgs: AnalyticsOrg[] = (orgRows ?? []).map(o => ({ id: o.id, name: o.name, fullName: o.full_name, color: o.color_hex, type: o.type }))

  const events: EventRow[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await db
      .from('events')
      .select('id,ipo_id,title,start_date,status,approval_status,url')
      .in('ipo_id', orgs.map(o => o.id))
      .order('id')
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(`events query failed: ${error.message}`)
    events.push(...(data ?? []))
    if ((data ?? []).length < PAGE_SIZE) break
  }

  const rows = events.map(e => {
    if (!e.start_date) throw new Error(`event ${e.id} has no start_date`)
    return { ...e, start_date: e.start_date }
  })

  const today = todayUtc()
  const pending = rows.filter(e => e.approval_status === 'pending')

  const lighthouseIds = new Set(orgs.filter(o => o.type === 'lighthouse').map(o => o.id))
  const lighthouseEvents = rows.filter(e => lighthouseIds.has(e.ipo_id)).length

  return {
    totals: {
      events:         rows.length,
      ipo:            rows.length - lighthouseEvents,
      lighthouse:     lighthouseEvents,
      ipoOrgs:        orgs.filter(o => o.type === 'ipo').length,
      lighthouseOrgs: lighthouseIds.size,
    },
    trends:   buildTrends(rows, today),
    awaiting: {
      total:    pending.length,
      upcoming: pending.filter(e => e.status !== 'Past').length,
      past:     pending.filter(e => e.status === 'Past').length,
    },
    next:     nextUpcoming(rows, orgs, NEXT_EVENTS),
    // Per-year and per-month counts for the Event activity chart
    activity: buildActivity(rows, orgs, today),
    lighthouse: summariseLighthouse(rows, orgs),
  }
})
