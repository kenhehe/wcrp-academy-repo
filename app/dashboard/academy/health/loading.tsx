import { Skeleton } from '@/components/ui/skeleton'

export default function SystemHealthLoading() {
  return (
    <div className="p-4 sm:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-7 w-36" />
        </div>
      </div>

      {/* Attention panel */}
      <Skeleton className="h-28 w-full rounded-xl" />

      {/* Stat tiles */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl ring-1 ring-foreground/10 p-4 space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-3 w-40" />
          </div>
        ))}
      </div>

      {/* Scraper history */}
      <div className="rounded-xl ring-1 ring-foreground/10 overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-3 p-4">
          <div className="space-y-2">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-4 w-80" />
        </div>
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex flex-wrap items-center gap-x-5 gap-y-3 border-t px-4 py-3.5">
            <div className="w-40 space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>
            <Skeleton className="h-7 min-w-60 flex-[1_1_360px]" />
            <div className="w-28 space-y-1.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-14" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-7 w-20" />
              <Skeleton className="h-7 w-20" />
            </div>
          </div>
        ))}
      </div>

      {/* Run log */}
      <div className="rounded-xl ring-1 ring-foreground/10 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="space-y-2">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-4 w-60" />
          </div>
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-7 w-24" />
            ))}
          </div>
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-6 border-t px-4 py-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-14 rounded-md" />
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-4 flex-1" />
          </div>
        ))}
      </div>
    </div>
  )
}
