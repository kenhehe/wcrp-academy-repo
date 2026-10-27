import { cache } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildTrends, todayUtc } from './event-trends'
import { buildActivity } from './event-activity'
import type { AnalyticsOrg, ClimateAnalyticsData, LighthouseSummary } from './climate-analytics.types'

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
  const orgById = new Map(orgs.map(o => [o.id, o]))

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

  const next = rows
    .filter(e => e.status === 'Upcoming')
    .sort((a, b) => a.start_date.localeCompare(b.start_date) || a.title.localeCompare(b.title))
    .slice(0, NEXT_EVENTS)
    .map(e => ({
      id:         e.id,
      title:      e.title,
      start_date: e.start_date,
      url:        e.url,
      pending:    e.approval_status === 'pending',
      org:        orgById.get(e.ipo_id)!,
    }))

  const pending = rows.filter(e => e.approval_status === 'pending')

  const lighthouse: LighthouseSummary[] = orgs
    .filter(o => o.type === 'lighthouse')
    .map(org => ({
      org,
      total:   rows.filter(e => e.ipo_id === org.id).length,
      pending: pending.filter(e => e.ipo_id === org.id).length,
    }))
    .sort((a, b) => (b.total - a.total) || a.org.name.localeCompare(b.org.name))

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
    next,
    // Per-year and per-month counts for the Event activity chart
    activity: buildActivity(rows, orgs, today),
    lighthouse,
  }
})
