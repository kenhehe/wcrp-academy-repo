import { Suspense } from 'react'
import PageHeader from '@/components/base/PageHeader'
import EventActivitySkeleton from '@/components/charts/EventActivitySkeleton'
import ComingUpSkeleton from '@/components/events/ComingUpSkeleton'
import LighthouseSummarySkeleton from '@/components/events/LighthouseSummarySkeleton'
import { Skeleton } from '@/components/ui/skeleton'
import LastScrape from './_components/LastScrape'
import NeedsAttention from './_components/NeedsAttention'
import OverviewActivity from './_components/OverviewActivity'
import OverviewComingUp from './_components/OverviewComingUp'
import OverviewCoverage from './_components/OverviewCoverage'
import OverviewLighthouse from './_components/OverviewLighthouse'
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
        info="How many of the 7 IPOs' events are in the Academy catalogue (the Lighthouse programmes are counted on a line of their own), what needs doing next, what's coming up, and how the surveys are going. Event counts go by start date, in UTC; confirmed duplicates count once."
        description="Academy coverage, what needs attention, what's coming up, and surveys"
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

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Suspense fallback={<ComingUpSkeleton className="xl:col-span-2" />}>
          <OverviewComingUp />
        </Suspense>
        <Suspense fallback={<LighthouseSummarySkeleton />}>
          <OverviewLighthouse />
        </Suspense>
      </div>

      <Suspense fallback={<SurveysSkeleton />}>
        <OverviewSurveys />
      </Suspense>

      <Suspense fallback={<EventActivitySkeleton />}>
        <OverviewActivity />
      </Suspense>
    </div>
  )
}
