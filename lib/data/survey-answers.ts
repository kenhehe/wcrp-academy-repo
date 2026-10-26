// Pure: checks a participant's answers against the questions their stage asks and turns
// them into survey_answers values. The submit action runs it on whatever the browser sent.
import type { SurveyQuestionItem } from './surveys.types'

export type AnswerQuestion = Pick<SurveyQuestionItem, 'versionId' | 'type' | 'text' | 'options' | 'isRequired'>

export interface AnswerValues {
  value_number:  number | null
  value_text:    string | null
  value_choices: string[] | null
}

export const MAX_TEXT_ANSWER = 2000

export function checkAnswers(
  questions: AnswerQuestion[],
  raw: Record<string, unknown>,
): { values: Map<string, AnswerValues> } | { error: string; versionId: string } {
  const values = new Map<string, AnswerValues>()
  for (const q of questions) {
    const given = raw?.[q.versionId]
    let value: AnswerValues | null = null
    const options = q.options ?? []

    if (q.type === 'likert_5') {
      if (given !== undefined && given !== null && given !== '') {
        const n = Number(given)
        if (!Number.isInteger(n) || n < 1 || n > 5) return { error: `Pick a number from 1 to 5 for: ${q.text}`, versionId: q.versionId }
        value = { value_number: n, value_text: null, value_choices: null }
      }
    } else if (q.type === 'single_choice' || q.type === 'knowledge_mcq') {
      if (typeof given === 'string' && given !== '') {
        if (!options.includes(given)) return { error: `Pick one of the choices for: ${q.text}`, versionId: q.versionId }
        value = { value_number: null, value_text: null, value_choices: [given] }
      }
    } else if (q.type === 'multi_choice') {
      if (Array.isArray(given) && given.length > 0) {
        const picked = [...new Set(given.map(String))]
        if (picked.some(p => !options.includes(p))) return { error: `Pick from the choices given for: ${q.text}`, versionId: q.versionId }
        value = { value_number: null, value_text: null, value_choices: options.filter(o => picked.includes(o)) }
      }
    } else if (q.type === 'text') {
      const text = typeof given === 'string' ? given.trim() : ''
      if (text.length > MAX_TEXT_ANSWER) return { error: `Keep your answer under ${MAX_TEXT_ANSWER} characters: ${q.text}`, versionId: q.versionId }
      if (text) value = { value_number: null, value_text: text, value_choices: null }
    }

    if (!value && q.isRequired) return { error: `Please answer: ${q.text}`, versionId: q.versionId }
    if (value) values.set(q.versionId, value)
  }
  return { values }
}
