// Pure helpers for creating and editing surveys: slugs, suggested windows, validation,
// datetime-local conversion. Shared by the client forms and the server actions, which
// re-run every check. Local-time helpers use the runtime's time zone, so call them in
// the browser for the admin's own time.
import type { AcademyStatus } from '@/supabase/functions/_shared/academy-dates'
import type {
  CatalogueOption, QuestionInput, QuestionStage, SubmissionStage, SurveyQuestionItem, SurveyTimesInput,
} from './surveys.types'

const pad = (n: number) => String(n).padStart(2, '0')

// ─── Which Academy events can get a survey ────────────────────────────────────

const PAST: AcademyStatus = 'Past training'

// A past event can't get a new survey: its before-survey would come after the event.
// `status` is resolveStatus()'s, worked out from the dates for today.
export function eventHasEnded(status: string): boolean {
  return status === PAST
}

// The New survey picker's list: every event that hasn't ended, soonest first. Dated events by
// their first day (so the ones running now come before the upcoming ones), then On demand,
// then those with no date; the title breaks ties.
export function surveyableEvents(events: CatalogueOption[]): CatalogueOption[] {
  const firstDay = (e: CatalogueOption) => e.startDate ?? e.endDate
  const rank     = (e: CatalogueOption) => (firstDay(e) ? 0 : e.status === 'On Demand' ? 1 : 2)
  return events
    .filter(e => !eventHasEnded(e.status))
    .sort((a, b) =>
      rank(a) - rank(b)
      || (firstDay(a) ?? '').localeCompare(firstDay(b) ?? '')
      || a.title.localeCompare(b.title))
}

// 'CMIP Seminar Series 2026 #4' → 'cmip-seminar-series-2026-4'
export function slugify(title: string): string {
  return title
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '')
}

// base, then base-2, base-3… whichever isn't taken yet
export function uniqueSlug(base: string, taken: Iterable<string>): string {
  const used = new Set(taken)
  const root = base || 'survey'
  if (!used.has(root)) return root
  for (let n = 2; ; n++) {
    if (!used.has(`${root}-${n}`)) return `${root}-${n}`
  }
}

// A stable key for a new core question, from its wording:
// 'Which tools do you use?' → 'core.which_tools_do_you_use' (then _2, _3… if taken)
export function coreKey(text: string, taken: Iterable<string>): string {
  const base = `core.${slugify(text).replace(/-/g, '_').slice(0, 40).replace(/_+$/, '') || 'question'}`
  const used = new Set(taken)
  if (!used.has(base)) return base
  for (let n = 2; ; n++) {
    if (!used.has(`${base}_${n}`)) return `${base}_${n}`
  }
}

// ─── datetime-local inputs (browser time zone) ────────────────────────────────

// Date → 'YYYY-MM-DDTHH:MM' in local time, the value a datetime-local input takes
export function toLocalInput(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

// 'YYYY-MM-DDTHH:MM' (local) → Date; null when empty or malformed
export function fromLocalInput(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value)
  if (!m) return null
  const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5])
  return Number.isNaN(d.getTime()) ? null : d
}

// Catalogue dates are whole days ('2026-11-18'); the windows are suggested as if the event
// starts at 09:00 and ends at 17:00, and the admin adjusts the windows themselves
export function catalogueDayToLocalInput(day: string | null, time: '09:00' | '17:00'): string {
  return day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? `${day}T${time}` : ''
}

// The event's days from the Academy catalogue (WordPress is the only place they're edited),
// as the start and end the window suggestions work from
export function eventFromCatalogue(start: string | null, end: string | null): Pick<LocalTimes, 'eventStart' | 'eventEnd'> {
  return {
    eventStart: catalogueDayToLocalInput(start ?? end, '09:00'),
    eventEnd:   catalogueDayToLocalInput(end ?? start, '17:00'),
  }
}

const utcDay = (withYear: boolean) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'UTC' })

// ('2027-01-11', '2027-01-29') → '11 Jan to 29 Jan 2027'; one day → '11 Jan 2027'; none → null.
// Whole days, so the same on server and browser.
export function formatCatalogueDays(start: string | null, end: string | null): string | null {
  const first = start ?? end
  const last  = end ?? start
  if (!first || !last) return null
  const at = (day: string, withYear: boolean) => utcDay(withYear).format(new Date(`${day}T00:00:00Z`))
  if (first === last) return at(first, true)
  return `${at(first, first.slice(0, 4) !== last.slice(0, 4))} to ${at(last, true)}`
}

