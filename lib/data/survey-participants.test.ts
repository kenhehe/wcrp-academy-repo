import { describe, expect, it } from 'vitest'
import {
  cleanEmailList, emailsFromCsv, isValidEmail, maskEmail, normalizeEmail, participantStatus,
  splitEmailList, suggestEmailFix,
} from './survey-participants'

describe('reading email lists', () => {
  it('splits pasted text on lines, commas, semicolons and tabs, and unwraps "Name <email>"', () => {
    expect(splitEmailList('a@x.org, b@x.org;c@x.org\n"Dana Cruz" <d@x.org>\t e@x.org \n\n')).toEqual(['a@x.org', 'b@x.org', 'c@x.org', 'd@x.org', 'e@x.org'])
  })

  it('takes the email column of a CSV, quoted commas included', () => {
    const csv = 'First Name,Last Name,Email,Registration Time\n"Cruz, Dana",X,d@x.org,2026-10-01\nAna,Y,"a@x.org",2026-10-02\n'
    expect(emailsFromCsv(csv)).toEqual(['d@x.org', 'a@x.org'])
  })

  it('falls back to any address in the file when no column is called email', () => {
    expect(emailsFromCsv('name;contact\nAna;a@x.org\nBo;bo@y.edu')).toEqual(['a@x.org', 'bo@y.edu'])
  })

  it('normalises, drops repeats and reports what isn\'t an address', () => {
    expect(cleanEmailList([' A@X.org', 'a@x.org', 'mailto:B@x.org', 'not an email', 'c@localhost', ''])).toEqual({
      valid: ['a@x.org', 'b@x.org'], invalid: ['not an email', 'c@localhost'], repeated: 1,
    })
    expect(normalizeEmail('  K@Example.ORG ')).toBe('k@example.org')
    expect(isValidEmail('k@example.org')).toBe(true)
    expect(isValidEmail('k@@example.org')).toBe(false)
  })
})

describe('typos and masking', () => {
  it('suggests a fix for common domain typos only', () => {
    expect(suggestEmailFix('k.ramirez@gmial.com')).toBe('k.ramirez@gmail.com')
    expect(suggestEmailFix('K@Hotmial.com')).toBe('k@hotmail.com')
    expect(suggestEmailFix('k@observatory.ph')).toBeNull()
  })

  it('masks all but the first letter of the name', () => {
    expect(maskEmail('k.ramirez@gmail.com')).toBe('k•••@gmail.com')
  })
})

describe('participantStatus', () => {
  const base = { source: 'imported' as const, submissions: [], emails: [] }

  it('follows the participant from not started to matched', () => {
    expect(participantStatus(base).state).toBe('not_started')
    expect(participantStatus({ ...base, emails: [{ kind: 'invite_pre', status: 'sent' }] }).state).toBe('invited')
    expect(participantStatus({ ...base, submissions: [{ stage: 'pre', status: 'accepted' }] }).state).toBe('before_only')
    expect(participantStatus({ ...base, submissions: [{ stage: 'post', status: 'accepted' }] }).state).toBe('after_only')
    expect(participantStatus({ ...base, submissions: [{ stage: 'pre', status: 'accepted' }, { stage: 'post', status: 'accepted' }] }).state).toBe('matched')
  })

  it('ignores flagged repeats for the state but counts them, and flags bounces and walk-ins', () => {
    const s = participantStatus({
      source: 'walk_in',
      submissions: [{ stage: 'pre', status: 'flagged_duplicate' }],
      emails: [{ kind: 'invite_pre', status: 'bounced' }],
    })
    expect(s).toEqual({ state: 'not_started', walkIn: true, bounced: true, flagged: 1 })
  })
})
