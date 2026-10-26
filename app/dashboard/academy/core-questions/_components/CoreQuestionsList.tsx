'use client'

// Core questions: edit (in place, or a new version once answered), add, retire / restore,
// reorder. The rules live server-side in lib/surveys/core-questions.ts.
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { ArrowDown, ArrowUp, Archive, Info, Pencil, Plus, RotateCcw, TriangleAlert } from 'lucide-react'
import StatusBadge from '@/components/base/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import LocalDateTime from '@/components/surveys/LocalDateTime'
import { QUESTION_STAGE_LABELS, QUESTION_TYPE_LABELS, type ActionResult, type EditableQuestionType, type QuestionInput } from '@/lib/data/surveys.types'
import type { CoreQuestionView } from '@/lib/surveys/core-questions'
import { cn } from '@/lib/utils'
import QuestionDialog, { BLANK_QUESTION } from '../../surveys/_components/QuestionDialog'
import { addCore, moveCore, retireCore, saveCore } from '../actions'

const n = (v: number) => v.toLocaleString('en-GB')

const asInput = (q: CoreQuestionView): QuestionInput => {
  const v = q.versions[0]
  return {
    text: v?.text ?? '', type: q.type as EditableQuestionType, stage: q.stage, options: v?.options ?? [],
    scaleMinLabel: v?.scaleMinLabel ?? '', scaleMaxLabel: v?.scaleMaxLabel ?? '', isRequired: v?.isRequired ?? true,
  }
}

