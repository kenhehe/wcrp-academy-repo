import { Skeleton } from '@/components/ui/skeleton'
import EventActivitySkeleton from '@/components/charts/EventActivitySkeleton'
import { AttentionSkeleton, CoverageSkeleton, SurveysSkeleton, TilesSkeleton } from './_components/OverviewSkeletons'

// Same shapes as the page's Suspense fallbacks, so arriving on the overview and its sections
// streaming in look the same
export default function AcademyOverviewLoading() {
  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-4 w-48" />
      </div>
      <TilesSkeleton />
      <AttentionSkeleton />
      <CoverageSkeleton />
      <SurveysSkeleton />
      <EventActivitySkeleton />
    </div>
  )
}
