import type { ReactNode } from 'react'
import type { SubmissionStage } from '@/lib/data/surveys.types'

export interface SurveyShellProps {
  title:     string
  stage?:    SubmissionStage   // shows the "Before-survey · about N minutes" pill
  minutes?:  number
  children:  ReactNode
}
