import Link from 'next/link'
import { ClipboardList, Plus } from 'lucide-react'
import PageHeader from '@/components/base/PageHeader'
import StatTile from '@/components/base/StatTile'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import LocalDateTime from '@/components/surveys/LocalDateTime'
import { getSurveyList } from '@/lib/data/surveys'
import { formatRate, sumProgress } from '@/lib/data/survey-progress'
import { SURVEY_STATUSES, SURVEY_STATUS_LABELS, type SurveyStatus } from '@/lib/data/surveys.types'
import { cn } from '@/lib/utils'
import SurveyStatusBadge from './_components/SurveyStatusBadge'
import MatchRateMeter from './_components/MatchRateMeter'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

const isStatus = (v: unknown): v is SurveyStatus => (SURVEY_STATUSES as readonly unknown[]).includes(v)

export default async function SurveysPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const statusFilter = isStatus(sp.status) ? sp.status : undefined

  const surveys = await getSurveyList()
  const shown   = statusFilter ? surveys.filter(s => s.status === statusFilter) : surveys
  const totals  = sumProgress(surveys.map(s => s.progress))
  // Only surveys whose after-survey has opened can have matches yet
  const rated   = sumProgress(surveys.filter(s => s.afterOpen).map(s => s.progress))
  const count   = (status: SurveyStatus) => surveys.filter(s => s.status === status).length

  const filters: { label: string; status?: SurveyStatus; n: number }[] = [
    { label: 'All', n: surveys.length },
    ...SURVEY_STATUSES.map(status => ({ label: SURVEY_STATUS_LABELS[status], status, n: count(status) })),
  ]

  return (
    <div className="p-8 space-y-6">
      <PageHeader
        title="Surveys"
        info={
          <>
            Each survey belongs to one Academy event and asks the same questions before and after it, so
            results show what changed for the people who answered both (matched). Results never show who
            gave which answer.
          </>
        }
        description="Before and after surveys on Academy events"
        actions={
          <Link href="/dashboard/academy/surveys/new" className={buttonVariants()}>
            <Plus data-icon="inline-start" aria-hidden="true" />
            New survey
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Active surveys" value={count('active')} sub={`${count('draft')} draft · ${count('closed')} closed`} />
        <StatTile label="Matched participants" value={totals.matched.toLocaleString('en-GB')} sub="Answered before and after" />
        <StatTile
          label="Match rate"
          value={formatRate(rated.matchRate)}
          sub={rated.pre > 0
            ? `${rated.matched} of ${rated.pre} who answered before also answered after (surveys whose after-survey has opened)`
            : 'Shows once people answer an after-survey'}
        />
        <StatTile label="Needs review" value={totals.flagged} sub="Repeat answers given by typing an email" />
      </div>

      {surveys.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <ClipboardList className="size-8 text-muted-foreground" aria-hidden="true" />
            <p className="font-medium">No surveys yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Pick an Academy event, set when its before and after surveys open, and add any questions of your own.
            </p>
            <Link href="/dashboard/academy/surveys/new" className={buttonVariants({ variant: 'outline' })}>
              <Plus data-icon="inline-start" aria-hidden="true" />
              New survey
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card className="gap-0 py-0">
          <nav aria-label="Filter by status" className="flex flex-wrap gap-2 border-b p-4">
            {filters.map(f => {
              const active = f.status === statusFilter
              return (
                <Link
                  key={f.label}
                  href={f.status ? `/dashboard/academy/surveys?status=${f.status}` : '/dashboard/academy/surveys'}
                  aria-current={active ? 'page' : undefined}
                  className={buttonVariants({ variant: active ? 'default' : 'outline', size: 'sm' })}
                >
                  {f.label} <span className={cn('tabular-nums', !active && 'text-muted-foreground')}>{f.n}</span>
                </Link>
              )
            })}
          </nav>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="pl-4">Survey</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Open</TableHead>
                <TableHead className="text-right">Before</TableHead>
                <TableHead className="text-right">After</TableHead>
                <TableHead className="text-right">Matched</TableHead>
                <TableHead className="pr-4">Match rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                    No {statusFilter ? SURVEY_STATUS_LABELS[statusFilter].toLowerCase() : ''} surveys.
                  </TableCell>
                </TableRow>
              )}
              {shown.map(s => (
                <TableRow key={s.id}>
                  <TableCell className="pl-4">
                    <Link href={`/dashboard/academy/surveys/${s.slug}`} className="font-medium hover:underline">{s.title}</Link>
                    <span className="block max-w-md truncate text-xs text-muted-foreground">
                      {[s.eventTitle, s.trainingType].filter(Boolean).join(' · ')}
                    </span>
                  </TableCell>
                  <TableCell><SurveyStatusBadge status={s.status} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    <LocalDateTime iso={s.preOpensAt} dateOnly /> to <LocalDateTime iso={s.postClosesAt} dateOnly withYear />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{s.progress.pre}</TableCell>
                  {s.afterOpen ? (
                    <>
                      <TableCell className="text-right tabular-nums">{s.progress.post}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{s.progress.matched}</TableCell>
                      <TableCell className="pr-4"><MatchRateMeter progress={s.progress} label={s.title} /></TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell className="text-right text-muted-foreground">—</TableCell>
                      <TableCell className="text-right text-muted-foreground">—</TableCell>
                      <TableCell className="pr-4 text-sm text-muted-foreground">
                        After opens <LocalDateTime iso={s.postOpensAt} dateOnly fallback="once dates are set" />
                      </TableCell>
                    </>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}
