import { describe, expect, it } from 'vitest'
import {
  catalogueDayToLocalInput, checkQuestionInput, coreKey, checkSurveyTimes, checkTitle, describeTimeZone,
  estimateMinutes, formatUtcOffset, fromLocalInput, normalizeQuestionInput, questionsForStage,
  resolveSurveyTimes, slugify, stageWindow, suggestWindows, toLocalInput, uniqueSlug,
} from './survey-setup'
import type { QuestionInput } from './surveys.types'

describe('slugify / uniqueSlug', () => {
  it('makes a URL-safe slug from a title', () => {
    expect(slugify('CMIP Seminar Series 2026 #4')).toBe('cmip-seminar-series-2026-4')
    expect(slugify('  Écoles d’été: Climat & Société  ')).toBe('ecoles-d-ete-climat-societe')
    expect(slugify('###')).toBe('')
    expect(slugify('a'.repeat(80)).length).toBe(60)
  })

  it('adds a number when the slug is taken, and falls back to "survey" when empty', () => {
    expect(uniqueSlug('cmip-4', [])).toBe('cmip-4')
    expect(uniqueSlug('cmip-4', ['cmip-4', 'cmip-4-2'])).toBe('cmip-4-3')
    expect(uniqueSlug('', ['survey'])).toBe('survey-2')
  })
})

describe('coreKey', () => {
  it('makes a core key from the wording and numbers repeats', () => {
    expect(coreKey('Which tools do you use?', [])).toBe('core.which_tools_do_you_use')
    expect(coreKey('Which tools do you use?', ['core.which_tools_do_you_use'])).toBe('core.which_tools_do_you_use_2')
    expect(coreKey('???', [])).toBe('core.question')
    expect(coreKey('x'.repeat(80), []).length).toBeLessThanOrEqual(45)
  })
})

describe('local datetime inputs', () => {
  it('round-trips a local time through the input format', () => {
    const d = new Date(2026, 9, 13, 16, 5)
    expect(toLocalInput(d)).toBe('2026-10-13T16:05')
    expect(fromLocalInput('2026-10-13T16:05')?.getTime()).toBe(d.getTime())
  })

  it('rejects empty or malformed input', () => {
    expect(fromLocalInput('')).toBeNull()
    expect(fromLocalInput('2026-10-13')).toBeNull()
  })

  it('turns a catalogue day into a local start or end time', () => {
    expect(catalogueDayToLocalInput('2026-11-18', '09:00')).toBe('2026-11-18T09:00')
    expect(catalogueDayToLocalInput(null, '17:00')).toBe('')
    expect(catalogueDayToLocalInput('18/11/2026', '17:00')).toBe('')
  })
})

describe('suggestWindows', () => {
  it('opens the before-survey a week ahead and keeps the after-survey open two weeks', () => {
    const w = suggestWindows(new Date(2026, 10, 23, 9, 0), new Date(2026, 10, 27, 17, 0))
    expect(toLocalInput(w.preOpensAt)).toBe('2026-11-16T09:00')
    expect(toLocalInput(w.preClosesAt)).toBe('2026-11-23T09:00')
    expect(toLocalInput(w.postOpensAt)).toBe('2026-11-27T17:00')
    expect(toLocalInput(w.postClosesAt)).toBe('2026-12-11T23:59')
  })
})

describe('resolveSurveyTimes', () => {
  it('suggests every window from the event dates until the admin types one', () => {
    const r = resolveSurveyTimes({ eventStart: '2026-11-23T09:00', eventEnd: '2026-11-27T17:00', windows: {} })
    expect(r.windows).toEqual({
      preOpensAt: '2026-11-16T09:00', preClosesAt: '2026-11-23T09:00',
      postOpensAt: '2026-11-27T17:00', postClosesAt: '2026-12-11T23:59',
    })
    expect(r.edited).toBe(false)
    expect(r.iso.preOpensAt).toBe(new Date(2026, 10, 16, 9, 0).toISOString())
  })

  it('keeps what the admin typed and leaves gaps when the event dates are missing', () => {
    const typed = resolveSurveyTimes({ eventStart: '2026-11-23T09:00', eventEnd: '2026-11-27T17:00', windows: { postClosesAt: '2026-12-01T12:00' } })
    expect(typed.windows.postClosesAt).toBe('2026-12-01T12:00')
    expect(typed.edited).toBe(true)
    const empty = resolveSurveyTimes({ eventStart: '', eventEnd: '', windows: {} })
    expect(empty.windows.preOpensAt).toBe('')
    expect(empty.iso.eventStartsAt).toBe('')
  })
})

describe('time zone label', () => {
  it('formats offsets, including half hours and UTC', () => {
    expect(formatUtcOffset(480)).toBe('UTC+8')
    expect(formatUtcOffset(-210)).toBe('UTC−3:30')
    expect(formatUtcOffset(0)).toBe('UTC')
  })

  it('names the city from the IANA zone', () => {
    expect(describeTimeZone('Asia/Manila', 480)).toBe('Manila, UTC+8')
    expect(describeTimeZone('America/Argentina/Buenos_Aires', -180)).toBe('Buenos Aires, UTC−3')
    expect(describeTimeZone('UTC', 0)).toBe('UTC')
  })
})

