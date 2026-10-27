import { describe, expect, it } from 'vitest'
import { buildActivity } from './event-activity'
import type { AnalyticsOrg } from './climate-analytics.types'

const orgs: AnalyticsOrg[] = [
  { id: 'cmip', name: 'CMIP', fullName: null, color: null, type: 'ipo' },
  { id: 'esmo', name: 'ESMO', fullName: null, color: null, type: 'ipo' },
]

const rows = [
  { ipo_id: 'cmip', start_date: '2024-02-10', status: 'Past',     in_academy: true },
  { ipo_id: 'esmo', start_date: '2024-02-20', status: 'Past',     in_academy: false },
  { ipo_id: 'cmip', start_date: '2026-11-25', status: 'Upcoming', in_academy: false },
  { ipo_id: 'cmip', start_date: '2027-01-11', status: 'Upcoming', in_academy: true },
]

describe('buildActivity', () => {
  it('counts events by start year, organisation and month, filling the gaps between years', () => {
    const a = buildActivity(rows, orgs, '2026-10-27')
    expect(a.currentYear).toBe(2026)
    expect(a.years).toEqual([2024, 2025, 2026, 2027])
    expect(a.byYear[2024]).toEqual({ cmip: 1, esmo: 1 })
    expect(a.byYearMonth[2024][1]).toBe(2)
    expect(a.upcomingByYear).toEqual({ 2026: 1, 2027: 1 })
    expect(a.inAcademy).toBeUndefined()
  })

  it('always shows the current year, even with no events in it', () => {
    expect(buildActivity(rows.slice(0, 2), orgs, '2026-10-27').years).toEqual([2024, 2025, 2026])
  })

  it('adds the Academy counts when asked', () => {
    const a = buildActivity(rows, orgs, '2026-10-27', true)
    expect(a.inAcademy?.byYear).toEqual({ 2024: 1, 2027: 1 })
    expect(a.inAcademy?.byYearMonth[2024][1]).toBe(1)
    expect(a.inAcademy?.byYearMonth[2026]).toBeUndefined()
  })
})
