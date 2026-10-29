'use client'

// New survey: (1) pick the Academy event, or none for a stand-alone survey, (2) the survey
// windows, (3) questions, (4) the emails it will send. Nothing is saved until "Create draft";
// the server action re-checks everything. The event's details and dates come from the catalogue
// and aren't edited here.
import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CircleCheck, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import StatusBadge from '@/components/base/StatusBadge'
import SyncAcademyButton from '@/components/academy/SyncAcademyButton'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  checkSurveyTimes, checkTitle, eventFromCatalogue, questionsForStage, resolveSurveyTimes, type LocalTimes,
} from '@/lib/data/survey-setup'
import {
  QUESTION_STAGE_LABELS, QUESTION_TYPE_LABELS,
  type CatalogueOption, type QuestionInput, type SurveyQuestionItem,
} from '@/lib/data/surveys.types'
import { cn } from '@/lib/utils'
import { createSurvey } from '../../actions'
import QuestionDialog from '../../_components/QuestionDialog'
import SurveyTimesFields from '../../_components/SurveyTimesFields'

const MAX_LISTED = 100
const EMPTY_TIMES: LocalTimes = { eventStart: '', eventEnd: '', windows: {} }

const EMAILS: [string, string][] = [
  ['Before-survey invite', 'when the before-survey opens'],
  ['Before-survey reminder', '24 h before it closes, to people who haven\'t answered'],
  ['Thank-you with the after-survey link', 'to people who answered the before-survey by QR code'],
  ['After-survey invite', 'when the after-survey opens'],
  ['After-survey reminders', '1 h and 24 h after it opens, and 24 h before it closes, to people who answered before but not after'],
]

