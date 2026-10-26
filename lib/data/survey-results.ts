// Pure: turns one survey's accepted answers into its results. Works on pseudonyms only;
// emails never reach this module. Rules (docs/surveys/PLAN.md section 10):
//   - before/after comparisons use matched people only (answered both)
//   - a breakdown group with fewer than MIN_GROUP people is hidden, and counts under it are
//     shown as "fewer than 5", so nobody can be picked out
import type { SubmissionStage, SurveyQuestionItem } from './surveys.types'

export const MIN_GROUP = 5
const CAREER_KEY = 'core.career_stage'
const REGION_KEY = 'core.region'

export interface ResultAnswer {
  participantId: string
  stage:         SubmissionStage
  versionId:     string
  number:        number | null
  text:          string | null
  choices:       string[] | null
}

export interface PairedScale {
  versionId: string
  text:      string
  isCore:    boolean
  minLabel:  string | null
  maxLabel:  string | null
  n:         number   // matched people who answered it both times
  before:    number | null
  after:     number | null
  higher:    number
  same:      number
  lower:     number
  dist:      { before: number[]; after: number[] }   // counts of 1…5
}

export interface PairedChoice {
  versionId: string
  text:      string
  options:   string[]
  n:         number
  before:    number[]   // counts per option
  after:     number[]
}

export interface StageScale {
  versionId: string
  text:      string
  n:         number
  mean:      number | null
  dist:      number[]
}

export interface StageChoice {
  versionId: string
  text:      string
  options:   string[]
  n:         number
  counts:    number[]
}

export interface BreakdownRow {
  group:  string
  n:      number
  hidden: boolean          // fewer than MIN_GROUP: numbers withheld
  before: number | null
  after:  number | null
}

export interface TextPair {
  pseudonym: string
  before:    string
  after:     string
}

