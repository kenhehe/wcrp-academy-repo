import { Skeleton } from '@/components/ui/skeleton'

// Column widths shared by the header row and body rows: Title · Status · Dates · Type · Lead Organizer
const COLS = ['w-72', 'w-32', 'w-40', 'w-24', 'w-36']

export default function CatalogueLoading() {
  return (
    <div className="p-8 space-y-6">
      {/* Header: title, "Live from WordPress · N events", explainer paragraph */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-60" />
        <Skeleton className="h-4 w-48" />
        <div className="max-w-lg space-y-1.5 pt-1">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
        </div>
      </div>

      {/* Filters: search + status */}
      <div className="flex gap-2">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-8 w-40" />
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
              <Skeleton className="h-3 w-14" />
            </div>
            <div className={COLS[1]}><Skeleton className="h-5 w-28 rounded-full" /></div>
            <div className={COLS[2]}><Skeleton className="h-3 w-full" /></div>
            <div className={COLS[3]}><Skeleton className="h-3 w-full" /></div>
            <div className={COLS[4]}><Skeleton className="h-3 w-28" /></div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-14" />
        <div className="flex gap-2">
          <Skeleton className="h-7 w-9" />
          <Skeleton className="h-7 w-9" />
        </div>
      </div>
    </div>
  )
}
