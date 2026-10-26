import { describe, expect, it } from 'vitest'
import { buildResults, showCount, type ResultAnswer } from './survey-results'

const Q = [
  { versionId: 'u',  key: 'core.understanding', isCore: true,  type: 'likert_5' as const,      stage: 'both' as const, text: 'Understanding', options: null, scaleMinLabel: 'Low', scaleMaxLabel: 'High', sortOrder: 0 },
  { versionId: 'c',  key: 'core.career_stage',  isCore: true,  type: 'single_choice' as const, stage: 'pre' as const,  text: 'Career', options: ['Student', 'Senior'], scaleMinLabel: null, scaleMaxLabel: null, sortOrder: 1 },
  { versionId: 'i',  key: 'core.personal_impact', isCore: true, type: 'text' as const,        stage: 'both' as const, text: 'Impact', options: null, scaleMinLabel: null, scaleMaxLabel: null, sortOrder: 2 },
  { versionId: 'us', key: 'core.usefulness',    isCore: true,  type: 'likert_5' as const,      stage: 'post' as const, text: 'Useful', options: null, scaleMinLabel: null, scaleMaxLabel: null, sortOrder: 3 },
  { versionId: 'd',  key: 'demo.data',          isCore: false, type: 'single_choice' as const, stage: 'both' as const, text: 'Data use', options: ['Yes', 'No'], scaleMinLabel: null, scaleMaxLabel: null, sortOrder: 4 },
]

const n = (participantId: string, stage: 'pre' | 'post', versionId: string, value: number): ResultAnswer => ({ participantId, stage, versionId, number: value, text: null, choices: null })
const c = (participantId: string, stage: 'pre' | 'post', versionId: string, pick: string): ResultAnswer => ({ participantId, stage, versionId, number: null, text: null, choices: [pick] })
const t = (participantId: string, stage: 'pre' | 'post', versionId: string, text: string): ResultAnswer => ({ participantId, stage, versionId, number: null, text, choices: null })

// Six students answered both (2 → 4), one senior answered both (3 → 3), one person only before
const answers: ResultAnswer[] = [
  ...['a', 'b', 'c', 'd', 'e', 'f'].flatMap(id => [n(id, 'pre', 'u', 2), c(id, 'pre', 'c', 'Student'), n(id, 'post', 'u', 4), n(id, 'post', 'us', 5), c(id, 'pre', 'd', 'No'), c(id, 'post', 'd', id === 'a' ? 'Yes' : 'No')]),
  n('s', 'pre', 'u', 3), c('s', 'pre', 'c', 'Senior'), n('s', 'post', 'u', 3), n('s', 'post', 'us', 3), t('s', 'pre', 'i', 'Floods'), t('s', 'post', 'i', 'Models help'),
  n('x', 'pre', 'u', 1), c('x', 'pre', 'c', 'Senior'),
]
const pseudonyms = new Map([['s', 'P-SSSS']])

describe('buildResults', () => {
  const r = buildResults(Q, pseudonyms, answers)

  it('compares before and after for matched people only', () => {
    expect(r.matched).toBe(7)
    const u = r.scales[0]
    expect(u.n).toBe(7)
    expect(u.before).toBeCloseTo((2 * 6 + 3) / 7)
    expect(u.after).toBeCloseTo((4 * 6 + 3) / 7)
    expect([u.higher, u.same, u.lower]).toEqual([6, 1, 0])
    expect(u.dist).toEqual({ before: [0, 6, 1, 0, 0], after: [0, 0, 1, 6, 0] })
  })

  it('hides breakdown groups under five people', () => {
    expect(r.breakdowns.u.career).toEqual([
      { group: 'Student', n: 6, hidden: false, before: 2, after: 4 },
      { group: 'Senior',  n: 1, hidden: true,  before: null, after: null },
    ])
  })

  it('counts paired choices, after-only scales and who took part', () => {
    expect(r.choices[0]).toMatchObject({ versionId: 'd', n: 6, before: [0, 6], after: [1, 5] })
    expect(r.afterScales[0]).toMatchObject({ versionId: 'us', n: 7, dist: [0, 0, 1, 0, 6] })
    expect(r.who[0]).toMatchObject({ versionId: 'c', n: 8, counts: [6, 2] })
  })

  it('pairs text answers by pseudonym', () => {
    expect(r.textPairs[0].pairs).toEqual([{ pseudonym: 'P-SSSS', before: 'Floods', after: 'Models help' }])
  })
})

describe('showCount', () => {
  it('blurs small counts but not zero', () => {
    expect(showCount(0)).toBe('0')
    expect(showCount(3)).toBe('fewer than 5')
    expect(showCount(5)).toBe('5')
  })
})
