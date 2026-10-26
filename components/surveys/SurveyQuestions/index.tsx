'use client'

// The questions as a participant sees them: phone-first, large tap targets, native inputs
// (fieldset + legend) so screen readers and keyboards work without extra wiring.
import { cn } from '@/lib/utils'
import type { AnswerValue, SurveyQuestionView, SurveyQuestionsProps } from './types'

const TILE = cn(
  'flex min-h-12 cursor-pointer items-center rounded-lg border border-border bg-muted/40 text-base transition-colors',
  'peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground',
  'peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50 peer-disabled:cursor-default',
)

function Heading({ q, index, total }: { q: SurveyQuestionView; index: number; total: number }) {
  return (
    <>
      <span className="mb-1 block text-xs font-medium text-muted-foreground">
        Question {index + 1} of {total}{q.isRequired ? '' : ' · optional'}
      </span>
      <span className="block text-base font-medium leading-snug">{q.text}</span>
    </>
  )
}

function Likert({ q, value, onChange, disabled }: { q: SurveyQuestionView; value: AnswerValue | undefined; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <>
      <div className="grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map(n => (
          <label key={n} className="relative">
            <input
              type="radio"
              name={q.versionId}
              value={n}
              checked={value === n}
              onChange={() => onChange(n)}
              disabled={disabled}
              className="peer sr-only"
              aria-label={`${n} of 5${n === 1 && q.scaleMinLabel ? `, ${q.scaleMinLabel}` : ''}${n === 5 && q.scaleMaxLabel ? `, ${q.scaleMaxLabel}` : ''}`}
            />
            <span className={cn(TILE, 'justify-center font-semibold')} aria-hidden="true">{n}</span>
          </label>
        ))}
      </div>
      {(q.scaleMinLabel || q.scaleMaxLabel) && (
        <div className="flex justify-between gap-4 text-xs text-muted-foreground" aria-hidden="true">
          <span>{q.scaleMinLabel}</span>
          <span className="text-right">{q.scaleMaxLabel}</span>
        </div>
      )}
    </>
  )
}

function Choices({ q, value, onChange, multi, disabled }: { q: SurveyQuestionView; value: AnswerValue | undefined; onChange: (v: AnswerValue | undefined) => void; multi: boolean; disabled?: boolean }) {
  const picked = Array.isArray(value) ? value : []
  return (
    <div className="flex flex-col gap-2">
      {(q.options ?? []).map(option => (
        <label key={option} className="relative">
          <input
            type={multi ? 'checkbox' : 'radio'}
            name={q.versionId}
            value={option}
            checked={multi ? picked.includes(option) : value === option}
            onChange={e => {
              if (!multi) return onChange(option)
              const next = e.target.checked ? [...picked, option] : picked.filter(o => o !== option)
              onChange(next.length > 0 ? next : undefined)
            }}
            disabled={disabled}
            className="peer sr-only"
          />
          <span className={cn(TILE, 'px-4 text-[15px]')}>{option}</span>
        </label>
      ))}
    </div>
  )
}

export default function SurveyQuestions({ questions, values, onChange, disabled }: SurveyQuestionsProps) {
  return (
    <div className="flex flex-col">
      {questions.map((q, i) => {
        const value = values[q.versionId]
        if (q.type === 'text') {
          return (
            <div key={q.versionId} id={`question-${q.versionId}`} className="flex scroll-mt-4 flex-col gap-3 border-b border-border py-5 last:border-b-0">
              <label htmlFor={`q-${q.versionId}`}><Heading q={q} index={i} total={questions.length} /></label>
              <textarea
                id={`q-${q.versionId}`}
                value={typeof value === 'string' ? value : ''}
                onChange={e => onChange(q.versionId, e.target.value || undefined)}
                disabled={disabled}
                rows={3}
                maxLength={2000}
                placeholder="Your answer"
                className="min-h-24 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>
          )
        }
        return (
          <fieldset key={q.versionId} id={`question-${q.versionId}`} className="flex min-w-0 scroll-mt-4 flex-col gap-3 border-b border-border py-5 last:border-b-0">
            <legend className="contents"><Heading q={q} index={i} total={questions.length} /></legend>
            {q.type === 'likert_5'
              ? <Likert q={q} value={value} onChange={v => onChange(q.versionId, v)} disabled={disabled} />
              : <Choices q={q} value={value} onChange={v => onChange(q.versionId, v)} multi={q.type === 'multi_choice'} disabled={disabled} />}
          </fieldset>
        )
      })}
    </div>
  )
}
