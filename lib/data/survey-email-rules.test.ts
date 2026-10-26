import { describe, expect, it } from 'vitest'
import { EMAIL_RULES, ruleTime, stageOfKind, wantsEmail, windowOpen } from './survey-email-rules'

const w = {
  pre_opens_at:   '2026-10-06T01:00:00.000Z',
  pre_closes_at:  '2026-10-13T06:00:00.000Z',
  post_opens_at:  '2026-10-13T08:00:00.000Z',
  post_closes_at: '2026-10-27T15:59:00.000Z',
}
const rule = (name: string) => EMAIL_RULES.find(r => r.rule === name)!

describe('ruleTime', () => {
  it('schedules each default email from the windows', () => {
    expect(EMAIL_RULES.map(r => [r.rule, ruleTime(r, w)])).toEqual([
      ['pre_open',             '2026-10-06T01:00:00.000Z'],
      ['pre_close_minus_24h',  '2026-10-12T06:00:00.000Z'],
      ['post_open',            '2026-10-13T08:00:00.000Z'],
      ['post_open_plus_1h',    '2026-10-13T09:00:00.000Z'],
      ['post_open_plus_24h',   '2026-10-14T08:00:00.000Z'],
      ['post_close_minus_24h', '2026-10-26T15:59:00.000Z'],
    ])
  })

  it('drops a reminder that would fall outside a short window', () => {
    const short = { ...w, pre_opens_at: '2026-10-12T20:00:00.000Z' }   // open for 10 hours
    expect(ruleTime(rule('pre_close_minus_24h'), short)).toBeNull()
    expect(ruleTime(rule('pre_open'), short)).toBe('2026-10-12T20:00:00.000Z')
    expect(ruleTime(rule('pre_open'), { ...w, pre_opens_at: null })).toBeNull()
  })
})

describe('windowOpen / stageOfKind', () => {
  it('knows when a stage is open', () => {
    expect(windowOpen('post', w, new Date('2026-10-20T00:00:00Z').getTime())).toBe(true)
    expect(windowOpen('pre',  w, new Date('2026-10-20T00:00:00Z').getTime())).toBe(false)
    expect(stageOfKind('reminder_pre')).toBe('pre')
    expect(stageOfKind('confirmation')).toBe('post')
  })
})

describe('wantsEmail', () => {
  const none = { pre: false, post: false }, before = { pre: true, post: false }, both = { pre: true, post: true }

  it('sends invites to anyone who hasn\'t answered that stage, reminders only if not switched off', () => {
    expect(wantsEmail('invite_pre', none, true)).toBe(true)
    expect(wantsEmail('reminder_pre', none, false)).toBe(true)
    expect(wantsEmail('reminder_pre', none, true)).toBe(false)
    expect(wantsEmail('invite_post', before, true)).toBe(true)
    expect(wantsEmail('invite_post', both, false)).toBe(false)
  })

  it('reminds about the after-survey only people who answered before', () => {
    expect(wantsEmail('reminder_post', before, false)).toBe(true)
    expect(wantsEmail('reminder_post', none, false)).toBe(false)
    expect(wantsEmail('reminder_post', both, false)).toBe(false)
  })
})
