import type { Trends } from './event-trends'

export interface AnalyticsOrg {
  id:       string
  name:     string          // short name / acronym
  fullName: string | null
  color:    string | null   // ipos.color_hex
  type:     'ipo' | 'lighthouse'
}

// Everything the client-side Event activity chart needs; plain JSON
export interface ActivityData {
  currentYear:    number
  years:          number[]                                // first to last year with events, gaps filled
  byYear:         Record<number, Record<string, number>>  // year → org id → events
  byYearMonth:    Record<number, number[]>                // year → 12 monthly counts
  upcomingByYear: Record<number, number>                  // events still to come, by year
  orgs:           AnalyticsOrg[]
}

export interface UpcomingEvent {
  id:         string
  title:      string
  start_date: string
  url:        string | null
  pending:    boolean
  org:        AnalyticsOrg
}

export interface LighthouseSummary {
  org:     AnalyticsOrg
  total:   number
  pending: number
}

export interface ClimateAnalyticsData {
  totals:     { events: number; ipo: number; lighthouse: number; ipoOrgs: number; lighthouseOrgs: number }
  trends:     Trends
  awaiting:   { total: number; upcoming: number; past: number }
  next:       UpcomingEvent[]   // the next 6 upcoming events
  activity:   ActivityData
  lighthouse: LighthouseSummary[]
}
