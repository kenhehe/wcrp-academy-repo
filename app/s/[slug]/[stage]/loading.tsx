import { Skeleton } from '@/components/ui/skeleton'

export default function SurveyStageLoading() {
  return (
    <div className="space-y-4 rounded-2xl border bg-background p-5">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-6 w-64" />
      <Skeleton className="h-5 w-40 rounded-full" />
      <div className="space-y-3 pt-4">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  )
}
