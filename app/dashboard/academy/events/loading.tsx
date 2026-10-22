import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

// Column widths shared by the header row and body rows: Title · Dates · IPO Match · Action
const COLS = ['w-72', 'w-32', 'w-36', 'w-44']

export default function AcademyEventsLoading() {
  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-96" />
      </div>

      {/* 4 stat cards: label, value, sub-line */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2"><Skeleton className="h-3 w-28" /></CardHeader>
            <CardContent className="space-y-1.5">
              <Skeleton className="h-8 w-14" />
              <Skeleton className="h-3 w-36" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Coverage progress */}
      <div className="space-y-1.5">
        <div className="flex justify-between">
          <Skeleton className="h-3 w-80" />
          <Skeleton className="h-3 w-8" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
      </div>

      <div className="space-y-4">
        {/* "Catalogue (N events)" heading + filters */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-44" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-8 w-28" />
          </div>
        </div>

        {/* Table */}
        <div className="rounded-md border overflow-hidden">
          <div className="border-b bg-muted/50 px-4 py-3 flex gap-8">
            {COLS.map((w, i) => (
              <div key={i} className={w}><Skeleton className="h-4 w-20" /></div>
            ))}
          </div>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="border-b last:border-0 px-4 py-3 flex items-center gap-8">
              <div className={`${COLS[0]} space-y-1.5`}>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-12" />
              </div>
              <div className={COLS[1]}><Skeleton className="h-3 w-full" /></div>
              <div className={COLS[2]}><Skeleton className="h-4 w-24" /></div>
              <div className={`${COLS[3]} flex gap-2`}>
                <Skeleton className="h-7 w-20" />
                <Skeleton className="h-7 w-20" />
              </div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-20" />
          <div className="flex gap-2">
            <Skeleton className="h-7 w-9" />
            <Skeleton className="h-7 w-9" />
          </div>
        </div>
      </div>
    </div>
  )
}
