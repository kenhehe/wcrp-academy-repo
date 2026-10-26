'use client'

// The participant's way through one survey stage: who are you → consent → questions →
// thank you. Every step that matters is re-checked on the server (app/s/actions.ts).
import { useState, useTransition } from 'react'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import LocalDateTime from '@/components/surveys/LocalDateTime'
import SurveyQuestions from '@/components/surveys/SurveyQuestions'
import SurveyShell from '@/components/surveys/SurveyShell'
import type { AnswerValue, SurveyQuestionView } from '@/components/surveys/SurveyQuestions/types'
import { suggestEmailFix } from '@/lib/data/survey-participants'
import { SURVEY_CONSENT, type SubmissionStage } from '@/lib/data/surveys.types'
import { forgetDevice, startWithEmail, submitAnswers, type SubmitResult } from '@/app/s/actions'

export type RunnerIdentity =
  | { via: 'token' | 'cookie'; masked: string }
  | { via: 'none' }

interface Props {
  slug:       string
  stage:      SubmissionStage
  title:      string
  minutes:    number
  questions:  SurveyQuestionView[]
  identity:   RunnerIdentity
  token:      string | null   // their personal-link token, when it's valid
  badToken:   boolean         // a token was in the link but didn't match anyone
  answeredAt: string | null   // they already answered this stage
}

type Screen = 'email' | 'continue' | 'already' | 'consent' | 'questions' | 'done'

export default function SurveyRunner({ slug, stage, title, minutes, questions, identity, token, badToken, answeredAt }: Props) {
  const [who, setWho] = useState<{ via: 'token' | 'cookie' | 'email'; masked: string } | null>(identity.via === 'none' ? null : identity)
  const [screen, setScreen] = useState<Screen>(
    answeredAt && identity.via !== 'none' ? 'already'
    : identity.via === 'token' ? 'consent'
    : identity.via === 'cookie' ? 'continue'
    : 'email',
  )
  const [email, setEmail]     = useState('')
  const [values, setValues]   = useState<Record<string, AnswerValue | undefined>>({})
  const [error, setError]     = useState<string | null>(badToken ? 'This personal link didn\'t work. Enter your email instead.' : null)
  const [result, setResult]   = useState<Extract<SubmitResult, { ok: true }> | null>(null)
  const [pending, startTransition] = useTransition()

  const suggestion = suggestEmailFix(email)
  const answered = questions.filter(q => values[q.versionId] !== undefined).length

  function handleEmail(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const res = await startWithEmail(slug, stage, email)
      if (!res.ok) { setError(res.error); return }
      setWho({ via: 'email', masked: res.masked })
      setScreen('consent')
    })
  }

  function notMe() {
    startTransition(async () => {
      await forgetDevice()
      setWho(null)
      setError(null)
      setScreen('email')
    })
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const res = await submitAnswers(slug, stage, values, who?.via === 'token' ? token : null, who?.via ?? 'cookie')
      if (!res.ok) {
        setError(res.error)
        if (res.versionId) document.getElementById(`question-${res.versionId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        return
      }
      setResult(res)
      setScreen('done')
      window.scrollTo({ top: 0 })
    })
  }

  const errorLine = error && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2.5 text-sm text-danger">{error}</p>

  return (
    <SurveyShell title={title} stage={stage} minutes={minutes}>
      {screen === 'email' && (
        <form onSubmit={handleEmail} className="space-y-4">
          <div className="space-y-1.5">
            <h2 className="text-xl font-semibold">Enter your email to start</h2>
            <p className="text-sm text-muted-foreground">
              Use the email you registered with. It links your before and after answers; nobody sees it next to your answers.
            </p>
          </div>
          {errorLine}
          <div className="space-y-2">
            <Label htmlFor="p-email">Your email</Label>
            <Input id="p-email" type="email" inputMode="email" autoComplete="email" required value={email}
              onChange={e => setEmail(e.target.value)} className="h-12 text-base" />
          </div>
          {suggestion && (
            <p role="status" className="flex items-center justify-between gap-2 rounded-lg bg-warning-soft px-3 py-2 text-sm">
              <span>Did you mean <strong>{suggestion}</strong>?</span>
              <Button type="button" variant="ghost" size="sm" onClick={() => setEmail(suggestion)}>Yes, use it</Button>
            </p>
          )}
          <Button type="submit" className="h-12 w-full text-base" disabled={pending}>{pending ? 'One moment…' : 'Continue'}</Button>
          <p className="text-xs text-muted-foreground">Got the survey by email? Your personal link skips this step.</p>
        </form>
      )}

      {screen === 'continue' && who && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Welcome back</h2>
          <p className="text-sm text-muted-foreground">This device has answered a survey before. Continue as</p>
          <p className="text-lg font-semibold">{who.masked}?</p>
          <Button className="h-12 w-full text-base" onClick={() => setScreen('consent')}>Continue</Button>
          <Button variant="ghost" className="w-full" onClick={notMe} disabled={pending}>Not you? Use a different email</Button>
        </div>
      )}

      {screen === 'already' && who && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">You&apos;ve already answered</h2>
          <p className="text-sm text-muted-foreground">
            Thank you! We received your answers{answeredAt && <> on <LocalDateTime iso={answeredAt} /></>}.
          </p>
          {who.via === 'token' && (
            <Button variant="outline" className="w-full" onClick={() => setScreen('consent')}>Change my answers</Button>
          )}
          <Button variant="ghost" className="w-full" onClick={notMe} disabled={pending}>Not {who.masked}? Use a different email</Button>
        </div>
      )}

      {screen === 'consent' && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Before you start</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{SURVEY_CONSENT}</p>
          <Button className="h-12 w-full text-base" onClick={() => setScreen('questions')}>Start the survey</Button>
          {who && (
            <p className="text-center text-xs text-muted-foreground">
              Answering as {who.masked} ·{' '}
              <button type="button" onClick={notMe} className="cursor-pointer underline underline-offset-4">Not you?</button>
            </p>
          )}
        </div>
      )}

      {screen === 'questions' && (
        <form onSubmit={submit} noValidate>
          <SurveyQuestions questions={questions} values={values} onChange={(id, v) => setValues(prev => ({ ...prev, [id]: v }))} disabled={pending} />
          <div className="sticky bottom-0 -mx-5 space-y-2 border-t bg-background px-5 pt-3 pb-4">
            {errorLine}
            <Button type="submit" className="h-12 w-full text-base" disabled={pending}>{pending ? 'Saving…' : 'Submit answers'}</Button>
            <p className="text-center text-xs text-muted-foreground">{answered} of {questions.length} answered</p>
          </div>
        </form>
      )}

      {screen === 'done' && result && (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-success-soft text-success">
            <Check className="size-7" aria-hidden="true" />
          </span>
          <h2 className="text-xl font-semibold">Thank you!</h2>
          <p className="text-sm text-muted-foreground">
            {result.outcome === 'replaced' ? 'Your answers are updated.' : 'Your answers are saved.'}{' '}
            {stage === 'post'
              ? 'You can close this page.'
              : result.confirmationSent
                ? 'We\'ve emailed you a link for the after-survey: keep it for when the event ends.'
                : 'We\'ll email you the link to the after-survey when the event ends.'}
          </p>
        </div>
      )}
    </SurveyShell>
  )
}
