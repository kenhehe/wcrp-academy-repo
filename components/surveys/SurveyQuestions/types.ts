import type { SurveyQuestionItem } from '@/lib/data/surveys.types'

export type AnswerValue = number | string | string[]

export type SurveyQuestionView = Pick<
  SurveyQuestionItem,
  'versionId' | 'type' | 'text' | 'options' | 'scaleMinLabel' | 'scaleMaxLabel' | 'isRequired'
>

export interface SurveyQuestionsProps {
  questions: SurveyQuestionView[]
  values:    Record<string, AnswerValue | undefined>   // by versionId
  onChange:  (versionId: string, value: AnswerValue | undefined) => void
  disabled?: boolean
}
