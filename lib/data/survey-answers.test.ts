import { describe, expect, it } from 'vitest'
import { checkAnswers, type AnswerQuestion } from './survey-answers'

const Q: AnswerQuestion[] = [
  { versionId: 'scale',  type: 'likert_5',      text: 'Understanding?', options: null, isRequired: true },
  { versionId: 'one',    type: 'single_choice', text: 'Career stage?',  options: ['Student', 'Senior'], isRequired: true },
  { versionId: 'many',   type: 'multi_choice',  text: 'Tools?',         options: ['R', 'Python', 'Julia'], isRequired: false },
  { versionId: 'words',  type: 'text',          text: 'Feedback?',      options: null, isRequired: false },
]

describe('checkAnswers', () => {
  it('turns valid answers into stored values and skips optional ones left empty', () => {
    const result = checkAnswers(Q, { scale: 4, one: 'Senior', many: ['Julia', 'R', 'R'], words: '  ' })
    expect('values' in result && Object.fromEntries(result.values)).toEqual({
      scale: { value_number: 4, value_text: null, value_choices: null },
      one:   { value_number: null, value_text: null, value_choices: ['Senior'] },
      many:  { value_number: null, value_text: null, value_choices: ['R', 'Julia'] },
    })
  })

  it('asks for required answers', () => {
    expect(checkAnswers(Q, { one: 'Senior' })).toEqual({ error: 'Please answer: Understanding?', versionId: 'scale' })
  })

  it('refuses values the question doesn\'t offer', () => {
    expect(checkAnswers(Q, { scale: 6, one: 'Senior' })).toMatchObject({ versionId: 'scale' })
    expect(checkAnswers(Q, { scale: 2.5, one: 'Senior' })).toMatchObject({ versionId: 'scale' })
    expect(checkAnswers(Q, { scale: 3, one: 'Professor' })).toMatchObject({ versionId: 'one' })
    expect(checkAnswers(Q, { scale: 3, one: 'Senior', many: ['Fortran'] })).toMatchObject({ versionId: 'many' })
    expect(checkAnswers(Q, { scale: 3, one: 'Senior', words: 'x'.repeat(2001) })).toMatchObject({ versionId: 'words' })
  })

  it('ignores answers to questions this stage doesn\'t ask', () => {
    const result = checkAnswers(Q, { scale: '5', one: 'Student', other: 'sneaky' })
    expect('values' in result && [...result.values.keys()]).toEqual(['scale', 'one'])
  })
})
