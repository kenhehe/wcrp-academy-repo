import { Skeleton } from '@/components/ui/skeleton'

export default function DuplicatesReviewSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-end">
        <Skeleton className="h-8 w-52" />
      </div>

      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-4 space-y-3">
            <Skeleton className="h-5 w-24 rounded-full" />
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-14 rounded" />
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-3 w-20" />
            </div>
            <div className="border-t" />
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-14 rounded" />
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-3 w-20" />
            </div>
            <div className="flex gap-2 pt-1">
              <Skeleton className="h-7 w-28 rounded-md" />
              <Skeleton className="h-7 w-32 rounded-md" />
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <Skeleton className="h-5 w-40" />
        <div className="rounded-md border overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="border-b last:border-0 px-4 py-3 flex items-center gap-6">
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-7 w-20 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
