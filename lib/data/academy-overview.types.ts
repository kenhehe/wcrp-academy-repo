// The Academy overview (app/dashboard/academy/page.tsx): view types and pure helpers.
// Loaders are in academy-overview.ts.
import { sumProgress } from './survey-progress'
import type { SurveyListItem, SurveyProgress } from './surveys.types'

export interface OverviewOrg {
  id:       string
  name:     string          // acronym
  fullName: string | null
  color:    string | null   // ipos.color_hex
}

export interface GapEvent {
  id:         string
  title:      string
  start_date: string
  end_date:   string | null
  url:        string | null
  location:   string | null
  org:        OverviewOrg
}

export interface UpcomingGaps {
  total:   number
  next:    GapEvent[]   // the soonest few
  byMonth: number[]     // missing events starting in each of the next 12 months, this month first
}

export interface CatalogueSummary {
  total:    number
  upcoming: number
  ongoing:  number
  past:     number
  onDemand: number
  other:    number   // no dates and no known tag
}

export type AlertTone = 'danger' | 'warning' | 'info'

export interface AttentionAlert {
  key:       string
  tone:      AlertTone
  title:     string
  message:   string
  href:      string
  linkLabel: string
}

export interface OverviewSurveys {
  active:        SurveyListItem[]   // soonest closing first
  drafts:        SurveyListItem[]   // soonest opening first
  closed:        number
  closedMatched: number
  totals:        SurveyProgress     // every survey, pooled
}

// How many of `days` ('YYYY-MM-DD') start in each of the `count` months from today's month
export function monthsAhead(days: string[], today: string, count = 12): number[] {
  const base = Number(today.slice(0, 4)) * 12 + Number(today.slice(5, 7)) - 1
  const out = Array<number>(count).fill(0)
  for (const day of days) {
    const i = Number(day.slice(0, 4)) * 12 + Number(day.slice(5, 7)) - 1 - base
    if (i >= 0 && i < count) out[i]++
  }
  return out
}

// Month labels for monthsAhead(): ['Oct 2026', 'Nov 2026', …]
export function monthLabelsAhead(today: string, count = 12): string[] {
  const year = Number(today.slice(0, 4)), month = Number(today.slice(5, 7)) - 1
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(year, month + i, 1))
    return new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(d)
  })
}

// Statuses as resolveStatus() gives them → counts per status
export function countCatalogue(statuses: string[]): CatalogueSummary {
  const s: CatalogueSummary = { total: statuses.length, upcoming: 0, ongoing: 0, past: 0, onDemand: 0, other: 0 }
  for (const status of statuses) {
    if (status === 'Upcoming training')     s.upcoming++
    else if (status === 'Ongoing training') s.ongoing++
    else if (status === 'Past training')    s.past++
    else if (status === 'On Demand')        s.onDemand++
    else                                    s.other++
  }
  return s
}

// Whole days from today to `day`, both 'YYYY-MM-DD'
export function daysUntil(day: string, today: string): number {
  return Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000)
}

export function daysUntilLabel(days: number): string {
  if (days <= 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return `In ${days} days`
}

// The date block in the gap list: '28', or '18–19' for a range within one month
export function dayBlock(start: string, end: string | null): { day: string; month: string } {
  const month = new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' }).format(new Date(`${start}T00:00:00Z`))
  const first = String(Number(start.slice(8, 10)))
  const sameMonth = end && end !== start && end.slice(0, 7) === start.slice(0, 7)
  return { day: sameMonth ? `${first}–${Number(end.slice(8, 10))}` : first, month }
}

// Active surveys soonest closing first, drafts soonest opening first, closed ones as a count
export function splitSurveys(list: SurveyListItem[]): OverviewSurveys {
  const by = (key: 'postClosesAt' | 'preOpensAt') => (a: SurveyListItem, b: SurveyListItem) =>
    (a[key] ?? '9999').localeCompare(b[key] ?? '9999')
  const closed = list.filter(s => s.status === 'closed')
  return {
    active:        list.filter(s => s.status === 'active').sort(by('postClosesAt')),
    drafts:        list.filter(s => s.status === 'draft').sort(by('preOpensAt')),
    closed:        closed.length,
    closedMatched: closed.reduce((sum, s) => sum + s.progress.matched, 0),
    totals:        sumProgress(list.map(s => s.progress)),
  }
}

// '43', or '100+' when the count reached the cap the loader asked for
export function cappedCount(count: number, cap: number): string {
  return count > cap ? `${cap}+` : String(count)
}