export interface SurveyResults {
  matched:     number
  scales:      PairedScale[]
  choices:     PairedChoice[]
  afterScales: StageScale[]    // asked after only (usefulness…), everyone who answered after
  afterChoices: StageChoice[]  // (recommend…)
  who:         StageChoice[]   // asked before only (career stage, region): who took part
  breakdowns:  Record<string, { career: BreakdownRow[]; region: BreakdownRow[] }>   // by scale versionId
  textPairs:   { versionId: string; text: string; pairs: TextPair[] }[]
  afterTexts:  { versionId: string; text: string; answers: { pseudonym: string; text: string }[] }[]
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

function histogram(values: number[]): number[] {
  const out = [0, 0, 0, 0, 0]
  for (const v of values) if (v >= 1 && v <= 5) out[Math.round(v) - 1]++
  return out
}

function countOptions(options: string[], picks: string[][]): number[] {
  return options.map(o => picks.filter(p => p.includes(o)).length)
}

// "fewer than 5" for small non-zero counts, so a lone person in a group can't be spotted
export function showCount(n: number): string {
  return n > 0 && n < MIN_GROUP ? `fewer than ${MIN_GROUP}` : String(n)
}

export function buildResults(
  questions: Pick<SurveyQuestionItem, 'versionId' | 'key' | 'isCore' | 'type' | 'stage' | 'text' | 'options' | 'scaleMinLabel' | 'scaleMaxLabel' | 'sortOrder'>[],
  pseudonyms: Map<string, string>,   // participantId → pseudonym
  answers: ResultAnswer[],
): SurveyResults {
  // participant → stage → versionId → answer
  const by = new Map<string, Record<SubmissionStage, Map<string, ResultAnswer>>>()
  for (const a of answers) {
    const p = by.get(a.participantId) ?? { pre: new Map(), post: new Map() }
    p[a.stage].set(a.versionId, a)
    by.set(a.participantId, p)
  }
  const matchedIds = [...by.entries()].filter(([, s]) => s.pre.size > 0 && s.post.size > 0).map(([id]) => id)
  const ordered = [...questions].sort((a, b) => a.sortOrder - b.sortOrder)
  const pairOf = (id: string, versionId: string) => {
    const p = by.get(id)!
    return { pre: p.pre.get(versionId), post: p.post.get(versionId) }
  }

  // Each matched person's career stage and region (their before answers)
  const groupOf = (key: string): { map: Map<string, string>; options: string[] } | null => {
    const q = questions.find(x => x.key === key)
    if (!q) return null
    const map = new Map<string, string>()
    for (const id of matchedIds) {
      const pick = by.get(id)!.pre.get(q.versionId)?.choices?.[0]
      if (pick) map.set(id, pick)
    }
    return { map, options: q.options ?? [] }
  }
  const career = groupOf(CAREER_KEY), region = groupOf(REGION_KEY)

  const results: SurveyResults = {
    matched: matchedIds.length, scales: [], choices: [], afterScales: [], afterChoices: [], who: [], breakdowns: {}, textPairs: [], afterTexts: [],
  }

  for (const q of ordered) {
    if (q.stage === 'both' && q.type === 'likert_5') {
      const pairs = matchedIds.map(id => pairOf(id, q.versionId))
        .filter(p => p.pre?.number != null && p.post?.number != null)
        .map(p => ({ before: p.pre!.number!, after: p.post!.number! }))
      results.scales.push({
        versionId: q.versionId, text: q.text, isCore: q.isCore, minLabel: q.scaleMinLabel, maxLabel: q.scaleMaxLabel,
        n: pairs.length,
        before: mean(pairs.map(p => p.before)),
        after:  mean(pairs.map(p => p.after)),
        higher: pairs.filter(p => p.after > p.before).length,
        same:   pairs.filter(p => p.after === p.before).length,
        lower:  pairs.filter(p => p.after < p.before).length,
        dist:   { before: histogram(pairs.map(p => p.before)), after: histogram(pairs.map(p => p.after)) },
      })

      const breakdown = (groups: Map<string, string>, options: string[]): BreakdownRow[] =>
        options.map(group => {
          const ids = matchedIds.filter(id => groups.get(id) === group)
          const rows = ids.map(id => pairOf(id, q.versionId)).filter(p => p.pre?.number != null && p.post?.number != null)
          const hidden = rows.length < MIN_GROUP
          return {
            group, n: rows.length, hidden,
            before: hidden ? null : mean(rows.map(p => p.pre!.number!)),
            after:  hidden ? null : mean(rows.map(p => p.post!.number!)),
          }
        }).filter(r => r.n > 0)
      results.breakdowns[q.versionId] = {
        career: career ? breakdown(career.map, career.options) : [],
        region: region ? breakdown(region.map, region.options) : [],
      }
    } else if (q.stage === 'both' && (q.type === 'single_choice' || q.type === 'multi_choice' || q.type === 'knowledge_mcq')) {
      const options = q.options ?? []
      const pairs = matchedIds.map(id => pairOf(id, q.versionId)).filter(p => p.pre?.choices && p.post?.choices)
      results.choices.push({
        versionId: q.versionId, text: q.text, options, n: pairs.length,
        before: countOptions(options, pairs.map(p => p.pre!.choices!)),
        after:  countOptions(options, pairs.map(p => p.post!.choices!)),
      })
    } else if (q.stage === 'both' && q.type === 'text') {
      const pairs = matchedIds
        .map(id => ({ id, ...pairOf(id, q.versionId) }))
        .filter(p => p.pre?.text && p.post?.text)
        .map(p => ({ pseudonym: pseudonyms.get(p.id) ?? '?', before: p.pre!.text!, after: p.post!.text! }))
        .sort((a, b) => a.pseudonym.localeCompare(b.pseudonym))
      results.textPairs.push({ versionId: q.versionId, text: q.text, pairs })
    } else if (q.stage === 'post' || q.stage === 'pre') {
      const stage = q.stage
      const given = [...by.entries()].map(([id, s]) => ({ id, a: s[stage].get(q.versionId) })).filter(x => x.a)
      if (q.type === 'likert_5') {
        const values = given.map(x => x.a!.number).filter((v): v is number => v != null)
        const row = { versionId: q.versionId, text: q.text, n: values.length, mean: mean(values), dist: histogram(values) }
        if (stage === 'post') results.afterScales.push(row)
      } else if (q.type === 'text') {
        if (stage === 'post') {
          results.afterTexts.push({
            versionId: q.versionId, text: q.text,
            answers: given.filter(x => x.a!.text).map(x => ({ pseudonym: pseudonyms.get(x.id) ?? '?', text: x.a!.text! }))
              .sort((a, b) => a.pseudonym.localeCompare(b.pseudonym)),
          })
        }
      } else {
        const options = q.options ?? []
        const row = { versionId: q.versionId, text: q.text, options, n: given.length, counts: countOptions(options, given.map(x => x.a!.choices ?? [])) }
        if (stage === 'post') results.afterChoices.push(row)
        else results.who.push(row)
      }
    }
  }
  return results
}
