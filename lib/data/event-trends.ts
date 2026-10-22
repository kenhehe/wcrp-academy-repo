// Event-count trends for the overview stat tiles. Pure functions with no server imports,
// so Server Components and client components can both use them. Dates are compared as
// ISO day strings (YYYY-MM-DD, how events.start_date is stored) against "today" in UTC.

export interface TrendRow {
  start_date: string
  status:     string
}

export type ChangeDirection = 'up' | 'down' | 'flat'

export interface Change {
  direction: ChangeDirection
  label:     string
}

export interface YearCount  { year: number; count: number }
export interface MonthCount { month: string; label: string; count: number }   // month = YYYY-MM

export interface Trends {
  today:         string
  soFar:         YearCount[]    // 1 Jan to today's date, last 12 years, oldest first
  months:        MonthCount[]   // last 12 months including this one, oldest first
  monthLastYear: number         // this calendar month, one year earlier
  upcoming: {
    total:   number
    byMonth: MonthCount[]       // next 12 months starting with this one
  }
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_LONG  = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10)
}

// "26 Oct 2026", or "26 Oct" without the year
export function formatDay(iso: string, withYear = true): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `${d} ${MONTHS_SHORT[m - 1]}${withYear ? ` ${y}` : ''}`
}

// "22 October"
export function formatDayMonth(iso: string): string {
  const [, m, d] = iso.split('-').map(Number)
  return `${d} ${MONTHS_LONG[m - 1]}`
}

export function monthName(index: number, long = false): string {
  return (long ? MONTHS_LONG : MONTHS_SHORT)[index]
}

function monthKey(year: number, monthIndex: number): { key: string; label: string } {
  const d = new Date(Date.UTC(year, monthIndex, 1))
  return {
    key:   d.toISOString().slice(0, 7),
    label: `${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`,
  }
}

function countByMonth(rows: TrendRow[], filter?: (row: TrendRow) => boolean): Map<string, number> {
  const counts = new Map<string, number>()
  for (const row of rows) {
    if (filter && !filter(row)) continue
    const key = row.start_date.slice(0, 7)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}

export function sameDateCounts(rows: TrendRow[], today: string, years = 12): YearCount[] {
  const thisYear = Number(today.slice(0, 4))
  const monthDay = today.slice(5)
  return Array.from({ length: years }, (_, i) => {
    const year = thisYear - years + 1 + i
    const from = `${year}-01-01`
    const to   = `${year}-${monthDay}`
    return { year, count: rows.filter(row => row.start_date >= from && row.start_date <= to).length }
  })
}

export function monthCounts(rows: TrendRow[], today: string, months = 12): MonthCount[] {
  const year   = Number(today.slice(0, 4))
  const month  = Number(today.slice(5, 7)) - 1
  const counts = countByMonth(rows)
  return Array.from({ length: months }, (_, i) => {
    const { key, label } = monthKey(year, month - (months - 1 - i))
    return { month: key, label, count: counts.get(key) ?? 0 }
  })
}

export function upcomingByMonth(rows: TrendRow[], today: string, months = 12): MonthCount[] {
  const year   = Number(today.slice(0, 4))
  const month  = Number(today.slice(5, 7)) - 1
  const counts = countByMonth(rows, row => row.status === 'Upcoming')
  return Array.from({ length: months }, (_, i) => {
    const { key, label } = monthKey(year, month + i)
    return { month: key, label, count: counts.get(key) ?? 0 }
  })
}

// A percentage once the earlier figure is big enough to make one meaningful;
// below 10 a plain difference ("2 fewer"), so 3 → 1 doesn't read as "−67%"
export function describeChange(current: number, previous: number): Change {
  const diff = current - previous
  if (diff === 0) return { direction: 'flat', label: 'No change' }
  const direction: ChangeDirection = diff > 0 ? 'up' : 'down'
  if (previous < 10) return { direction, label: diff > 0 ? `${diff} more` : `${-diff} fewer` }
  const pct  = Math.round((Math.abs(diff) / previous) * 100)
  const sign = diff > 0 ? '+' : '−'
  return { direction, label: pct === 0 ? `${sign}<1%` : `${sign}${pct}%` }
}

export function buildTrends(rows: TrendRow[], today: string): Trends {
  const year  = Number(today.slice(0, 4))
  const month = today.slice(5, 7)
  return {
    today,
    soFar:         sameDateCounts(rows, today),
    months:        monthCounts(rows, today),
    monthLastYear: rows.filter(row => row.start_date.startsWith(`${year - 1}-${month}`)).length,
    upcoming: {
      total:   rows.filter(row => row.status === 'Upcoming').length,
      byMonth: upcomingByMonth(rows, today),
    },
  }
}
