import { describe, expect, it } from 'vitest'
import { formatRate, progressBySurvey, sumProgress } from './survey-progress'

describe('progressBySurvey', () => {
  const participants = [
    { id: 'a', survey_event_id: 's1' },
    { id: 'b', survey_event_id: 's1' },
    { id: 'c', survey_event_id: 's1' },
    { id: 'd', survey_event_id: 's2' },
  ]

  it('counts each participant once per stage, matches, flags and the match rate', () => {
    const progress = progressBySurvey(participants, [
      { event_participant_id: 'a', stage: 'pre',  status: 'accepted' },
      { event_participant_id: 'a', stage: 'post', status: 'accepted' },
      { event_participant_id: 'b', stage: 'pre',  status: 'accepted' },
      { event_participant_id: 'b', stage: 'pre',  status: 'flagged_duplicate' },
      { event_participant_id: 'c', stage: 'post', status: 'accepted' },
    ])
    expect(progress.get('s1')).toEqual({ participants: 3, pre: 2, post: 2, matched: 1, flagged: 1, matchRate: 0.5 })
    expect(progress.get('s2')).toEqual({ participants: 1, pre: 0, post: 0, matched: 0, flagged: 0, matchRate: null })
  })

  it('ignores submissions from participants it doesn\'t know about', () => {
    const progress = progressBySurvey(participants, [{ event_participant_id: 'zz', stage: 'pre', status: 'accepted' }])
    expect(progress.get('s1')?.pre).toBe(0)
  })
})

describe('sumProgress / formatRate', () => {
  it('pools the match rate instead of averaging the surveys', () => {
    const total = sumProgress([
      { participants: 10, pre: 10, post: 5, matched: 5, flagged: 0, matchRate: 0.5 },
      { participants: 2,  pre: 2,  post: 2, matched: 2, flagged: 1, matchRate: 1 },
    ])
    expect(total).toEqual({ participants: 12, pre: 12, post: 7, matched: 7, flagged: 1, matchRate: 7 / 12 })
    expect(formatRate(total.matchRate)).toBe('58%')
    expect(formatRate(null)).toBe('—')
  })
})
