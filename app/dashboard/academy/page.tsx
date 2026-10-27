import { Suspense } from 'react'
import PageHeader from '@/components/base/PageHeader'
import EventActivitySkeleton from '@/components/charts/EventActivitySkeleton'
import { Skeleton } from '@/components/ui/skeleton'
import LastScrape from './_components/LastScrape'
import NeedsAttention from './_components/NeedsAttention'
import OverviewActivity from './_components/OverviewActivity'
import OverviewCoverage from './_components/OverviewCoverage'
import OverviewSurveys from './_components/OverviewSurveys'
import OverviewTiles from './_components/OverviewTiles'
import { AttentionSkeleton, CoverageSkeleton, SurveysSkeleton, TilesSkeleton } from './_components/OverviewSkeletons'

export const dynamic = 'force-dynamic'

// The Academy team's overview. The header renders at once; each section loads on its own
// behind a skeleton of its shape (loaders in lib/data/academy-overview.ts).
export default function AcademyOverviewPage() {
  const todayLabel = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date())

  return (
    <div className="p-8 space-y-8">
      <PageHeader
        eyebrow={todayLabel}
        title="Overview"
        info="How many of the 7 IPOs' events are in the Academy catalogue, what needs doing next, and how the surveys are going. Event counts go by start date, in UTC; confirmed duplicates count once."
        description="Academy coverage, what needs attention, and surveys"
        actions={
          <Suspense fallback={<Skeleton className="h-4 w-48" />}>
            <LastScrape />
          </Suspense>
        }
      />

      <Suspense fallback={<TilesSkeleton />}>
        <OverviewTiles />
      </Suspense>

      <Suspense fallback={<AttentionSkeleton />}>
        <NeedsAttention />
      </Suspense>

      <Suspense fallback={<CoverageSkeleton />}>
        <OverviewCoverage />
      </Suspense>

      <Suspense fallback={<SurveysSkeleton />}>
        <OverviewSurveys />
      </Suspense>

      <Suspense fallback={<EventActivitySkeleton />}>
        <OverviewActivity />
      </Suspense>
    </div>
  )
}
