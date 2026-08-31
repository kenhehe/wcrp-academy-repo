import { Skeleton } from '@/components/ui/skeleton'
import DuplicatesReviewSkeleton from '@/components/duplicates/DuplicatesReviewSkeleton'

export default function AcademyDuplicatesLoading() {
  return (
    <div className="p-8 space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="flex items-center justify-end">
        <Skeleton className="h-8 w-44" />
      </div>
      <DuplicatesReviewSkeleton />
    </div>
  )
}
