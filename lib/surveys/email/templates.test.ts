import { describe, expect, it } from 'vitest'
import { formatEmailTime, renderSurveyEmail } from './templates'

describe('formatEmailTime', () => {
  it('writes UTC first, then Manila time, like the newsletter', () => {
    expect(formatEmailTime('2026-10-27T15:59:00Z')).toBe('27 Oct 2026, 15:59 UTC (23:59 PHT / UTC+8)')
    expect(formatEmailTime('2026-10-27T20:00:00Z')).toBe('27 Oct 2026, 20:00 UTC (04:00 PHT / UTC+8)')
  })
})

describe('renderSurveyEmail', () => {
  const base = {
    surveyTitle: 'CMIP Seminar <#4> & "friends"',
    link: 'https://example.org/s/cmip/post?t=abc',
    opensAt: '2026-10-13T08:00:00Z',
    closesAt: '2026-10-27T15:59:00Z',
    stopUrl: 'https://example.org/s/cmip/stop?t=abc',
  }

  it('escapes the survey title and carries the personal link and stop link', () => {
    const email = renderSurveyEmail({ ...base, kind: 'invite_post' })
    expect(email.subject).toBe('How did CMIP Seminar <#4> & "friends" go? 2-minute survey')
    expect(email.html).toContain('CMIP Seminar &lt;#4&gt; &amp; &quot;friends&quot;')
    expect(email.html).not.toContain('<#4>')
    expect(email.html).toContain('href="https://example.org/s/cmip/post?t=abc"')
    expect(email.html).toContain('Stop reminders for this survey')
    expect(email.text).toContain('Start the after-survey: https://example.org/s/cmip/post?t=abc')
    expect(email.text).toContain('27 Oct 2026, 15:59 UTC (23:59 PHT / UTC+8)')
  })

  it('gives every kind its own subject and leaves the stop link out when there is none', () => {
    const kinds = ['invite_pre', 'reminder_pre', 'confirmation', 'invite_post', 'reminder_post'] as const
    const subjects = kinds.map(kind => renderSurveyEmail({ ...base, kind }).subject)
    expect(new Set(subjects).size).toBe(5)
    const confirmation = renderSurveyEmail({ ...base, kind: 'confirmation', stopUrl: null })
    expect(confirmation.html).not.toContain('Stop reminders')
    expect(confirmation.text).toContain('Opens: 13 Oct 2026, 08:00 UTC (16:00 PHT / UTC+8), when the event ends')
  })
})
