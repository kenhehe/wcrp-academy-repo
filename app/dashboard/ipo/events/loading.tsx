import { Skeleton } from '@/components/ui/skeleton'

export default function EventsLoading() {
  return (
    <div className="p-8 space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-4 w-48" />
      </div>

      {/* Filter bar skeleton */}
      <div className="flex gap-3">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-8 w-32 ml-auto" />
      </div>

      {/* Table skeleton */}
      <div className="rounded-md border bg-background overflow-hidden">
        <div className="border-b px-4 py-3 flex gap-6">
          {['min-w-64', 'w-24', 'w-24', 'w-20', 'w-28', 'w-24'].map((w, i) => (
            <Skeleton key={i} className={`h-4 ${w}`} />
          ))}
        </div>
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="border-b last:border-0 px-4 py-3 flex items-center gap-6">
            <Skeleton className="h-4 min-w-64 flex-1" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  )
}
