import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import type { ComingUpSkeletonProps } from './types'

// The shape of components/events/ComingUp: a title, a line of text and six table rows
export default function ComingUpSkeleton({ className }: ComingUpSkeletonProps) {
  return (
    <Card className={className}>
      <CardHeader className="space-y-2">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-5 w-28 rounded-full" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
