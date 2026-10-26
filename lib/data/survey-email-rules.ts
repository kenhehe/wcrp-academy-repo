// Pure: when each scheduled survey email goes out, from the survey's windows (the defaults
// in docs/surveys/PLAN.md section 9). A survey gets one job per rule when it opens; the
// Send tab switches rules on and off. The thank-you email isn't scheduled: it goes the
// moment someone answers the before-survey by QR code.
import type { EmailKind, SurveyEventRow } from './surveys.types'

type Windows = Pick<SurveyEventRow, 'pre_opens_at' | 'pre_closes_at' | 'post_opens_at' | 'post_closes_at'>

export interface EmailRule {
  rule:     string
  kind:     EmailKind
  label:    string
  audience: string
  stage:    'pre' | 'post'
  at:       (w: Windows) => string | null
}

const HOUR = 3_600_000
const shift = (iso: string | null, ms: number) => (iso ? new Date(new Date(iso).getTime() + ms).toISOString() : null)

export const EMAIL_RULES: EmailRule[] = [
  { rule: 'pre_open',             kind: 'invite_pre',    stage: 'pre',  label: 'Before-survey invite, when it opens',          audience: 'Everyone on the list who hasn\'t answered yet',      at: w => w.pre_opens_at },
  { rule: 'pre_close_minus_24h',  kind: 'reminder_pre',  stage: 'pre',  label: 'Before-survey reminder, 24 h before it closes', audience: 'People who haven\'t answered the before-survey',       at: w => shift(w.pre_closes_at, -24 * HOUR) },
  { rule: 'post_open',            kind: 'invite_post',   stage: 'post', label: 'After-survey invite, when it opens',           audience: 'Everyone who hasn\'t answered the after-survey',      at: w => w.post_opens_at },
  { rule: 'post_open_plus_1h',    kind: 'reminder_post', stage: 'post', label: 'After-survey reminder, 1 h after it opens',     audience: 'People who answered before but not after',           at: w => shift(w.post_opens_at, HOUR) },
  { rule: 'post_open_plus_24h',   kind: 'reminder_post', stage: 'post', label: 'After-survey reminder, 24 h after it opens',    audience: 'People who answered before but not after',           at: w => shift(w.post_opens_at, 24 * HOUR) },
  { rule: 'post_close_minus_24h', kind: 'reminder_post', stage: 'post', label: 'After-survey reminder, 24 h before it closes',  audience: 'People who answered before but not after',           at: w => shift(w.post_closes_at, -24 * HOUR) },
]

// When a rule fires for these windows; null when it would fall outside its survey's window
// (a short window leaves no room for a reminder)
export function ruleTime(rule: EmailRule, w: Windows): string | null {
  const at = rule.at(w)
  const [opens, closes] = rule.stage === 'pre' ? [w.pre_opens_at, w.pre_closes_at] : [w.post_opens_at, w.post_closes_at]
  if (!at || !opens || !closes) return null
  const t = new Date(at).getTime()
  return t >= new Date(opens).getTime() && t < new Date(closes).getTime() ? at : null
}

// Is a stage's window still open at `now` (a job for a closed window has nothing left to do)
export function windowOpen(stage: 'pre' | 'post', w: Windows, now: number): boolean {
  const [opens, closes] = stage === 'pre' ? [w.pre_opens_at, w.pre_closes_at] : [w.post_opens_at, w.post_closes_at]
  return Boolean(opens && closes) && now >= new Date(opens!).getTime() && now <= new Date(closes!).getTime()
}

export function stageOfKind(kind: EmailKind): 'pre' | 'post' {
  return kind === 'invite_pre' || kind === 'reminder_pre' ? 'pre' : 'post'
}

// Who a kind of email goes to, given what the person has answered and whether they asked
// to stop reminders
export function wantsEmail(kind: EmailKind, answered: { pre: boolean; post: boolean }, remindersOff: boolean): boolean {
  switch (kind) {
    case 'invite_pre':    return !answered.pre
    case 'reminder_pre':  return !answered.pre && !remindersOff
    case 'invite_post':   return !answered.post
    case 'reminder_post': return answered.pre && !answered.post && !remindersOff
    case 'confirmation':  return answered.pre && !answered.post
  }
}
