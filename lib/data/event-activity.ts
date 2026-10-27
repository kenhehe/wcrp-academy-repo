// Pure: the per-year and per-month counts behind the Event activity chart
// (components/charts/EventActivity). Used by Climate Analytics and the Academy overview.
import type { ActivityData, AnalyticsOrg } from './climate-analytics.types'

export interface ActivityRow {
  ipo_id:      string
  start_date:  string            // 'YYYY-MM-DD'; events count by the year and month they start
  status:      string | null
  in_academy?: boolean
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