export interface SuggestedWindows {
  preOpensAt:   Date
  preClosesAt:  Date
  postOpensAt:  Date
  postClosesAt: Date
}

// Before: opens a week ahead at 09:00, closes when the event starts.
// After: opens when the event ends, closes 14 days later at 23:59. Local time.
export function suggestWindows(eventStart: Date, eventEnd: Date): SuggestedWindows {
  const preOpensAt = new Date(eventStart)
  preOpensAt.setDate(preOpensAt.getDate() - 7)
  preOpensAt.setHours(9, 0, 0, 0)
  const postClosesAt = new Date(eventEnd)
  postClosesAt.setDate(postClosesAt.getDate() + 14)
  postClosesAt.setHours(23, 59, 0, 0)
  return { preOpensAt, preClosesAt: new Date(eventStart), postOpensAt: new Date(eventEnd), postClosesAt }
}

export const WINDOW_KEYS = ['preOpensAt', 'preClosesAt', 'postOpensAt', 'postClosesAt'] as const
export type WindowKey = typeof WINDOW_KEYS[number]

// The event's start and end (from the catalogue, see eventFromCatalogue; '' when it has no
// dates) and the windows the admin has typed, in datetime-local format. A window left out
// follows the suggestion.
export interface LocalTimes {
  eventStart: string
  eventEnd:   string
  windows:    Partial<Record<WindowKey, string>>
}

export interface ResolvedTimes {
  windows: Record<WindowKey, string>   // typed or suggested, datetime-local format
  edited:  boolean                     // the admin changed at least one window
  iso:     SurveyTimesInput            // what the server action receives ('' where missing)
}

// Fills the windows the admin hasn't typed from the event dates, and converts everything to
// ISO instants using the browser's time zone
export function resolveSurveyTimes(t: LocalTimes): ResolvedTimes {
  const start = fromLocalInput(t.eventStart), end = fromLocalInput(t.eventEnd)
  const suggested = start && end && end >= start ? suggestWindows(start, end) : null
  const windows = Object.fromEntries(
    WINDOW_KEYS.map(k => [k, t.windows[k] ?? (suggested ? toLocalInput(suggested[k]) : '')]),
  ) as Record<WindowKey, string>
  const iso = (v: string) => fromLocalInput(v)?.toISOString() ?? ''
  return {
    windows,
    edited: WINDOW_KEYS.some(k => t.windows[k] !== undefined),
    iso: {
      preOpensAt:    iso(windows.preOpensAt),
      preClosesAt:   iso(windows.preClosesAt),
      postOpensAt:   iso(windows.postOpensAt),
      postClosesAt:  iso(windows.postClosesAt),
    },
  }
}

// ─── Time zone label ──────────────────────────────────────────────────────────

// 480 → 'UTC+8', -210 → 'UTC−3:30', 0 → 'UTC'
export function formatUtcOffset(minutesEast: number): string {
  if (minutesEast === 0) return 'UTC'
  const sign = minutesEast > 0 ? '+' : '−'
  const abs = Math.abs(minutesEast)
  const mins = abs % 60
  return `UTC${sign}${Math.floor(abs / 60)}${mins ? `:${pad(mins)}` : ''}`
}

// ('Asia/Manila', 480) → 'Manila, UTC+8'
export function describeTimeZone(timeZone: string, minutesEast: number): string {
  const city = timeZone.split('/').pop()?.replace(/_/g, ' ')
  const offset = formatUtcOffset(minutesEast)
  return city && city !== 'UTC' ? `${city}, ${offset}` : offset
}

// ─── Validation (client and server) ───────────────────────────────────────────

const time = (iso: string | null | undefined) => {
  if (!iso) return null
  const t = new Date(iso).getTime()
  return Number.isNaN(t) ? null : t
}

// First problem with a survey's windows, or null when they're fine. The event's own dates
// come from the catalogue and aren't checked here (an On demand course has none).
export function checkSurveyTimes(t: Partial<SurveyTimesInput>): string | null {
  const preOpen = time(t.preOpensAt), preClose = time(t.preClosesAt)
  const postOpen = time(t.postOpensAt), postClose = time(t.postClosesAt)
  if (preOpen === null || preClose === null || postOpen === null || postClose === null) {
    return 'Set when each survey opens and closes.'
  }
  if (preClose <= preOpen) return 'The before-survey closes before it opens.'
  if (postClose <= postOpen) return 'The after-survey closes before it opens.'
  if (postOpen < preOpen) return 'The after-survey opens before the before-survey.'
  return null
}

