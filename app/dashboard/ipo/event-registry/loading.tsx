import { Skeleton } from '@/components/ui/skeleton'
import EventRegistryBrowserSkeleton from '@/components/events/EventRegistryBrowserSkeleton'

export default function IPOEventRegistryLoading() {
  return (
    <div className="p-8 space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-8 w-28" />
      </div>
      <EventRegistryBrowserSkeleton />
    </div>
  )
}