describe('checkSurveyTimes', () => {
  const ok = {
    eventStartsAt: '2026-11-23T01:00:00Z', eventEndsAt: '2026-11-27T09:00:00Z',
    preOpensAt:    '2026-11-16T01:00:00Z', preClosesAt: '2026-11-23T01:00:00Z',
    postOpensAt:   '2026-11-27T09:00:00Z', postClosesAt: '2026-12-11T15:59:00Z',
  }

  it('accepts a sensible set of times', () => {
    expect(checkSurveyTimes(ok)).toBeNull()
  })

  it('names the first problem', () => {
    expect(checkSurveyTimes({ ...ok, eventStartsAt: '' })).toBe('Enter when the event starts and ends.')
    expect(checkSurveyTimes({ ...ok, eventEndsAt: '2026-11-20T00:00:00Z' })).toBe('The event ends before it starts.')
    expect(checkSurveyTimes({ ...ok, postClosesAt: 'not a date' })).toBe('Set when each survey opens and closes.')
    expect(checkSurveyTimes({ ...ok, preClosesAt: ok.preOpensAt })).toBe('The before-survey closes before it opens.')
    expect(checkSurveyTimes({ ...ok, postClosesAt: '2026-11-27T08:00:00Z' })).toBe('The after-survey closes before it opens.')
    expect(checkSurveyTimes({ ...ok, postOpensAt: '2026-11-10T00:00:00Z' })).toBe('The after-survey opens before the before-survey.')
  })
})

describe('checkTitle', () => {
  it('needs a name of reasonable length', () => {
    expect(checkTitle('  ')).toBe('Give the survey a name.')
    expect(checkTitle('x'.repeat(201))).toBe('Keep the name under 200 characters.')
    expect(checkTitle('CORDEX Summer School 2026')).toBeNull()
  })
})

describe('event questions', () => {
  const base: QuestionInput = {
    text: '  Have you used CORDEX data?  ', type: 'single_choice', stage: 'both',
    options: [' Yes ', 'No', '', 'Yes'], scaleMinLabel: 'x', scaleMaxLabel: 'y', isRequired: true,
  }

  it('trims, drops empty and repeated choices, and clears unused fields', () => {
    expect(normalizeQuestionInput(base)).toEqual({ ...base, text: 'Have you used CORDEX data?', options: ['Yes', 'No'], scaleMinLabel: '', scaleMaxLabel: '' })
    expect(normalizeQuestionInput({ ...base, type: 'text' }).options).toEqual([])
    expect(normalizeQuestionInput({ ...base, type: 'likert_5' }).scaleMinLabel).toBe('x')
  })

  it('needs text and, for choice questions, at least two choices', () => {
    expect(checkQuestionInput(normalizeQuestionInput({ ...base, text: ' ' }))).toBe('Type the question.')
    expect(checkQuestionInput(normalizeQuestionInput({ ...base, options: ['Yes', 'yes '] }))).toBeNull()
    expect(checkQuestionInput(normalizeQuestionInput({ ...base, options: ['Yes', ' Yes'] }))).toBe('Give at least two choices.')
    expect(checkQuestionInput(normalizeQuestionInput({ ...base, type: 'text', options: [] }))).toBeNull()
  })
})

describe('stageWindow', () => {
  const opens = '2026-10-13T08:00:00Z', closes = '2026-10-27T15:59:00Z'
  const at = (iso: string) => new Date(iso).getTime()

  it('is open only for an active survey inside its window', () => {
    expect(stageWindow('active', opens, closes, at('2026-10-20T00:00:00Z'))).toBe('open')
    expect(stageWindow('active', opens, closes, at('2026-10-13T07:59:00Z'))).toBe('not_open')
    expect(stageWindow('active', opens, closes, at('2026-10-27T16:00:00Z'))).toBe('closed')
    expect(stageWindow('draft',  opens, closes, at('2026-10-20T00:00:00Z'))).toBe('not_open')
    expect(stageWindow('closed', opens, closes, at('2026-10-20T00:00:00Z'))).toBe('closed')
    expect(stageWindow('active', null, closes, at('2026-10-20T00:00:00Z'))).toBe('not_open')
  })
})

describe('questionsForStage / estimateMinutes', () => {
  const items = [
    { stage: 'post' as const, sortOrder: 3, type: 'likert_5' as const },
    { stage: 'both' as const, sortOrder: 1, type: 'text' as const },
    { stage: 'pre'  as const, sortOrder: 2, type: 'single_choice' as const },
  ]

  it('keeps the questions a stage asks, in survey order', () => {
    expect(questionsForStage(items, 'pre').map(q => q.sortOrder)).toEqual([1, 2])
    expect(questionsForStage(items, 'post').map(q => q.sortOrder)).toEqual([1, 3])
  })

  it('estimates at least a minute', () => {
    expect(estimateMinutes([])).toBe(1)
    expect(estimateMinutes(items)).toBe(1)
    expect(estimateMinutes([...items, ...items, ...items])).toBe(3)
  })
})