// Whole local days between two times, ignoring the hour (DST-safe)
const dayNumber = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000
const localDay = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })

// A warning when the catalogue's event dates and the windows no longer line up, typically
// because the event moved on WordPress after the windows were set: the before-survey should
// close on the event's first day and the after-survey open on its last, give or take a day.
// Never blocks saving. Local time, so call it in the browser.
export function windowsVsEvent(windows: Record<WindowKey, string>, eventStart: string, eventEnd: string): string | null {
  const start = fromLocalInput(eventStart), end = fromLocalInput(eventEnd)
  const preClose = fromLocalInput(windows.preClosesAt), postOpen = fromLocalInput(windows.postOpensAt)
  if (!start || !end || !preClose || !postOpen) return null
  const off = (a: Date, b: Date) => Math.abs(dayNumber(a) - dayNumber(b)) > 1
  if (!off(preClose, start) && !off(postOpen, end)) return null
  const days = formatCatalogueDays(eventStart.slice(0, 10), eventEnd.slice(0, 10))
  return `The Academy catalogue has the event on ${days}, but the before-survey closes on ${localDay.format(preClose)} `
    + `and the after-survey opens on ${localDay.format(postOpen)}. Check the survey windows.`
}

export function checkTitle(title: string): string | null {
  const t = title.trim()
  if (!t) return 'Give the survey a name.'
  if (t.length > 200) return 'Keep the name under 200 characters.'
  return null
}

const CHOICE_TYPES = new Set(['single_choice', 'multi_choice'])

// Trim everything, drop empty or repeated choices, clear fields the type doesn't use
export function normalizeQuestionInput(q: QuestionInput): QuestionInput {
  const isChoice = CHOICE_TYPES.has(q.type)
  const options = isChoice
    ? [...new Set(q.options.map(o => o.trim()).filter(Boolean))]
    : []
  return {
    text:          q.text.trim(),
    type:          q.type,
    stage:         q.stage,
    options,
    scaleMinLabel: q.type === 'likert_5' ? q.scaleMinLabel.trim() : '',
    scaleMaxLabel: q.type === 'likert_5' ? q.scaleMaxLabel.trim() : '',
    isRequired:    q.isRequired,
  }
}

// First problem with an event question, or null. Run it on normalised input.
export function checkQuestionInput(q: QuestionInput): string | null {
  if (!q.text) return 'Type the question.'
  if (q.text.length > 300) return 'Keep the question under 300 characters.'
  if (CHOICE_TYPES.has(q.type)) {
    if (q.options.length < 2) return 'Give at least two choices.'
    if (q.options.length > 12) return 'Keep it to 12 choices or fewer.'
    if (q.options.some(o => o.length > 120)) return 'Keep each choice under 120 characters.'
  }
  if (q.scaleMinLabel.length > 40 || q.scaleMaxLabel.length > 40) return 'Keep the scale labels under 40 characters.'
  return null
}

// ─── Is a stage open? ─────────────────────────────────────────────────────────

export type StageWindow = 'not_open' | 'open' | 'closed'

// Open only for an active survey, between its opening and closing time (inclusive)
export function stageWindow(status: string, opensAt: string | null, closesAt: string | null, now: number): StageWindow {
  if (status === 'closed') return 'closed'
  if (status !== 'active' || !opensAt || !closesAt) return 'not_open'
  if (now < new Date(opensAt).getTime()) return 'not_open'
  if (now > new Date(closesAt).getTime()) return 'closed'
  return 'open'
}

// ─── Questions per stage ──────────────────────────────────────────────────────

export function asksAt(questionStage: QuestionStage, stage: SubmissionStage): boolean {
  return questionStage === 'both' || questionStage === stage
}

// The questions one stage asks, in survey order
export function questionsForStage<T extends Pick<SurveyQuestionItem, 'stage' | 'sortOrder'>>(items: T[], stage: SubmissionStage): T[] {
  return items.filter(q => asksAt(q.stage, stage)).sort((a, b) => a.sortOrder - b.sortOrder)
}

// Rough answering time: ~10 s per scale or choice question, ~40 s per text answer
export function estimateMinutes(items: Pick<SurveyQuestionItem, 'type'>[]): number {
  const seconds = items.reduce((sum, q) => sum + (q.type === 'text' ? 40 : 10), 0)
  return Math.max(1, Math.round(seconds / 60))
}
