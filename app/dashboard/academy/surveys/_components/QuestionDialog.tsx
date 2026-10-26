'use client'

// Add or edit one of an event's own questions. Used by New survey (kept in local state until
// the survey is created) and by the Setup tab (saved straight away). `onSave` returns an
// error message to show, or null when the question was accepted.
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { checkQuestionInput, normalizeQuestionInput } from '@/lib/data/survey-setup'
import {
  EDITABLE_QUESTION_TYPES, QUESTION_STAGES, QUESTION_STAGE_LABELS, QUESTION_TYPE_LABELS,
  type EditableQuestionType, type QuestionInput, type QuestionStage,
} from '@/lib/data/surveys.types'

export const BLANK_QUESTION: QuestionInput = {
  text: '', type: 'likert_5', stage: 'both', options: [], scaleMinLabel: 'Very low', scaleMaxLabel: 'Very high', isRequired: true,
}

const TYPE_ITEMS  = Object.fromEntries(EDITABLE_QUESTION_TYPES.map(t => [t, QUESTION_TYPE_LABELS[t]]))
const STAGE_ITEMS = Object.fromEntries(QUESTION_STAGES.map(s => [s, QUESTION_STAGE_LABELS[s]]))

interface Props {
  open:          boolean
  onOpenChange:  (open: boolean) => void
  initial?:      QuestionInput
  title:         string
  description?:  string
  lockShape?:    boolean   // core question edit: answer type and stage can't change
  notice?:       React.ReactNode
  onSave:        (question: QuestionInput) => Promise<string | null> | string | null
}

function QuestionForm({ initial, onSave, onCancel, lockShape, notice }: { initial: QuestionInput; onSave: Props['onSave']; onCancel: () => void; lockShape?: boolean; notice?: React.ReactNode }) {
  const [text, setText]           = useState(initial.text)
  const [type, setType]           = useState<EditableQuestionType>(initial.type)
  const [stage, setStage]         = useState<QuestionStage>(initial.stage)
  const [options, setOptions]     = useState(initial.options.join('\n'))
  const [minLabel, setMinLabel]   = useState(initial.scaleMinLabel)
  const [maxLabel, setMaxLabel]   = useState(initial.scaleMaxLabel)
  const [required, setRequired]   = useState(initial.isRequired)
  const [error, setError]         = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const isChoice = type === 'single_choice' || type === 'multi_choice'

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const question = normalizeQuestionInput({
      text, type, stage, options: options.split('\n'), scaleMinLabel: minLabel, scaleMaxLabel: maxLabel, isRequired: required,
    })
    const problem = checkQuestionInput(question)
    if (problem) { setError(problem); return }
    startTransition(async () => {
      setError(await onSave(question))
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="q-text">Question</Label>
        <Textarea id="q-text" value={text} onChange={e => setText(e.target.value)} rows={2} maxLength={300} placeholder="How familiar are you with HighResMIP?" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="q-type">Answer type</Label>
          <Select value={type} onValueChange={v => { if (v) setType(v as EditableQuestionType) }} items={TYPE_ITEMS} disabled={lockShape}>
            <SelectTrigger id="q-type" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {EDITABLE_QUESTION_TYPES.map(t => <SelectItem key={t} value={t}>{QUESTION_TYPE_LABELS[t]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="q-stage">Asked</Label>
          <Select value={stage} onValueChange={v => { if (v) setStage(v as QuestionStage) }} items={STAGE_ITEMS} disabled={lockShape}>
            <SelectTrigger id="q-stage" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {QUESTION_STAGES.map(s => <SelectItem key={s} value={s}>{QUESTION_STAGE_LABELS[s]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      {lockShape ? (
        <p className="text-xs text-muted-foreground">The answer type and when it&apos;s asked stay fixed, so results stay comparable. To change those, retire this question and add a new one.</p>
      ) : stage === 'both' && (
        <p className="text-xs text-muted-foreground">Asked before and after, so results show how answers changed.</p>
      )}
      {isChoice && (
        <div className="space-y-2">
          <Label htmlFor="q-options">Choices, one per line</Label>
          <Textarea id="q-options" value={options} onChange={e => setOptions(e.target.value)} rows={4} placeholder={'Yes, often\nYes, once or twice\nNo'} />
        </div>
      )}
      {type === 'likert_5' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="q-min">What 1 means</Label>
            <Input id="q-min" value={minLabel} onChange={e => setMinLabel(e.target.value)} maxLength={40} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="q-max">What 5 means</Label>
            <Input id="q-max" value={maxLabel} onChange={e => setMaxLabel(e.target.value)} maxLength={40} />
          </div>
        </div>
      )}
      <Label className="flex items-center gap-2 font-normal">
        <Checkbox checked={required} onCheckedChange={v => setRequired(v === true)} />
        People must answer it
      </Label>
      {notice}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={pending}>{pending ? 'Saving…' : 'Save question'}</Button>
      </DialogFooter>
    </form>
  )
}

export default function QuestionDialog({ open, onOpenChange, initial = BLANK_QUESTION, title, description, lockShape, notice, onSave }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description ?? 'A question of this event\'s own, on top of the core questions every survey asks.'}</DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so each opening starts from `initial` */}
        {open && <QuestionForm initial={initial} onSave={onSave} onCancel={() => onOpenChange(false)} lockShape={lockShape} notice={notice} />}
      </DialogContent>
    </Dialog>
  )
}
