'use client'

// What a participant sees on their phone, for checking the questions. Answers stay in this
// page and are never saved. The real participant page is /s/[slug]/[stage], which uses the
// same SurveyShell and SurveyQuestions.
import { useState } from 'react'
import { Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import SurveyQuestions from '@/components/surveys/SurveyQuestions'
import SurveyShell from '@/components/surveys/SurveyShell'
import type { AnswerValue } from '@/components/surveys/SurveyQuestions/types'
import { SURVEY_CONSENT, type SubmissionStage, type SurveyQuestionItem } from '@/lib/data/surveys.types'

interface Props {
  title:     string
  stage:     SubmissionStage
  minutes:   number
  questions: SurveyQuestionItem[]
}

export default function SurveyPreview({ title, stage, minutes, questions }: Props) {
  const [values, setValues] = useState<Record<string, AnswerValue | undefined>>({})
  const answered = questions.filter(q => values[q.versionId] !== undefined).length

  return (
    <div className="mx-auto w-full max-w-md space-y-3">
      <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <Eye className="size-3.5" aria-hidden="true" />
        Preview: answers here aren&apos;t saved.
      </p>
      <SurveyShell title={title} stage={stage} minutes={minutes}>
        <p className="rounded-lg bg-muted/60 px-3 py-2.5 text-sm text-muted-foreground">{SURVEY_CONSENT}</p>
        {questions.length === 0
          ? <p className="py-8 text-center text-sm text-muted-foreground">This stage asks no questions yet.</p>
          : <SurveyQuestions questions={questions} values={values} onChange={(id, v) => setValues(prev => ({ ...prev, [id]: v }))} />}
        <Button className="mt-2 h-12 w-full text-base" disabled>
          Submit answers
        </Button>
        <p className="mt-2 text-center text-xs text-muted-foreground">{answered} of {questions.length} answered</p>
      </SurveyShell>
    </div>
  )
}
