'use client'

// Setup tab: the questions each stage asks. Core questions are fixed; the event's own can be
// added, edited, removed and reordered until someone answers (then everything locks).
import { useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowDown, ArrowUp, Eye, Lock, Pencil, Plus, Trash2 } from 'lucide-react'
import StatusBadge from '@/components/base/StatusBadge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { questionsForStage } from '@/lib/data/survey-setup'
import {
  QUESTION_STAGE_LABELS, QUESTION_TYPE_LABELS,
  type ActionResult, type EditableQuestionType, type QuestionInput, type SubmissionStage, type SurveyQuestionItem,
} from '@/lib/data/surveys.types'
import { cn } from '@/lib/utils'
import { addSurveyQuestion, moveSurveyQuestion, removeSurveyQuestion, updateSurveyQuestion } from '../../actions'
import QuestionDialog from '../../_components/QuestionDialog'

interface Props {
  surveyId:  string
  slug:      string
  questions: SurveyQuestionItem[]
  locked:    boolean
}

const asInput = (q: SurveyQuestionItem): QuestionInput => ({
  text:          q.text,
  type:          q.type as EditableQuestionType,
  stage:         q.stage,
  options:       q.options ?? [],
  scaleMinLabel: q.scaleMinLabel ?? '',
  scaleMaxLabel: q.scaleMaxLabel ?? '',
  isRequired:    q.isRequired,
})

export default function SetupQuestions({ surveyId, slug, questions, locked }: Props) {
  const [stage, setStage]   = useState<SubmissionStage>('pre')
  const [dialog, setDialog] = useState<{ mode: 'add' } | { mode: 'edit'; item: SurveyQuestionItem } | null>(null)
  const [pending, startTransition] = useTransition()

  const shown = questionsForStage(questions, stage)
  const counts = { pre: questionsForStage(questions, 'pre').length, post: questionsForStage(questions, 'post').length }

  // Runs an action; returns its error for the dialog, or toasts it
  async function run(action: () => Promise<ActionResult>, success?: string): Promise<string | null> {
    try {
      const result = await action()
      if (!result.ok) return result.error
      if (success) toast.success(success)
      return null
    } catch (err) {
      return err instanceof Error ? err.message : 'Something went wrong'
    }
  }

  function act(action: () => Promise<ActionResult>, success?: string) {
    startTransition(async () => {
      const error = await run(action, success)
      if (error) toast.error(error)
    })
  }

  async function saveQuestion(question: QuestionInput): Promise<string | null> {
    const error = dialog?.mode === 'edit'
      ? await run(() => updateSurveyQuestion(surveyId, dialog.item.versionId, question), 'Question saved')
      : await run(() => addSurveyQuestion(surveyId, question), 'Question added')
    if (!error) setDialog(null)
    return error
  }

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <CardTitle>Questions</CardTitle>
          <CardDescription>Core questions are in every survey and can&apos;t change here; the others are this event&apos;s own.</CardDescription>
        </div>
        <div role="group" aria-label="Show the questions of" className="flex gap-2">
          {(['pre', 'post'] as const).map(s => (
            <Button key={s} size="sm" variant={stage === s ? 'default' : 'outline'} aria-pressed={stage === s} onClick={() => setStage(s)}>
              {s === 'pre' ? 'Before-survey' : 'After-survey'} · {counts[s]}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {locked && (
          <p className="flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2.5 text-sm">
            <Lock className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
            Questions are locked: people have already answered. Locking keeps every answer comparable.
          </p>
        )}
        <ol className={cn('divide-y rounded-lg border', pending && 'opacity-60')}>
          {shown.map((q, i) => (
            <li key={q.versionId} className="flex items-center gap-3 px-3 py-2.5">
              <span className="w-5 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm">{q.text}</span>
                <span className="block text-xs text-muted-foreground">
                  {QUESTION_TYPE_LABELS[q.type]} · {QUESTION_STAGE_LABELS[q.stage]}{q.isRequired ? '' : ' · optional'}
                </span>
              </span>
              {q.isCore
                ? <StatusBadge tone="info" icon={Lock}>Core v{q.version}</StatusBadge>
                : <StatusBadge tone="neutral">This event</StatusBadge>}
              {!locked && (
                <span className="flex shrink-0 items-center">
                  <Button variant="ghost" size="icon-sm" aria-label={`Move "${q.text}" up`} disabled={i === 0 || pending}
                    onClick={() => act(() => moveSurveyQuestion(surveyId, q.versionId, 'up', stage))}>
                    <ArrowUp aria-hidden="true" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" aria-label={`Move "${q.text}" down`} disabled={i === shown.length - 1 || pending}
                    onClick={() => act(() => moveSurveyQuestion(surveyId, q.versionId, 'down', stage))}>
                    <ArrowDown aria-hidden="true" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" aria-label={`Edit "${q.text}"`} disabled={q.isCore || pending}
                    onClick={() => setDialog({ mode: 'edit', item: q })}>
                    <Pencil aria-hidden="true" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" aria-label={`Remove "${q.text}"`} disabled={q.isCore || pending}
                    onClick={() => act(() => removeSurveyQuestion(surveyId, q.versionId), 'Question removed')}>
                    <Trash2 aria-hidden="true" />
                  </Button>
                </span>
              )}
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap items-center gap-2">
          {!locked && (
            <Button variant="outline" size="sm" onClick={() => setDialog({ mode: 'add' })}>
              <Plus data-icon="inline-start" aria-hidden="true" />
              Add a question
            </Button>
          )}
          <Link href={`/dashboard/academy/surveys/${slug}/preview?stage=pre`} className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'sm:ml-auto')}>
            <Eye data-icon="inline-start" aria-hidden="true" />
            Preview before-survey
          </Link>
          <Link href={`/dashboard/academy/surveys/${slug}/preview?stage=post`} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
            <Eye data-icon="inline-start" aria-hidden="true" />
            Preview after-survey
          </Link>
        </div>
      </CardContent>

      <QuestionDialog
        open={dialog !== null}
        onOpenChange={open => { if (!open) setDialog(null) }}
        initial={dialog?.mode === 'edit' ? asInput(dialog.item) : undefined}
        title={dialog?.mode === 'edit' ? 'Edit question' : 'Add a question'}
        onSave={saveQuestion}
      />
    </Card>
  )
}
