import { Skeleton } from '@/components/ui/skeleton'

export default function CoreQuestionsLoading() {
  return (
    <div className="p-8 space-y-6">
      <Skeleton className="h-4 w-20" />
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="space-y-3 rounded-xl border bg-card p-4">
        {Array.from({ length: 9 }, (_, i) => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    </div>
  )
}
