import { Skeleton } from '@/components/ui/skeleton'

export default function GapAnalysisLoading() {
  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-4 w-80" />
      </div>

      {/* 3 stat tiles */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl ring-1 ring-foreground/10 p-4 space-y-3">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-3 w-56" />
          </div>
        ))}
      </div>

      {/* Coverage by IPO: IPO · meter + % · upcoming · ongoing · past · Review */}
      <div className="rounded-xl ring-1 ring-foreground/10 overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-3 p-4">
          <div className="space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-96" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-7 w-32" />
          </div>
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-6 border-t px-4 py-3">
            <Skeleton className="h-4 w-24" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-2 w-36 rounded-full" />
              <Skeleton className="h-4 w-10" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="ml-auto h-5 w-14" />
            <Skeleton className="h-4 w-8" />
            <Skeleton className="h-4 w-10" />
            <Skeleton className="h-7 w-16" />
          </div>
        ))}
      </div>

      {/* Missing events table */}
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
              <Skeleton className="h-7 w-36 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