function QuestionCard({ q, index, count, pending, onEdit, onRetire, onMove }: {
  q: CoreQuestionView; index: number; count: number; pending: boolean
  onEdit: () => void; onRetire: () => void; onMove: (d: 'up' | 'down') => void
}) {
  const [latest, ...older] = q.versions
  const retired = q.retiredAt !== null
  return (
    <li className={cn('flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start', retired && 'opacity-70')}>
      <span className="w-6 shrink-0 pt-0.5 text-right text-xs tabular-nums text-muted-foreground">{retired ? '–' : index + 1}</span>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm">{latest?.text}</p>
        <p className="text-xs text-muted-foreground">
          {QUESTION_TYPE_LABELS[q.type]} · {QUESTION_STAGE_LABELS[q.stage]}{latest && !latest.isRequired && ' · optional'} · <span className="font-mono">{q.key}</span> · version {latest?.version}
        </p>
        {latest?.options && <p className="text-xs text-muted-foreground">Choices: {latest.options.join(' / ')}</p>}
        {(latest?.scaleMinLabel || latest?.scaleMaxLabel) && <p className="text-xs text-muted-foreground">1 = {latest.scaleMinLabel || '—'}, 5 = {latest.scaleMaxLabel || '—'}</p>}
        <p className="text-xs text-muted-foreground">
          Version {latest?.version}: in {n(latest?.surveys ?? 0)} survey{latest?.surveys === 1 ? '' : 's'}, {n(latest?.answers ?? 0)} answers
          {retired && <> · retired <LocalDateTime iso={q.retiredAt} dateOnly withYear /></>}
        </p>
        {older.length > 0 && (
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground">Earlier versions ({older.length})</summary>
            <ul className="mt-1.5 space-y-1.5 border-l pl-3">
              {older.map(v => (
                <li key={v.versionId}>
                  <span className="text-muted-foreground">Version {v.version} (<LocalDateTime iso={v.createdAt} dateOnly withYear />, {n(v.surveys)} surveys, {n(v.answers)} answers):</span> {v.text}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
      <span className="flex shrink-0 items-center gap-1">
        {retired ? <StatusBadge tone="neutral" icon={Archive}>Retired</StatusBadge> : (
          <>
            <Button variant="ghost" size="icon-sm" aria-label={`Move "${latest?.text}" up`} disabled={index === 0 || pending} onClick={() => onMove('up')}><ArrowUp aria-hidden="true" /></Button>
            <Button variant="ghost" size="icon-sm" aria-label={`Move "${latest?.text}" down`} disabled={index === count - 1 || pending} onClick={() => onMove('down')}><ArrowDown aria-hidden="true" /></Button>
            <Button variant="ghost" size="icon-sm" aria-label={`Edit "${latest?.text}"`} disabled={pending} onClick={onEdit}><Pencil aria-hidden="true" /></Button>
          </>
        )}
        <Button variant="ghost" size="sm" disabled={pending} onClick={onRetire}>
          {retired ? <><RotateCcw data-icon="inline-start" aria-hidden="true" /> Restore</> : <><Archive data-icon="inline-start" aria-hidden="true" /> Retire</>}
        </Button>
      </span>
    </li>
  )
}

export default function CoreQuestionsList({ questions }: { questions: CoreQuestionView[] }) {
  const [editing, setEditing]   = useState<CoreQuestionView | null>(null)
  const [adding, setAdding]     = useState(false)
  const [retiring, setRetiring] = useState<CoreQuestionView | null>(null)
  const [pending, startTransition] = useTransition()

  const active  = questions.filter(q => q.retiredAt === null)
  const retired = questions.filter(q => q.retiredAt !== null)

  async function call<T extends object>(action: () => Promise<ActionResult<T>>): Promise<({ ok: true } & T) | string> {
    try {
      const result = await action()
      return result.ok ? result : result.error
    } catch (err) {
      return err instanceof Error ? err.message : 'Something went wrong'
    }
  }

  function run<T extends object>(action: () => Promise<ActionResult<T>>, done: (r: { ok: true } & T) => void) {
    startTransition(async () => {
      const r = await call(action)
      if (typeof r === 'string') toast.error(r)
      else done(r)
    })
  }

  async function saveEdit(input: QuestionInput): Promise<string | null> {
    if (!editing) return null
    const r = await call(() => saveCore(editing.questionId, input))
    if (typeof r === 'string') return r
    const res = r.result
    toast.success(res.mode === 'edited'
      ? 'Saved'
      : `Version ${res.version} saved`, {
      description: res.mode === 'versioned'
        ? `${res.movedSurveys} survey${res.movedSurveys === 1 ? '' : 's'} nobody has answered yet now use it; ${res.keptSurveys} answered survey${res.keptSurveys === 1 ? '' : 's'} keep version ${res.version - 1}.`
        : undefined,
    })
    setEditing(null)
    return null
  }

  async function saveNew(input: QuestionInput): Promise<string | null> {
    const r = await call(() => addCore(input))
    if (typeof r === 'string') return r
    toast.success('Core question added', { description: 'Every new survey asks it from now on.' })
    setAdding(false)
    return null
  }

  const latest = editing?.versions[0]
  const editNotice = latest && (latest.answers > 0 ? (
    <p className="flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2.5 text-sm">
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
      <span>
        People have answered version {latest.version} ({n(latest.answers)} answers in {n(latest.surveys)} surveys). Saving creates
        version {latest.version + 1}: new surveys and surveys nobody has answered yet use it; answered surveys keep version {latest.version}.
      </span>
    </p>
  ) : (
    <p className="flex items-start gap-2 rounded-lg bg-info-soft px-3 py-2.5 text-sm">
      <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden="true" />
      <span>Nobody has answered this version yet, so the change applies wherever it&apos;s used ({n(latest.surveys)} surveys).</span>
    </p>
  ))

  return (
    <div className="space-y-6">
      <Card className="gap-0 pb-0">
        <CardHeader className="flex flex-wrap items-start justify-between gap-3 pb-4">
          <div className="space-y-1">
            <CardTitle>Asked in every new survey</CardTitle>
            <CardDescription>In this order. Before-only and after-only questions appear only in that survey.</CardDescription>
          </div>
          <Button onClick={() => setAdding(true)} disabled={pending}>
            <Plus data-icon="inline-start" aria-hidden="true" />
            Add a core question
          </Button>
        </CardHeader>
        <ol className={cn('divide-y border-t', pending && 'opacity-60')}>
          {active.map((q, i) => (
            <QuestionCard
              key={q.questionId} q={q} index={i} count={active.length} pending={pending}
              onEdit={() => setEditing(q)}
              onRetire={() => setRetiring(q)}
              onMove={d => run(() => moveCore(q.questionId, d), () => {})}
            />
          ))}
          {active.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted-foreground">No core questions. New surveys would only ask their own questions.</li>}
        </ol>
      </Card>

      {retired.length > 0 && (
        <Card className="gap-0 pb-0">
          <CardHeader className="pb-4">
            <CardTitle>Retired</CardTitle>
            <CardDescription>New surveys don&apos;t ask these. Surveys that already asked them keep them, and their results stay.</CardDescription>
          </CardHeader>
          <ul className="divide-y border-t">
            {retired.map((q, i) => (
              <QuestionCard
                key={q.questionId} q={q} index={i} count={retired.length} pending={pending}
                onEdit={() => {}}
                onRetire={() => run(() => retireCore(q.questionId, false), () => toast.success('Restored: new surveys ask it again'))}
                onMove={() => {}}
              />
            ))}
          </ul>
        </Card>
      )}

      <QuestionDialog
        open={editing !== null}
        onOpenChange={open => { if (!open) setEditing(null) }}
        initial={editing ? asInput(editing) : undefined}
        title="Edit core question"
        description="Every survey asks this question, so its results compare across events."
        lockShape
        notice={editNotice}
        onSave={saveEdit}
      />

      <QuestionDialog
        open={adding}
        onOpenChange={setAdding}
        initial={BLANK_QUESTION}
        title="Add a core question"
        description="Every new survey will ask it, so its results compare across events. Existing surveys don't change."
        onSave={saveNew}
      />

      <AlertDialog open={retiring !== null} onOpenChange={open => { if (!open) setRetiring(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retire this core question?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong className="text-foreground">{retiring?.versions[0]?.text}</strong>: new surveys stop asking it.
              Surveys that already ask it keep it, and their results stay. You can restore it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={pending} onClick={() => {
              const q = retiring
              setRetiring(null)
              if (q) run(() => retireCore(q.questionId, true), () => toast.success('Retired: new surveys won\'t ask it'))
            }}>
              Retire
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
