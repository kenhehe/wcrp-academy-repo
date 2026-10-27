// Loaders for the Academy overview (app/dashboard/academy/page.tsx). Each section of the page
// awaits one of these inside its own Suspense boundary; cache() shares a read (the IPO list,
// the survey list) between sections within one request. Types and pure helpers are in
// academy-overview.types.ts.
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAcademyAdmin } from '@/lib/auth/guards'
import { must } from '@/lib/supabase/must'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { resolveStatus } from './academy-events.types'
import { buildActivity } from './event-activity'
import { DUPLICATE_THRESHOLD } from './event-duplicates'
import { todayUtc } from './event-trends'
import { getHealthOverview } from './health'
import { getSurveyList } from './surveys'
import {
  countCatalogue, monthsAhead, splitSurveys,
  type AttentionAlert, type CatalogueSummary, type OverviewOrg, type OverviewSurveys, type UpcomingGaps,
} from './academy-overview.types'
import type { ActivityData } from './climate-analytics.types'

const NEXT_GAPS = 5
export const DUPLICATE_CAP = 100   // the overview shows '100+' beyond this

// The 7 IPOs (type 'ipo' only: coverage is about the IPOs, not Lighthouse or the Secretariat)
const getIpoOrgs = cache(async (): Promise<OverviewOrg[]> => {
  const supabase = await createClient()
  const rows = must('ipos query', await supabase.from('ipos').select('id,name,full_name,color_hex').eq('type', 'ipo').order('name'))
  return (rows ?? []).map(o => ({ id: o.id, name: o.name, fullName: o.full_name, color: o.color_hex }))
})

// Upcoming IPO events not in the Academy (confirmed duplicates counted once): the soonest few
// and a count per month for the next year
export const getUpcomingGaps = cache(async (): Promise<UpcomingGaps> => {
  const supabase = await createClient()
  const orgs = await getIpoOrgs()
  const byId = new Map(orgs.map(o => [o.id, o]))
  const rows = await fetchAllRows<{ id: string; ipo_id: string; title: string; start_date: string; end_date: string | null; url: string | null; location: string | null }>(
    'upcoming gaps query',
    (from, to) => supabase.from('events')
      .select('id,ipo_id,title,start_date,end_date,url,location')
      .in('ipo_id', orgs.map(o => o.id))
      .eq('status', 'Upcoming')
      .eq('in_academy', false)
      .is('duplicate_of_event_id', null)
      .order('start_date').order('id')
      .range(from, to),
  )
  return {
    total:   rows.length,
    next:    rows.slice(0, NEXT_GAPS).map(({ ipo_id, ...e }) => {
      const org = byId.get(ipo_id)
      if (!org) throw new Error(`event ${e.id} belongs to unknown IPO ${ipo_id}`)
      return { ...e, org }
    }),
    byMonth: monthsAhead(rows.map(e => e.start_date), todayUtc()),
  }
})

// The Academy catalogue by status, worked out from the dates as everywhere else
export const getCatalogueSummary = cache(async (): Promise<CatalogueSummary> => {
  const supabase = await createClient()
  const rows = await fetchAllRows<{ status: string | null; start_date: string | null; end_date: string | null; publish_date: string | null }>(
    'catalogue status query',
    (from, to) => supabase.from('academy_events').select('status,start_date,end_date,publish_date').order('id').range(from, to),
  )
  const today = todayUtc()
  return countCatalogue(rows.map(row => resolveStatus(row, today)))
})

// When any scraper last started a run
export const getLastScrape = cache(async (): Promise<string | null> => {
  const supabase = await createClient()
  const row = must('latest scrape run query', await supabase
    .from('scrape_runs').select('started_at').order('started_at', { ascending: false }).limit(1).maybeSingle())
  return row?.started_at ?? null
})

// Scrapers that need a look (System Health's own rule) and duplicate pairs waiting for review.
// Duplicates are only counted and linked to: reviewing them stays on the Duplicates page.
export const getAttention = cache(async (): Promise<AttentionAlert[]> => {
  await requireAcademyAdmin()
  const db = createAdminClient()
  const [health, pairsRes] = await Promise.all([
    getHealthOverview(),
    db.rpc('find_cross_ipo_duplicate_pairs', {
      threshold:     DUPLICATE_THRESHOLD,
      p_ipo_id:      null,
      result_limit:  DUPLICATE_CAP + 1,
      result_offset: 0,
    }),
  ])
  const pairs = (must('duplicate pairs query', pairsRes) ?? []) as unknown[]

  // Failing runs are red; runs that start but never finish (System Health links those to
  // ?result=unfinished) or a scraper that stopped running are amber
  const alerts: AttentionAlert[] = health.attention.map(item => ({
    key:       `scraper-${item.ipo.id}`,
    tone:      item.href?.includes('result=failed') ? 'danger' : 'warning',
    title:     `${item.ipo.name} scraper needs attention`,
    message:   item.message,
    href:      `/dashboard/academy/health${item.href ?? ''}`,
    linkLabel: 'Open System Health',
  }))
  if (pairs.length > 0) {
    alerts.push({
      key:       'duplicates',
      tone:      'info',
      title:     pairs.length > DUPLICATE_CAP ? `${DUPLICATE_CAP}+ possible duplicate pairs` : `${pairs.length} possible duplicate ${pairs.length === 1 ? 'pair' : 'pairs'}`,
      message:   'Events that two IPOs may both list, waiting for review.',
      href:      '/dashboard/academy/duplicates',
      linkLabel: 'Open Duplicates',
    })
  }
  return alerts
})

export const getOverviewSurveys = cache(async (): Promise<OverviewSurveys> => splitSurveys(await getSurveyList()))

// IPO events per year and month, with the Academy's share, for the Event activity chart
export const getAcademyActivity = cache(async (): Promise<{ data: ActivityData; total: number }> => {
  const supabase = await createClient()
  const orgs = await getIpoOrgs()
  const rows = await fetchAllRows<{ ipo_id: string; start_date: string | null; status: string | null; in_academy: boolean }>(
    'IPO events query',
    (from, to) => supabase.from('events')
      .select('ipo_id,start_date,status,in_academy')
      .in('ipo_id', orgs.map(o => o.id))
      .is('duplicate_of_event_id', null)
      .order('id')
      .range(from, to),
  )
  const dated = rows.map(e => {
    if (!e.start_date) throw new Error(`an IPO event of ${e.ipo_id} has no start_date`)
    return { ...e, start_date: e.start_date }
  })
  const analyticsOrgs = orgs.map(o => ({ ...o, type: 'ipo' as const }))
  return { data: buildActivity(dated, analyticsOrgs, todayUtc(), true), total: dated.length }
})
