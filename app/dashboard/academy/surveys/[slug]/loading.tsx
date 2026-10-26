import { Skeleton } from '@/components/ui/skeleton'

export default function SurveyLoading() {
  return (
    <div className="p-8 space-y-6">
      <Skeleton className="h-4 w-20" />
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-5 w-64" />
          <Skeleton className="h-8 w-80 max-w-full" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-8 w-44" />
      </div>
      <Skeleton className="h-20 w-full rounded-xl" />
      <div className="flex gap-3 border-b pb-2">
        {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-5 w-20" />)}
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Skeleton className="h-96 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
      <Skeleton className="h-80 rounded-xl" />
    </div>
  )
}
