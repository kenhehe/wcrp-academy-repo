// Loaders for the Academy overview (app/dashboard/academy/page.tsx). Each section of the page
// awaits one of these inside its own Suspense boundary; cache() shares a read (the organisations,
// every event, the survey list) between sections within one request. Types and pure helpers are
// in academy-overview.types.ts.
//
// Reads that take in the Lighthouse programmes use the service role after the Academy admin
// check, as Event Registry does: the Academy session is only relied on for IPO data.
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAcademyAdmin } from '@/lib/auth/guards'
import { must } from '@/lib/supabase/must'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { resolveStatus } from './academy-events.types'
import { buildActivity, nextUpcoming, summariseLighthouse, type EventSummaryRow } from './event-activity'
import { DUPLICATE_THRESHOLD } from './event-duplicates'
import { todayUtc } from './event-trends'
import { getHealthOverview } from './health'
import { getSurveyList } from './surveys'
import {
  countCatalogue, monthsAhead, splitSurveys,
  type AttentionAlert, type CatalogueSummary, type OverviewOrg, type OverviewSurveys, type UpcomingGaps,
} from './academy-overview.types'
import type { ActivityData, LighthouseSummary, UpcomingEvent } from './climate-analytics.types'

const NEXT_GAPS   = 5
const NEXT_EVENTS = 6
export const DUPLICATE_CAP = 100   // the overview shows '100+' beyond this

// The 7 IPOs and the Lighthouse programmes (never the Secretariat), each with its type
const getOverviewOrgs = cache(async (): Promise<OverviewOrg[]> => {
  await requireAcademyAdmin()
  const rows = must('ipos query', await createAdminClient()
    .from('ipos').select('id,name,full_name,color_hex,type').in('type', ['ipo', 'lighthouse']).order('name'))
  return (rows ?? []).map(o => ({ id: o.id, name: o.name, fullName: o.full_name, color: o.color_hex, type: o.type }))
})

// Every IPO and Lighthouse event (confirmed duplicates counted once), shared by Event activity,
// Coming up and the Lighthouse card
const getOverviewEvents = cache(async (): Promise<EventSummaryRow[]> => {
  const orgs = await getOverviewOrgs()   // checks for an Academy admin first
  const db = createAdminClient()
  const rows = await fetchAllRows<Omit<EventSummaryRow, 'start_date'> & { start_date: string | null }>(
    'events query',
    (from, to) => db.from('events')
      .select('id,ipo_id,title,start_date,status,approval_status,url,in_academy')
      .in('ipo_id', orgs.map(o => o.id))
      .is('duplicate_of_event_id', null)
      .order('id')
      .range(from, to),
  )
  return rows.map(e => {
    if (!e.start_date) throw new Error(`event ${e.id} of ${e.ipo_id} has no start_date`)
    return { ...e, start_date: e.start_date }
  })
})

// Upcoming events not in the Academy (confirmed duplicates counted once): the soonest few, IPO
// and Lighthouse, plus the IPO count per month for the next year and the Lighthouse count apart
export const getUpcomingGaps = cache(async (): Promise<UpcomingGaps> => {
  const orgs = await getOverviewOrgs()   // checks for an Academy admin first
  const byId = new Map(orgs.map(o => [o.id, o]))
  const db = createAdminClient()
  const rows = await fetchAllRows<{ id: string; ipo_id: string; title: string; start_date: string; end_date: string | null; url: string | null; location: string | null }>(
    'upcoming gaps query',
    (from, to) => db.from('events')
      .select('id,ipo_id,title,start_date,end_date,url,location')
      .in('ipo_id', orgs.map(o => o.id))
      .eq('status', 'Upcoming')
      .eq('in_academy', false)
      .is('duplicate_of_event_id', null)
      .order('start_date').order('id')
      .range(from, to),
  )
  const gaps = rows.map(({ ipo_id, ...e }) => {
    const org = byId.get(ipo_id)
    if (!org) throw new Error(`event ${e.id} belongs to unknown organisation ${ipo_id}`)
    return { ...e, org }
  })
  const ipo = gaps.filter(e => e.org.type === 'ipo')
  return {
    total:      ipo.length,
    lighthouse: gaps.length - ipo.length,
    next:       gaps.slice(0, NEXT_GAPS),
    byMonth:    monthsAhead(ipo.map(e => e.start_date), todayUtc()),
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

// IPO and Lighthouse events per year and month, with the Academy's share, for Event activity
export const getAcademyActivity = cache(async (): Promise<{ data: ActivityData; total: number }> => {
  const [orgs, rows] = await Promise.all([getOverviewOrgs(), getOverviewEvents()])
  return { data: buildActivity(rows, orgs, todayUtc(), true), total: rows.length }
})

// The next upcoming events, IPO and Lighthouse, each saying whether it's in the Academy
export const getAcademyComingUp = cache(async (): Promise<{ next: UpcomingEvent[]; upcoming: number }> => {
  const [orgs, rows] = await Promise.all([getOverviewOrgs(), getOverviewEvents()])
  return {
    next:     nextUpcoming(rows, orgs, NEXT_EVENTS, true),
    upcoming: rows.filter(e => e.status === 'Upcoming').length,
  }
})

// Each Lighthouse programme's events, pending approvals and events in the Academy
export const getAcademyLighthouse = cache(async (): Promise<LighthouseSummary[]> => {
  const [orgs, rows] = await Promise.all([getOverviewOrgs(), getOverviewEvents()])
  return summariseLighthouse(rows, orgs, true)
})
