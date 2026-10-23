import { describe, expect, it } from 'vitest'
import { buildTrends, describeChange, formatDay, monthCounts, sameDateCounts, upcomingByMonth } from './event-trends'

const row = (start_date: string, status = 'Past') => ({ start_date, status })

describe('sameDateCounts', () => {
  it('counts 1 January to today\'s month-day in each year, oldest first', () => {
    const rows = [row('2024-01-01'), row('2024-10-22'), row('2024-10-23'), row('2025-12-31'), row('2026-03-05')]
    expect(sameDateCounts(rows, '2026-10-22', 3)).toEqual([
      { year: 2024, count: 2 },   // 10-23 is after the cut-off
      { year: 2025, count: 0 },   // 12-31 is after the cut-off
      { year: 2026, count: 1 },
    ])
  })
})

describe('monthCounts', () => {
  it('walks back across a year boundary', () => {
    const rows = [row('2025-12-03'), row('2026-01-20'), row('2026-01-21'), row('2026-02-01')]
    expect(monthCounts(rows, '2026-02-10', 3)).toEqual([
      { month: '2025-12', label: 'Dec 2025', count: 1 },
      { month: '2026-01', label: 'Jan 2026', count: 2 },
      { month: '2026-02', label: 'Feb 2026', count: 1 },
    ])
  })
})

describe('upcomingByMonth', () => {
  it('counts only Upcoming events, from this month forward', () => {
    const rows = [row('2026-11-20', 'Upcoming'), row('2026-11-21', 'Past'), row('2027-01-06', 'Upcoming')]
    expect(upcomingByMonth(rows, '2026-11-05', 3).map(m => [m.month, m.count])).toEqual([
      ['2026-11', 1], ['2026-12', 0], ['2027-01', 1],
    ])
  })
})

describe('describeChange', () => {
  it('uses a percentage once the earlier figure is 10 or more', () => {
    expect(describeChange(104, 120)).toEqual({ direction: 'down', label: '−13%' })
    expect(describeChange(120, 100)).toEqual({ direction: 'up', label: '+20%' })
    expect(describeChange(1001, 1000)).toEqual({ direction: 'up', label: '+<1%' })
  })

  it('uses a plain difference below 10, so 3 → 1 is not "−67%"', () => {
    expect(describeChange(1, 3)).toEqual({ direction: 'down', label: '2 fewer' })
    expect(describeChange(5, 2)).toEqual({ direction: 'up', label: '3 more' })
  })

  it('reports no change', () => {
    expect(describeChange(12, 12)).toEqual({ direction: 'flat', label: 'No change' })
  })
})

describe('buildTrends', () => {
  it('counts the same calendar month one year earlier', () => {
    const rows = [row('2025-10-05'), row('2025-11-01'), row('2026-10-01')]
    expect(buildTrends(rows, '2026-10-22').monthLastYear).toBe(1)
  })
})

describe('formatDay', () => {
  it('formats ISO days without timezone drift', () => {
    expect(formatDay('2026-10-26')).toBe('26 Oct 2026')
    expect(formatDay('2026-10-26', false)).toBe('26 Oct')
  })
})
