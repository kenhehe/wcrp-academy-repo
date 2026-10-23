// Runs under Vitest (Node), not Deno: covers the date parsing every scraper depends on.
// This folder is excluded from tsc and ESLint (Deno code); `npm test` still picks it up.
import { describe, expect, it } from 'vitest'
import { computeStatus, parseDate, parseDateRange } from './utils.ts'

describe('parseDateRange', () => {
  const cases: [string, string, string][] = [
    ['15-18 September 2024',        '2024-09-15', '2024-09-18'],
    ['15–18 Sep 2024',              '2024-09-15', '2024-09-18'],   // en dash
    ['September 15-18, 2024',       '2024-09-15', '2024-09-18'],
    ['15 Sep - 3 Oct 2024',         '2024-09-15', '2024-10-03'],   // across months
    ['30 Nov 2024 - 3 Jan 2025',    '2024-11-30', '2025-01-03'],   // across years
    ['Jul 20, 2026 - Jul 24, 2026', '2026-07-20', '2026-07-24'],
    ['2026-06-01 - 2026-06-03',     '2026-06-01', '2026-06-03'],
    ['25 November 2026',            '2026-11-25', '2026-11-25'],   // single day: end = start
    ['5 Sept 2025',                 '2025-09-05', '2025-09-05'],
  ]
  for (const [input, start, end] of cases) {
    it(input, () => expect(parseDateRange(input)).toEqual({ start, end }))
  }
})

describe('parseDate', () => {
  it('reads the formats the scrapers meet', () => {
    expect(parseDate('Nov 25, 2026')).toBe('2026-11-25')
    expect(parseDate('25/11/2026')).toBe('2026-11-25')
    expect(parseDate('2026/11/25')).toBe('2026-11-25')
    expect(parseDate('')).toBeNull()
  })
})

describe('computeStatus', () => {
  it('derives Past / Upcoming / Ongoing from the dates', () => {
    expect(computeStatus('2000-01-01')).toBe('Past')
    expect(computeStatus('2999-01-01')).toBe('Upcoming')
    expect(computeStatus('2000-01-01', '2999-12-31')).toBe('Ongoing')
  })
})
