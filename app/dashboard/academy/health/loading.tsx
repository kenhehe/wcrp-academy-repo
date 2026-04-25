import { Skeleton } from '@/components/ui/skeleton'

export default function SystemHealthLoading() {
  return (
    <div className="p-8 space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-4 space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>

      {/* Per-IPO table */}
      <div className="space-y-3">
        <Skeleton className="h-5 w-32" />
        <div className="rounded-md border overflow-hidden">
          <div className="border-b bg-muted/50 px-4 py-3 flex gap-6">
            {['w-28', 'w-36', 'w-20', 'w-16 ml-auto', 'w-16'].map((w, i) => (
              <Skeleton key={i} className={`h-4 ${w}`} />
            ))}
          </div>
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="border-b last:border-0 px-4 py-3 flex items-center gap-6">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-4 w-16 ml-auto" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>

      {/* Recent runs */}
      <div className="space-y-3">
        <Skeleton className="h-5 w-28" />
        <div className="rounded-md border overflow-hidden">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="border-b last:border-0 px-4 py-3 flex items-center gap-6">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-4 w-12 ml-auto" />
              <Skeleton className="h-4 w-12" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
