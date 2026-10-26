// Pure helpers: how far each survey has got (participants, answers, matches).
import type { SubmissionStage, SubmissionStatus, SurveyProgress } from './surveys.types'

export interface ParticipantRef {
  id:              string
  survey_event_id: string
}

export interface SubmissionRef {
  event_participant_id: string
  stage:                SubmissionStage
  status:               SubmissionStatus
}

export function emptyProgress(): SurveyProgress {
  return { participants: 0, pre: 0, post: 0, matched: 0, flagged: 0, matchRate: null }
}

// Progress per survey id. A participant counts once per stage (accepted answers only);
// matched means they answered both; match rate is matched ÷ answered before.
export function progressBySurvey(participants: ParticipantRef[], submissions: SubmissionRef[]): Map<string, SurveyProgress> {
  const surveyOf = new Map(participants.map(p => [p.id, p.survey_event_id]))
  const stages = new Map<string, Set<SubmissionStage>>()
  const flagged = new Map<string, number>()

  for (const s of submissions) {
    const surveyId = surveyOf.get(s.event_participant_id)
    if (!surveyId) continue
    if (s.status === 'flagged_duplicate') {
      flagged.set(surveyId, (flagged.get(surveyId) ?? 0) + 1)
      continue
    }
    const set = stages.get(s.event_participant_id) ?? new Set()
    set.add(s.stage)
    stages.set(s.event_participant_id, set)
  }

  const out = new Map<string, SurveyProgress>()
  for (const p of participants) {
    const row = out.get(p.survey_event_id) ?? emptyProgress()
    const answered = stages.get(p.id)
    row.participants++
    if (answered?.has('pre'))  row.pre++
    if (answered?.has('post')) row.post++
    if (answered?.has('pre') && answered.has('post')) row.matched++
    out.set(p.survey_event_id, row)
  }
  for (const [surveyId, count] of flagged) {
    const row = out.get(surveyId) ?? emptyProgress()
    row.flagged = count
    out.set(surveyId, row)
  }
  for (const row of out.values()) row.matchRate = row.pre > 0 ? row.matched / row.pre : null
  return out
}

// Totals across surveys; the match rate is pooled (all matched ÷ all who answered before)
export function sumProgress(list: SurveyProgress[]): SurveyProgress {
  const total = list.reduce((acc, p) => ({
    participants: acc.participants + p.participants,
    pre:          acc.pre + p.pre,
    post:         acc.post + p.post,
    matched:      acc.matched + p.matched,
    flagged:      acc.flagged + p.flagged,
    matchRate:    null,
  }), emptyProgress())
  total.matchRate = total.pre > 0 ? total.matched / total.pre : null
  return total
}

// 0.537 → '54%'; null → '—'
export function formatRate(rate: number | null): string {
  return rate === null ? '—' : `${Math.round(rate * 100)}%`
}
