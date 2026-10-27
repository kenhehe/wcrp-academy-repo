// Runs under Vitest (Node), not Deno: the Academy catalogue's date and status rule, used by
// the WordPress sync and by the app.
import { describe, expect, it } from 'vitest'
import { academyTagLabel, parseAcademyDay, resolveAcademyDates, statusFromDays, utcToday } from './academy-dates.ts'

describe('parseAcademyDay', () => {
  it('reads the WordPress (ACF) format and ISO days', () => {
    expect(parseAcademyDay('20270111')).toBe('2027-01-11')
    expect(parseAcademyDay('2027-01-11')).toBe('2027-01-11')
    expect(parseAcademyDay(' 20270111 ')).toBe('2027-01-11')
  })
  it('turns anything else into null', () => {
    expect(parseAcademyDay('')).toBeNull()
    expect(parseAcademyDay(null)).toBeNull()
    expect(parseAcademyDay(undefined)).toBeNull()
    expect(parseAcademyDay('11/01/2027')).toBeNull()
    expect(parseAcademyDay('2027011')).toBeNull()
    expect(parseAcademyDay('20270230')).toBeNull()   // 30 February
    expect(parseAcademyDay('2027-0111')).toBeNull()
  })
})

describe('academyTagLabel', () => {
  it('maps WordPress slugs and keeps stored labels', () => {
    expect(academyTagLabel('on_going_training')).toBe('Ongoing training')
    expect(academyTagLabel('ongoing_training')).toBe('Ongoing training')
    expect(academyTagLabel('on_demand_training')).toBe('On Demand')
    expect(academyTagLabel('Past training')).toBe('Past training')
    expect(academyTagLabel('On Demand')).toBe('On Demand')
  })
  it('returns null for unknown or empty tags', () => {
    expect(academyTagLabel('')).toBeNull()
    expect(academyTagLabel('something_else')).toBeNull()
  })
})

describe('statusFromDays', () => {
  const today = '2026-10-27'
  it('compares whole days, today counting as ongoing', () => {
    expect(statusFromDays('2026-10-20', '2026-10-26', today)).toBe('Past training')
    expect(statusFromDays('2026-10-28', '2026-10-30', today)).toBe('Upcoming training')
    expect(statusFromDays('2026-10-27', '2026-10-30', today)).toBe('Ongoing training')
    expect(statusFromDays('2026-10-20', '2026-10-27', today)).toBe('Ongoing training')
    expect(statusFromDays('2026-10-27', '2026-10-27', today)).toBe('Ongoing training')
  })
  it('treats a missing end (or start) as a one-day event', () => {
    expect(statusFromDays('2026-10-26', null, today)).toBe('Past training')
    expect(statusFromDays(null, '2026-10-28', today)).toBe('Upcoming training')
  })
  it('returns null without dates', () => {
    expect(statusFromDays(null, null, today)).toBeNull()
  })
})

describe('resolveAcademyDates', () => {
  const today = '2026-10-27'
  it('lets the dates decide over a stale tag', () => {
    expect(resolveAcademyDates({ tag: 'past_training', start: '20261001', end: '20261231', publish: null }, today))
      .toEqual({ status: 'Ongoing training', start_date: '2026-10-01', end_date: '2026-12-31', publish_date: null })
    expect(resolveAcademyDates({ tag: 'upcoming_training', start: '20260301', end: '20260302', publish: null }, today).status)
      .toBe('Past training')
  })
  it('keeps only the publish date for On demand records', () => {
    expect(resolveAcademyDates({ tag: 'on_demand_training', start: '20231020', end: '20251231', publish: '20250903' }, today))
      .toEqual({ status: 'On Demand', start_date: null, end_date: null, publish_date: '2025-09-03' })
  })
  it('treats a publish date without start or end as On demand', () => {
    expect(resolveAcademyDates({ tag: null, start: null, end: null, publish: '20260810' }, today).status).toBe('On Demand')
  })
  it('falls back to the tag, then null, without dates', () => {
    expect(resolveAcademyDates({ tag: 'upcoming_training', start: '', end: '', publish: '' }, today).status).toBe('Upcoming training')
    expect(resolveAcademyDates({ tag: 'mystery', start: '', end: '', publish: '' }, today).status).toBeNull()
  })
})

describe('utcToday', () => {
  it('is the UTC day', () => {
    expect(utcToday(new Date('2026-10-27T23:30:00-05:00'))).toBe('2026-10-28')
  })
})
