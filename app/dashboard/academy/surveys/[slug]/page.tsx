import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft, ExternalLink, Eye } from 'lucide-react'
import PageHeader from '@/components/base/PageHeader'
import StatusBadge from '@/components/base/StatusBadge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import LocalDateTime from '@/components/surveys/LocalDateTime'
import { getSurveyBySlug, getSurveyParticipants } from '@/lib/data/surveys'
import { formatRate } from '@/lib/data/survey-progress'
import { cn } from '@/lib/utils'
import SurveyStatusBadge from '../_components/SurveyStatusBadge'
import SetupDetails from './_components/SetupDetails'
import SetupQuestions from './_components/SetupQuestions'
import DeleteSurveyButton from './_components/DeleteSurveyButton'
import ParticipantsTab from './_components/ParticipantsTab'
import SurveyStatusButton from './_components/SurveyStatusButton'
import QrTab from './_components/QrTab'
import SendTab from './_components/SendTab'
import ResultsTab from './_components/ResultsTab'
import ExportTab from './_components/ExportTab'
import { getSendOverview } from '@/lib/surveys/email/overview'

// Sending invites from the Send tab can take a while (up to 50 emails per click)
export const maxDuration = 60

export const dynamic = 'force-dynamic'

interface PageProps {
  params:       Promise<{ slug: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

const TABS = [
  { id: 'setup',        label: 'Setup' },
  { id: 'participants', label: 'Participants' },
  { id: 'send',         label: 'Send' },
  { id: 'qr',           label: 'QR codes' },
  { id: 'results',      label: 'Results' },
  { id: 'export',       label: 'Export' },
] as const
type TabId = typeof TABS[number]['id']

export default async function SurveyPage({ params, searchParams }: PageProps) {
  const [{ slug }, sp] = await Promise.all([params, searchParams])
  const tab: TabId = TABS.find(t => t.id === sp.tab)?.id ?? 'setup'
  const detail = await getSurveyBySlug(slug)
  if (!detail) notFound()
  const { survey, academyEvent, questions, progress, locked, afterOpen } = detail

  const funnel = [
    { value: progress.participants, label: 'participants' },
    { value: progress.pre,          label: 'answered before' },
    ...(afterOpen
      ? [
          { value: progress.post,                  label: 'answered after' },
          { value: progress.matched,               label: 'matched (both)' },
          { value: formatRate(progress.matchRate), label: 'match rate' },
        ]
      : [{ value: <LocalDateTime iso={survey.post_opens_at} dateOnly fallback="—" />, label: 'after-survey opens' }]),
  ]

  return (
    <div className="p-8 space-y-6">
      <Link href="/dashboard/academy/surveys" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" aria-hidden="true" />
        Surveys
      </Link>

      <PageHeader
        eyebrow={
          <span className="flex flex-wrap items-center gap-2">
            <SurveyStatusBadge status={survey.status} />
            <span>
              Before opens <LocalDateTime iso={survey.pre_opens_at} /> · after closes <LocalDateTime iso={survey.post_closes_at} withYear />
            </span>
          </span>
        }
        title={survey.title}
        description={academyEvent ? `Academy event: ${academyEvent.title}` : 'The Academy event is missing'}
        actions={
          <>
            <Link href={`/dashboard/academy/surveys/${slug}/preview?stage=pre`} className={buttonVariants({ variant: 'outline' })}>
              <Eye data-icon="inline-start" aria-hidden="true" />
              Preview as participant
            </Link>
            <SurveyStatusButton surveyId={survey.id} status={survey.status} />
          </>
        }
      />

      <Card className="py-0">
        <dl className="flex flex-wrap">
          {funnel.map(f => (
            <div key={f.label} className="flex min-w-32 flex-1 flex-col-reverse gap-0.5 border-r px-5 py-3 last:border-r-0">
              <dt className="text-xs text-muted-foreground">{f.label}</dt>
              <dd className="text-2xl font-semibold tabular-nums">{f.value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <nav aria-label="Survey sections" className="flex flex-wrap gap-1 border-b">
        {TABS.map(t => (
          <Link
            key={t.id}
            href={t.id === 'setup' ? `/dashboard/academy/surveys/${slug}` : `/dashboard/academy/surveys/${slug}?tab=${t.id}`}
            aria-current={t.id === tab ? 'page' : undefined}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm transition-colors',
              t.id === tab ? 'border-primary font-medium text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === 'results' && <ResultsTab surveyId={survey.id} progress={progress} />}

      {tab === 'export' && <ExportTab slug={slug} />}

      {tab === 'qr' && <QrTab survey={survey} />}

      {tab === 'send' && <SendTab surveyId={survey.id} status={survey.status} overview={await getSendOverview(survey)} />}

      {tab === 'participants' && (
        <ParticipantsTab surveyId={survey.id} surveyStatus={survey.status} participants={await getSurveyParticipants(survey.id)} />
      )}

      {tab === 'setup' && (<>
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <SetupDetails key={survey.updated_at} survey={survey} />
          <Card>
            <CardHeader>
              <CardTitle>Academy event</CardTitle>
              <CardDescription>A survey stays with its event. To use another event, delete this draft and create a new survey.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {academyEvent ? (
                <div className="space-y-1.5 rounded-lg bg-muted/50 p-3">
                  <p className="font-medium">{academyEvent.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {[academyEvent.training_type, academyEvent.lead_organizer, academyEvent.delivery_mode, academyEvent.location].filter(Boolean).join(' · ') || 'No details in the catalogue'}
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-sm">
                    <Link href={`/dashboard/academy/catalogue/${academyEvent.id}/edit`} className="underline underline-offset-4">Open in Catalogue</Link>
                    {academyEvent.permalink && (
                      <a href={academyEvent.permalink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline underline-offset-4">
                        On wcrp-academy.org <ExternalLink className="size-3.5" aria-hidden="true" />
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                <StatusBadge tone="danger">The linked Academy event wasn&apos;t found</StatusBadge>
              )}
            </CardContent>
          </Card>
        </div>

        <SetupQuestions surveyId={survey.id} slug={slug} questions={questions} locked={locked} />

        {survey.status === 'draft' && !locked && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed p-4">
            <p className="text-sm text-muted-foreground">Drafts nobody has answered can be deleted. The Academy event stays.</p>
            <DeleteSurveyButton surveyId={survey.id} title={survey.title} />
          </div>
        )}
      </>)}
    </div>
  )
}
