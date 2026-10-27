import { describe, expect, it } from 'vitest'
import { buildActivity, nextUpcoming, summariseLighthouse } from './event-activity'
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

const withLighthouse: AnalyticsOrg[] = [
  ...orgs,
  { id: 'slc', name: 'SLC', fullName: 'Safe Landing Climates', color: null, type: 'lighthouse' },
  { id: 'de',  name: 'DE',  fullName: 'Digital Earths',        color: null, type: 'lighthouse' },
  { id: 'rci', name: 'RCI', fullName: null,                    color: null, type: 'lighthouse' },
]

const event = (id: string, ipo_id: string, start_date: string, status: string, extra: { approval_status?: string; in_academy?: boolean } = {}) =>
  ({ id, ipo_id, title: `Event ${id}`, start_date, status, url: null, approval_status: extra.approval_status ?? 'approved', in_academy: extra.in_academy ?? false })

const summaryRows = [
  event('1', 'cmip', '2026-12-01', 'Upcoming', { in_academy: true }),
  event('2', 'slc',  '2026-11-05', 'Upcoming', { approval_status: 'pending' }),
  event('3', 'esmo', '2026-11-05', 'Upcoming'),
  event('4', 'slc',  '2025-03-01', 'Past',     { in_academy: true }),
  event('5', 'de',   '2025-06-01', 'Past'),
  event('6', 'cmip', '2026-11-20', 'Ongoing'),
]

describe('nextUpcoming', () => {
  it('lists upcoming events soonest first, then by title, with their organisation and approval', () => {
    const next = nextUpcoming(summaryRows, withLighthouse, 2)
    expect(next.map(e => e.id)).toEqual(['2', '3'])
    expect(next[0]).toMatchObject({ pending: true, org: { id: 'slc' } })
    expect(next[0].inAcademy).toBeUndefined()
  })

  it('says whether each is in the Academy when asked', () => {
    expect(nextUpcoming(summaryRows, withLighthouse, 6, true).map(e => [e.id, e.inAcademy])).toEqual([['2', false], ['3', false], ['1', true]])
  })

  it('fails on an event of an organisation it was not given', () => {
    expect(() => nextUpcoming(summaryRows, orgs, 6)).toThrow('event 2 belongs to unknown organisation slc')
  })
})

describe('summariseLighthouse', () => {
  it('counts each programme’s events and pending ones, most events first, programmes without events last', () => {
    expect(summariseLighthouse(summaryRows, withLighthouse).map(({ org, total, pending }) => [org.id, total, pending]))
      .toEqual([['slc', 2, 1], ['de', 1, 0], ['rci', 0, 0]])
  })

  it('adds how many are in the Academy when asked', () => {
    expect(summariseLighthouse(summaryRows, withLighthouse, true).map(s => s.inAcademy)).toEqual([1, 0, 0])
    expect(summariseLighthouse(summaryRows, withLighthouse)[0].inAcademy).toBeUndefined()
  })
})
