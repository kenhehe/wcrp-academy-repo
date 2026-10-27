import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

// Mirrors EventActivity: heading and Chart / Table, the year chart, the breakdown card
export default function EventActivitySkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-7 w-20" />
          <Skeleton className="h-7 w-20" />
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-7 w-20" />
        </CardHeader>
        <CardContent>
          <div className="flex h-[300px] items-end gap-2 pl-10">
            {[10, 6, 4, 14, 20, 34, 30, 52, 60, 70, 42, 46, 40, 26, 30, 38, 54, 72, 100, 80, 8].map((h, i) => (
              <Skeleton key={i} className="flex-1 rounded-b-none" style={{ height: `${h * 2}px` }} />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-2 border-b">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <div className="space-y-3">
            <Skeleton className="h-4 w-32" />
            {[5, 3].map((rows, g) => (
              <div key={g} className="space-y-2 pt-2">
                <div className="flex justify-between border-b pb-1.5">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
                {Array.from({ length: rows }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3" style={{ width: `${70 - i * 12}%` }} />
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="space-y-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-[164px] w-full" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
