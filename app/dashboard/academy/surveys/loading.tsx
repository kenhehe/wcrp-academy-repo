import { Skeleton } from '@/components/ui/skeleton'

export default function SurveysLoading() {
  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-8 w-32" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
      <div className="space-y-3 rounded-xl border bg-card p-4">
        <div className="flex gap-2">
          {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-7 w-20" />)}
        </div>
        {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    </div>
  )
}
