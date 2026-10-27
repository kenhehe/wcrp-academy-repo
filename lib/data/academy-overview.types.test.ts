import { describe, expect, it } from 'vitest'
import {
  cappedCount, countCatalogue, dayBlock, daysUntil, daysUntilLabel, monthLabelsAhead, monthsAhead, splitSurveys,
} from './academy-overview.types'
import { emptyProgress } from './survey-progress'
import type { SurveyListItem } from './surveys.types'

describe('monthsAhead / monthLabelsAhead', () => {
  it('counts days per month from this month on, across the year end', () => {
    const days = ['2026-10-28', '2026-11-16', '2026-11-25', '2027-01-11', '2027-10-01', '2026-09-30']
    expect(monthsAhead(days, '2026-10-27')).toEqual([1, 2, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0])
    expect(monthLabelsAhead('2026-10-27', 4)).toEqual(['Oct 2026', 'Nov 2026', 'Dec 2026', 'Jan 2027'])
  })
})

describe('countCatalogue', () => {
  it('counts each status, anything else as other', () => {
    expect(countCatalogue(['Past training', 'Past training', 'On Demand', 'Upcoming training', 'Ongoing training', '—']))
      .toEqual({ total: 6, upcoming: 1, ongoing: 1, past: 2, onDemand: 1, other: 1 })
  })
})

describe('daysUntil / daysUntilLabel / dayBlock', () => {
  it('counts whole days', () => {
    expect(daysUntil('2026-10-28', '2026-10-27')).toBe(1)
    expect(daysUntil('2026-11-16', '2026-10-27')).toBe(20)
    expect(daysUntilLabel(0)).toBe('Today')
    expect(daysUntilLabel(1)).toBe('Tomorrow')
    expect(daysUntilLabel(20)).toBe('In 20 days')
  })
  it('shows a range inside one month as one block', () => {
    expect(dayBlock('2026-11-18', '2026-11-19')).toEqual({ day: '18–19', month: 'Nov' })
    expect(dayBlock('2026-10-28', '2026-10-28')).toEqual({ day: '28', month: 'Oct' })
    expect(dayBlock('2026-11-30', '2026-12-02')).toEqual({ day: '30', month: 'Nov' })
    expect(dayBlock('2026-12-07', null)).toEqual({ day: '7', month: 'Dec' })
  })
})

describe('splitSurveys', () => {
  const survey = (slug: string, status: SurveyListItem['status'], extra: Partial<SurveyListItem> = {}): SurveyListItem => ({
    id: slug, slug, title: slug, status, eventTitle: null, trainingType: null,
    preOpensAt: null, postOpensAt: null, postClosesAt: null, afterOpen: false, progress: emptyProgress(), ...extra,
  })
  it('orders active by closing, drafts by opening, and pools the progress', () => {
    const list = [
      survey('a', 'active', { postClosesAt: '2026-11-17T15:59:00Z', progress: { ...emptyProgress(), pre: 29 } }),
      survey('b', 'active', { postClosesAt: '2026-10-27T15:59:00Z', progress: { ...emptyProgress(), pre: 118, matched: 64 } }),
      survey('c', 'draft',  { preOpensAt: '2026-12-01T21:00:00Z' }),
      survey('d', 'closed', { progress: { ...emptyProgress(), pre: 50, matched: 41 } }),
    ]
    const s = splitSurveys(list)
    expect(s.active.map(x => x.slug)).toEqual(['b', 'a'])
    expect(s.drafts.map(x => x.slug)).toEqual(['c'])
    expect(s.closed).toBe(1)
    expect(s.closedMatched).toBe(41)
    expect(s.totals.matched).toBe(105)
    expect(s.totals.matchRate).toBeCloseTo(105 / 197)
  })
})

describe('cappedCount', () => {
  it('shows the cap with a plus once reached', () => {
    expect(cappedCount(43, 100)).toBe('43')
    expect(cappedCount(101, 100)).toBe('100+')
  })
})
