import Link from 'next/link'
import StatusBadge from '@/components/base/StatusBadge'
import LocalDateTime from '@/components/surveys/LocalDateTime'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { getOverviewSurveys } from '@/lib/data/academy-overview'
import { formatRate } from '@/lib/data/survey-progress'
import type { SurveyListItem } from '@/lib/data/surveys.types'

const MAX_LISTED = 6

function When({ survey }: { survey: SurveyListItem }) {
  if (survey.status === 'draft') {
    return survey.preOpensAt
      ? <>Before-survey opens <LocalDateTime iso={survey.preOpensAt} withYear /></>
      : <>Survey windows not set yet</>
  }
  return survey.afterOpen
    ? <>After-survey closes <LocalDateTime iso={survey.postClosesAt} withYear /></>
    : <>After-survey opens <LocalDateTime iso={survey.postOpensAt} withYear /></>
}

// Active surveys (soonest closing first) and drafts, with how far each has got
export default async function OverviewSurveys() {
  const { active, drafts, closed, closedMatched } = await getOverviewSurveys()
  const listed = [...active, ...drafts].slice(0, MAX_LISTED)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Surveys</CardTitle>
        <CardDescription>Before-and-after answers on Academy events.</CardDescription>
        <CardAction>
          <Link href="/dashboard/academy/surveys" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>All surveys</Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        {listed.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active or draft surveys.</p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {listed.map(s => (
              <li key={s.id} className="flex flex-col gap-2 rounded-lg border p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/dashboard/academy/surveys/${s.slug}`} className="min-w-0 font-medium underline-offset-4 hover:underline">{s.title}</Link>
                  <StatusBadge tone={s.status === 'active' ? 'success' : 'neutral'} className="shrink-0">
                    {s.status === 'active' ? 'Active' : 'Draft'}
                  </StatusBadge>
                </div>
                <p className="text-xs text-muted-foreground"><When survey={s} /></p>
                {s.status === 'active' && (
                  <>
                    {s.afterOpen ? (
                      <div className="flex items-center gap-2">
                        <div
                          role="img"
                          aria-label={`${formatRate(s.progress.matchRate)} of those who answered before also answered after`}
                          className="h-1.5 flex-1 overflow-hidden rounded-full bg-accent"
                        >
                          <div className="h-full rounded-full bg-primary" style={{ width: `${(s.progress.matchRate ?? 0) * 100}%` }} />
                        </div>
                        <span className="shrink-0 text-xs tabular-nums">{s.progress.matched} matched · {formatRate(s.progress.matchRate)}</span>
                      </div>
                    ) : (
                      <p className="text-xs">Matching starts when the after-survey opens</p>
                    )}
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {s.progress.participants} people · {s.progress.pre} answered before · {s.progress.post} after
                    </p>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      {closed > 0 && (
        <CardFooter className="text-sm text-muted-foreground">
          {closed} closed {closed === 1 ? 'survey' : 'surveys'} · {closedMatched.toLocaleString('en-GB')} people matched
        </CardFooter>
      )}
    </Card>
  )
}
