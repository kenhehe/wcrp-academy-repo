import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import EventActivitySkeleton from '@/components/charts/EventActivitySkeleton'
import ComingUpSkeleton from '@/components/events/ComingUpSkeleton'
import LighthouseSummarySkeleton from '@/components/events/LighthouseSummarySkeleton'

// Mirrors ClimateAnalytics: 4 trend tiles, Event activity (year chart + breakdown), Coming up + Lighthouse
export default function ClimateAnalyticsSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2"><Skeleton className="h-4 w-36" /></CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-end justify-between gap-3">
                <Skeleton className="h-8 w-14" />
                <Skeleton className="h-10 w-28" />
              </div>
              <Skeleton className="h-5 w-44" />
            </CardContent>
          </Card>
        ))}
      </div>

      <EventActivitySkeleton />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <ComingUpSkeleton className="xl:col-span-2" />
        <LighthouseSummarySkeleton />
      </div>
    </div>
  )
}
