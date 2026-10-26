import { Skeleton } from '@/components/ui/skeleton'

export default function SurveyPreviewLoading() {
  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between gap-3">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-7 w-56" />
      </div>
      <div className="mx-auto w-full max-w-md space-y-4 rounded-2xl border bg-card p-5">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-16 w-full" />
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="space-y-2 pt-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-12 w-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
