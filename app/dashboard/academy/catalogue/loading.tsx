import { Skeleton } from '@/components/ui/skeleton'

export default function CatalogueLoading() {
  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-8 w-24" />
      </div>

      <div className="flex gap-2">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-8 w-36" />
      </div>

      <div className="rounded-md border overflow-hidden">
        <div className="border-b bg-muted/50 px-4 py-3 flex gap-8">
          {['Title', 'Status', 'Dates', 'Type', 'Lead Organizer', 'Actions'].map(h => (
            <Skeleton key={h} className="h-4 w-20" />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="border-b last:border-0 px-4 py-3 flex items-center gap-8">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-6 w-16" />
          </div>
        ))}
      </div>
    </div>
  )
}
