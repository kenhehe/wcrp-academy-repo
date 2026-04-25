import { Skeleton } from '@/components/ui/skeleton'

export default function GapAnalysisLoading() {
  return (
    <div className="p-8 space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* Coverage bars */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-4 space-y-2">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-12" />
            </div>
            <Skeleton className="h-2 w-full" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-40" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-36" />
            <Skeleton className="h-8 w-32" />
          </div>
        </div>
        <div className="rounded-md border overflow-hidden">
          <div className="border-b bg-muted/50 px-4 py-3 flex gap-6">
            {['flex-1', 'w-24', 'w-24', 'w-20'].map((w, i) => (
              <Skeleton key={i} className={`h-4 ${w}`} />
            ))}
          </div>
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="border-b last:border-0 px-4 py-3 flex items-center gap-6">
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