// '2026-11-18' → '18 Nov 2026', the same on server and browser
const day = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`))

type OwnQuestion = QuestionInput & { id: string }

type EventMode = 'catalogue' | 'none'

const EVENT_MODES: { id: EventMode; label: string; detail: string }[] = [
  { id: 'catalogue', label: 'An Academy catalogue event', detail: 'Pick it below; the survey windows are suggested from its dates.' },
  { id: 'none',      label: 'No event',                   detail: 'A stand-alone survey: you name it and set the survey windows yourself.' },
]

interface Props {
  catalogue: CatalogueOption[]
  core:      SurveyQuestionItem[]
}

function Step({ n, title, children, description }: { n: number; title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5">
          <span className="flex size-6 items-center justify-center rounded-full bg-accent text-xs font-semibold text-primary" aria-hidden="true">{n}</span>
          {title}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  )
}

export default function NewSurveyForm({ catalogue, core }: Props) {
  const router = useRouter()
  const [query, setQuery]       = useState('')
  const [mode, setMode]         = useState<EventMode>('catalogue')
  const [eventId, setEventId]   = useState<string | null>(null)
  const [title, setTitle]       = useState<string | null>(null)   // null: use the event's title
  const [times, setTimes]       = useState<LocalTimes>(EMPTY_TIMES)
  const [showCore, setShowCore] = useState(false)
  const [own, setOwn]           = useState<OwnQuestion[]>([])
  const [dialog, setDialog]     = useState<{ mode: 'add' } | { mode: 'edit'; id: string } | null>(null)
  const [pending, startTransition] = useTransition()

  const standalone = mode === 'none'
  const selected   = standalone ? null : catalogue.find(e => e.id === eventId) ?? null
  const name       = title ?? selected?.title ?? ''

  const q = query.trim().toLowerCase()
  const matches = q
    ? catalogue.filter(e => [e.title, e.trainingType, e.organiser].some(v => v?.toLowerCase().includes(q)))
    : catalogue
  const listed = matches.slice(0, MAX_LISTED)

  const resolved   = resolveSurveyTimes(times)
  const timesIssue = checkSurveyTimes(resolved.iso)

  const preCount  = questionsForStage(core, 'pre').length  + own.filter(o => o.stage !== 'post').length
  const postCount = questionsForStage(core, 'post').length + own.filter(o => o.stage !== 'pre').length
  const corePre   = questionsForStage(core, 'pre').length
  const corePost  = questionsForStage(core, 'post').length

  const checks = [
    standalone
      ? { ok: true, label: 'Event', detail: 'None: a stand-alone survey' }
      : { ok: Boolean(selected && !selected.hasSurvey), label: 'Event', detail: selected?.title ?? 'Pick one from the catalogue' },
    { ok: !checkTitle(name), label: 'Survey name', detail: name.trim() || 'Give it a name' },
    {
      ok:     !timesIssue,
      label:  'Survey windows',
      detail: timesIssue ?? (resolved.edited || !times.eventStart ? 'Set' : 'Suggested from the catalogue dates'),
    },
    { ok: true, label: 'Questions', detail: `${preCount} before · ${postCount} after (${own.length} of your own)` },
  ]
  const ready = checks.every(c => c.ok)

  // Switching starts the event, name and windows over
  function chooseMode(next: EventMode) {
    setMode(next)
    setEventId(null)
    setTitle(null)
    setTimes(EMPTY_TIMES)
  }

  function pick(e: CatalogueOption) {
    setEventId(e.id)
    setTitle(null)
    setTimes({ ...eventFromCatalogue(e.startDate, e.endDate), windows: {} })
  }

  function saveQuestion(question: QuestionInput): null {
    if (dialog?.mode === 'edit') {
      setOwn(list => list.map(o => (o.id === dialog.id ? { ...question, id: o.id } : o)))
    } else {
      setOwn(list => [...list, { ...question, id: crypto.randomUUID() }])
    }
    setDialog(null)
    return null
  }

  function handleCreate() {
    if (!ready || (!standalone && !selected)) return
    startTransition(async () => {
      try {
        const result = await createSurvey({
          academyEventId: selected?.id ?? null,
          title:          name,
          ...resolved.iso,
          questions:      own.map(o => ({
            text: o.text, type: o.type, stage: o.stage, options: o.options,
            scaleMinLabel: o.scaleMinLabel, scaleMaxLabel: o.scaleMaxLabel, isRequired: o.isRequired,
          })),
        })
        if (!result.ok) { toast.error(result.error); return }
        toast.success('Draft created', { description: 'Nothing is sent until you add participants and switch sending on.' })
        router.push(`/dashboard/academy/surveys/${result.slug}`)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not create the survey')
      }
    })
  }

  const editing = dialog?.mode === 'edit' ? own.find(o => o.id === dialog.id) : undefined

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-6">
        <Step n={1} title="Event" description="What the survey is about: an Academy catalogue event (one survey each), or no event at all.">
          <div role="radiogroup" aria-label="What the survey is about" className="grid gap-2 sm:grid-cols-2">
            {EVENT_MODES.map(m => (
              <label
                key={m.id}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 hover:bg-muted/50',
                  mode === m.id && 'border-primary bg-accent hover:bg-accent',
                )}
              >
                <input
                  type="radio"
                  name="event-mode"
                  checked={mode === m.id}
                  onChange={() => chooseMode(m.id)}
                  className="mt-0.5 size-4 shrink-0 accent-primary"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{m.label}</span>
                  <span className="block text-xs text-muted-foreground">{m.detail}</span>
                </span>
              </label>
            ))}
          </div>

          {!standalone && (
            <>
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  type="search"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search the Academy catalogue"
                  aria-label="Search the Academy catalogue"
                  className="pl-8"
                />
              </div>
              <div role="radiogroup" aria-label="Academy events" className="max-h-80 overflow-y-auto rounded-lg border">
                {listed.length === 0 && (
                  <p className="p-4 text-sm text-muted-foreground">
                    {q
                      ? <>No upcoming, ongoing or on-demand Academy event matches “{query}”.</>
                      : 'No upcoming, ongoing or on-demand events in the Academy catalogue.'}
                  </p>
                )}
                {listed.map(e => {
                  const checked = e.id === eventId
                  return (
                    <label
                      key={e.id}
                      className={cn(
                        'flex items-center gap-3 border-t px-3 py-2.5 first:border-t-0',
                        e.hasSurvey ? 'cursor-default opacity-60' : 'cursor-pointer hover:bg-muted/50',
                        checked && 'bg-accent hover:bg-accent',
                      )}
                    >
                      <input
                        type="radio"
                        name="academy-event"
                        checked={checked}
                        disabled={e.hasSurvey}
                        onChange={() => pick(e)}
                        className="size-4 shrink-0 accent-primary"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{e.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {[e.trainingType, e.organiser, e.deliveryMode].filter(Boolean).join(' · ') || 'No details in the catalogue'}
                        </span>
                      </span>
                      {e.hasSurvey
                        ? <StatusBadge tone="info">Has a survey</StatusBadge>
                        : e.startDate
                          ? <span className="shrink-0 text-xs text-muted-foreground">{day(e.startDate)}</span>
                          : e.status === 'On Demand'
                            ? <StatusBadge tone="neutral">On demand</StatusBadge>
                            : <StatusBadge tone="warning">No date</StatusBadge>}
                    </label>
                  )
                })}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
                <p>
                  {matches.length > MAX_LISTED && `Showing ${MAX_LISTED} of ${matches.length}; search to narrow it down. `}
                  Past events aren&apos;t listed: they&apos;re over, so there&apos;s nothing to survey before them.
                  Missing an event, or its details are wrong? Add or fix it on{' '}
                  <a href="https://wcrp-academy.org/wp-admin/edit.php?post_type=catalogues" target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:text-foreground">WordPress</a>,
                  then sync.
                </p>
                <SyncAcademyButton />
              </div>
            </>
          )}
          <div className="space-y-2">
            <Label htmlFor="s-name">Name participants see</Label>
            <Input id="s-name" value={name} onChange={e => setTitle(e.target.value)} maxLength={200} disabled={!standalone && !selected} />
            <p className="text-xs text-muted-foreground">
              {standalone
                ? 'Shown at the top of the survey and in emails.'
                : <>Starts as the catalogue title; shorten it if it&apos;s long. Shown at the top of the survey and in emails.</>}
            </p>
          </div>
        </Step>

        <Step n={2} title="Survey windows" description="When people can answer before and after the event.">
          {selected || standalone ? (
            <SurveyTimesFields value={times} onChange={setTimes} noEvent={standalone} />
          ) : (
            <p className="text-sm text-muted-foreground">Pick the Academy event first, or choose No event.</p>
          )}
        </Step>

        <Step n={3} title="Questions">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2.5">
            <span className="text-sm">
              <span className="block font-medium">Core questions are included</span>
              <span className="text-muted-foreground">{corePre} in the before-survey, {corePost} in the after-survey; the same in every survey, so results compare across events.</span>
            </span>
            <Button type="button" variant="outline" size="sm" aria-expanded={showCore} onClick={() => setShowCore(v => !v)}>
              {showCore ? 'Hide core questions' : 'Show core questions'}
            </Button>
          </div>
          {showCore && (
            <ul className="divide-y text-sm">
              {core.map(c => (
                <li key={c.versionId} className="flex items-center justify-between gap-3 py-2">
                  <span>{c.text}</span>
                  <StatusBadge tone="neutral">{QUESTION_STAGE_LABELS[c.stage]}</StatusBadge>
                </li>
              ))}
            </ul>
          )}

          <div className="space-y-1 pt-2">
            <p className="text-sm font-medium">{standalone ? 'This survey\'s own questions' : <>This event&apos;s own questions</>}</p>
            <p className="text-xs text-muted-foreground">Optional. Ask the same question before and after to measure the change.</p>
          </div>
          {own.length > 0 && (
            <ul className="divide-y rounded-lg border">
              {own.map(o => (
                <li key={o.id} className="flex items-center gap-3 px-3 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm">{o.text}</span>
                    <span className="block text-xs text-muted-foreground">{QUESTION_TYPE_LABELS[o.type]} · {QUESTION_STAGE_LABELS[o.stage]}{o.isRequired ? '' : ' · optional'}</span>
                  </span>
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={`Edit "${o.text}"`} onClick={() => setDialog({ mode: 'edit', id: o.id })}>
                    <Pencil aria-hidden="true" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove "${o.text}"`} onClick={() => setOwn(list => list.filter(x => x.id !== o.id))}>
                    <Trash2 aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <Button type="button" variant="outline" size="sm" onClick={() => setDialog({ mode: 'add' })}>
            <Plus data-icon="inline-start" aria-hidden="true" />
            Add a question
          </Button>
        </Step>

        <Step n={4} title="Emails" description="Sent from WCRP Academy <office@wcrp-academy.org> to the people on the participant list.">
          <ul className="divide-y text-sm">
            {EMAILS.map(([what, when]) => (
              <li key={what} className="py-2">
                <span className="font-medium">{what}</span>
                <span className="text-muted-foreground">: {when}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            You add participants after creating the survey. Nothing is sent from a draft; sending is switched on later, on the survey&apos;s Send tab.
          </p>
        </Step>
      </div>

      <Card className="lg:sticky lg:top-6">
        <CardHeader>
          <CardTitle>Ready to create?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="divide-y">
            {checks.map(c => (
              <li key={c.label} className="flex items-start gap-2.5 py-2.5 first:pt-0">
                {c.ok
                  ? <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-label="Done" />
                  : <span className="mt-0.5 size-4 shrink-0 rounded-full border-[1.5px] border-dashed border-muted-foreground" aria-label="To do" />}
                <span className="min-w-0 text-sm">
                  <span className="block font-medium">{c.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">{c.detail}</span>
                </span>
              </li>
            ))}
          </ul>
          <Button type="button" className="w-full" disabled={!ready || pending} onClick={handleCreate}>
            {pending ? 'Creating…' : 'Create draft'}
          </Button>
          <Link href="/dashboard/academy/surveys" className={cn(buttonVariants({ variant: 'ghost' }), 'w-full')}>Cancel</Link>
          <p className="text-xs text-muted-foreground">It starts as a draft. Nothing is sent until you add participants and switch sending on.</p>
        </CardContent>
      </Card>

      <QuestionDialog
        open={dialog !== null}
        onOpenChange={open => { if (!open) setDialog(null) }}
        initial={editing}
        title={dialog?.mode === 'edit' ? 'Edit question' : 'Add a question'}
        onSave={saveQuestion}
      />
    </div>
  )
}
