// Pure: the counts behind the event sections Climate Analytics and the Academy overview share:
// the Event activity chart (components/charts/EventActivity), Coming up
// (components/events/ComingUp) and the Lighthouse card (components/events/LighthouseSummary).
import type { ActivityData, AnalyticsOrg, LighthouseSummary, UpcomingEvent } from './climate-analytics.types'

export interface ActivityRow {
  ipo_id:      string
  start_date:  string            // 'YYYY-MM-DD'; events count by the year and month they start
  status:      string | null
  in_academy?: boolean
}

export interface EventSummaryRow extends ActivityRow {
  id:              string
  title:           string
  approval_status: string | null
  url:             string | null
}

// `today` ('YYYY-MM-DD', UTC) sets the current year, which is always on the axis. With
// `withAcademy`, the rows' in_academy flags also give data.inAcademy.
export function buildActivity(rows: ActivityRow[], orgs: AnalyticsOrg[], today: string, withAcademy = false): ActivityData {
  const currentYear = Number(today.slice(0, 4))
  const byYear: Record<number, Record<string, number>> = {}
  const byYearMonth: Record<number, number[]> = {}
  const upcomingByYear: Record<number, number> = {}
  const academyByYear: Record<number, number> = {}
  const academyByYearMonth: Record<number, number[]> = {}

  for (const e of rows) {
    const year  = Number(e.start_date.slice(0, 4))
    const month = Number(e.start_date.slice(5, 7)) - 1
    byYear[year] ??= {}
    byYear[year][e.ipo_id] = (byYear[year][e.ipo_id] ?? 0) + 1
    byYearMonth[year] ??= Array(12).fill(0)
    byYearMonth[year][month]++
    if (e.status === 'Upcoming') upcomingByYear[year] = (upcomingByYear[year] ?? 0) + 1
    if (withAcademy && e.in_academy) {
      academyByYear[year] = (academyByYear[year] ?? 0) + 1
      academyByYearMonth[year] ??= Array(12).fill(0)
      academyByYearMonth[year][month]++
    }
  }

  const yearsWithEvents = Object.keys(byYear).map(Number)
  const firstYear = Math.min(...yearsWithEvents, currentYear)
  const lastYear  = Math.max(...yearsWithEvents, currentYear)
  const years = Array.from({ length: lastYear - firstYear + 1 }, (_, i) => firstYear + i)

  return {
    currentYear, years, byYear, byYearMonth, upcomingByYear, orgs,
    ...(withAcademy ? { inAcademy: { byYear: academyByYear, byYearMonth: academyByYearMonth } } : {}),
  }
}

// The next `count` upcoming events, soonest first, for Coming up. With `withAcademy`, each
// also says whether it's in the Academy.
export function nextUpcoming(rows: EventSummaryRow[], orgs: AnalyticsOrg[], count: number, withAcademy = false): UpcomingEvent[] {
  const orgById = new Map(orgs.map(o => [o.id, o]))
  return rows
    .filter(e => e.status === 'Upcoming')
    .sort((a, b) => a.start_date.localeCompare(b.start_date) || a.title.localeCompare(b.title))
    .slice(0, count)
    .map(e => {
      const org = orgById.get(e.ipo_id)
      if (!org) throw new Error(`event ${e.id} belongs to unknown organisation ${e.ipo_id}`)
      return {
        id:         e.id,
        title:      e.title,
        start_date: e.start_date,
        url:        e.url,
        pending:    e.approval_status === 'pending',
        org,
        ...(withAcademy ? { inAcademy: e.in_academy === true } : {}),
      }
    })
}

// Events and pending approvals per Lighthouse programme, most events first. With
// `withAcademy`, also how many of each programme's events are in the Academy.
export function summariseLighthouse(rows: EventSummaryRow[], orgs: AnalyticsOrg[], withAcademy = false): LighthouseSummary[] {
  return orgs
    .filter(o => o.type === 'lighthouse')
    .map(org => {
      const own = rows.filter(e => e.ipo_id === org.id)
      return {
        org,
        total:   own.length,
        pending: own.filter(e => e.approval_status === 'pending').length,
        ...(withAcademy ? { inAcademy: own.filter(e => e.in_academy).length } : {}),
      }
    })
    .sort((a, b) => (b.total - a.total) || a.org.name.localeCompare(b.org.name))
}
