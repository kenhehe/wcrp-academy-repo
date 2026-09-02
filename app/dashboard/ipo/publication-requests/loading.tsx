import { Skeleton } from '@/components/ui/skeleton'

export default function PublicationRequestsLoading() {
  return (
    <div className="p-8 space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-8 w-44" />
      </div>
      <div className="rounded-md border overflow-hidden">
        <div className="border-b bg-muted/50 px-4 py-3 flex gap-6">
          {['flex-1', 'w-24', 'w-24', 'w-24', 'w-20', 'w-16'].map((w, i) => (
            <Skeleton key={i} className={`h-4 ${w}`} />
          ))}
        </div>
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="border-b last:border-0 px-4 py-3 flex items-center gap-6">
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-4 w-12" />
          </div>
        ))}
      </div>
    </div>
  )
}
